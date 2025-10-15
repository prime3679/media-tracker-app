import type { ReactNode } from 'react';
import { createContext, useContext, useEffect, useMemo, useReducer, useRef } from 'react';

export type QueryKey = readonly unknown[];

type QueryStatus = 'idle' | 'loading' | 'success' | 'error';

type QueryFunction<TData> = () => Promise<TData> | TData;

type QueryListener = () => void;

interface InternalQueryState<TData> {
  data: TData | undefined;
  error: unknown;
  status: QueryStatus;
  stale: boolean;
  promise: Promise<TData> | null;
  controller: AbortController | null;
  listeners: Set<QueryListener>;
  queryFn: QueryFunction<TData>;
}

interface UseQueryOptions<TData> {
  queryKey: QueryKey;
  queryFn: QueryFunction<TData>;
  enabled?: boolean;
}

export interface UseQueryResult<TData> {
  data: TData | undefined;
  error: unknown;
  status: QueryStatus;
  isLoading: boolean;
  isFetching: boolean;
  refetch: () => Promise<TData>;
}

interface InvalidateOptions {
  queryKey: QueryKey;
}

interface CancelOptions {
  queryKey: QueryKey;
}

class QueryStore<TData> {
  private readonly state: InternalQueryState<TData>;

  constructor(options: UseQueryOptions<TData>) {
    this.state = {
      data: undefined,
      error: undefined,
      status: 'idle',
      stale: true,
      promise: null,
      controller: null,
      listeners: new Set(),
      queryFn: options.queryFn,
    } satisfies InternalQueryState<TData>;
  }

  public getState() {
    return this.state;
  }

  public setOptions(options: UseQueryOptions<TData>) {
    if (options.queryFn !== this.state.queryFn) {
      this.state.queryFn = options.queryFn;
    }
  }

  public subscribe(listener: QueryListener) {
    this.state.listeners.add(listener);
    return () => {
      this.state.listeners.delete(listener);
    };
  }

  private notify() {
    this.state.listeners.forEach((listener) => listener());
  }

  public shouldFetch(enabled: boolean | undefined) {
    if (enabled === false) {
      return false;
    }
    return this.state.status === 'idle' || this.state.stale;
  }

  public async fetch(): Promise<TData> {
    if (this.state.promise) {
      return this.state.promise;
    }

    this.state.status = 'loading';
    this.state.error = undefined;
    this.state.stale = false;
    this.notify();

    const controller = new AbortController();
    this.state.controller = controller;

    const promise = Promise.resolve()
      .then(() => this.state.queryFn())
      .then((data) => {
        this.state.data = data;
        this.state.status = 'success';
        this.state.promise = null;
        this.state.controller = null;
        this.notify();
        return data;
      })
      .catch((error) => {
        if (controller.signal.aborted) {
          return Promise.reject(error);
        }
        this.state.error = error;
        this.state.status = 'error';
        this.state.promise = null;
        this.state.controller = null;
        this.notify();
        throw error;
      });

    this.state.promise = promise;
    return promise;
  }

  public cancel() {
    if (this.state.controller) {
      this.state.controller.abort();
      this.state.controller = null;
    }
    this.state.promise = null;
  }

  public setData(updater: TData | ((previous: TData | undefined) => TData)) {
    const value = typeof updater === 'function' ? (updater as (previous: TData | undefined) => TData)(this.state.data) : updater;
    this.state.data = value;
    this.state.status = 'success';
    this.state.stale = false;
    this.notify();
  }
}

const serializeQueryKey = (queryKey: QueryKey) => JSON.stringify(queryKey);

export class QueryClient {
  private readonly stores = new Map<string, QueryStore<unknown>>();

  public ensureStore<TData>(options: UseQueryOptions<TData>) {
    const key = serializeQueryKey(options.queryKey);
    let store = this.stores.get(key) as QueryStore<TData> | undefined;

    if (!store) {
      store = new QueryStore<TData>(options);
      this.stores.set(key, store as QueryStore<unknown>);
    } else {
      store.setOptions(options);
    }

    return store;
  }

  private getStore<TData>(queryKey: QueryKey) {
    const key = serializeQueryKey(queryKey);
    return this.stores.get(key) as QueryStore<TData> | undefined;
  }

  public getQueryData<TData>(queryKey: QueryKey): TData | undefined {
    return this.getStore<TData>(queryKey)?.getState().data as TData | undefined;
  }

  public setQueryData<TData>(queryKey: QueryKey, updater: TData | ((previous: TData | undefined) => TData)) {
    const store = this.getStore<TData>(queryKey);

    if (store) {
      store.setData(updater);
      return;
    }

    const newStore = new QueryStore<TData>({
      queryKey,
      queryFn: () => Promise.resolve(
        typeof updater === 'function'
          ? (updater as (previous: TData | undefined) => TData)(undefined)
          : updater,
      ),
    });

    newStore.setData(updater);
    this.stores.set(serializeQueryKey(queryKey), newStore as QueryStore<unknown>);
  }

  public async invalidateQueries(options: InvalidateOptions) {
    const store = this.getStore(options.queryKey);
    if (!store) return;
    const state = store.getState();
    state.stale = true;
    if (state.listeners.size > 0) {
      await store.fetch().catch(() => {});
    }
  }

  public cancelQueries(options: CancelOptions) {
    const store = this.getStore(options.queryKey);
    store?.cancel();
  }
}

const QueryClientContext = createContext<QueryClient | null>(null);

interface QueryClientProviderProps {
  client: QueryClient;
  children: ReactNode;
}

export function QueryClientProvider({ client, children }: QueryClientProviderProps) {
  return <QueryClientContext.Provider value={client}>{children}</QueryClientContext.Provider>;
}

export const useQueryClient = () => {
  const client = useContext(QueryClientContext);
  if (!client) {
    throw new Error('QueryClientProvider is missing in the component tree.');
  }
  return client;
};

export function useQuery<TData>(options: UseQueryOptions<TData>): UseQueryResult<TData> {
  const client = useQueryClient();
  const store = useMemo(() => client.ensureStore(options), [client, options.queryKey, options.queryFn]);
  const [, forceRender] = useReducer((value) => value + 1, 0);

  useEffect(() => store.subscribe(() => forceRender()), [store]);

  useEffect(() => {
    store.setOptions(options);
    if (store.shouldFetch(options.enabled)) {
      void store.fetch();
    }
  }, [store, options.enabled, options.queryFn]);

  const state = store.getState();

  const refetch = async () => {
    state.stale = true;
    return store.fetch();
  };

  return {
    data: state.data,
    error: state.error,
    status: state.status,
    isLoading: state.status === 'loading' && state.data === undefined,
    isFetching: state.status === 'loading',
    refetch,
  } satisfies UseQueryResult<TData>;
}

type MutateFunction<TData, TVariables, TContext> = (variables: TVariables, context: TContext | undefined) =>
  | TData
  | Promise<TData>;

interface UseMutationOptions<TData, TError, TVariables, TContext> {
  mutationFn: MutateFunction<TData, TVariables, TContext>;
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext;
  onError?: (error: TError, variables: TVariables, context: TContext | undefined) => void;
  onSuccess?: (data: TData, variables: TVariables, context: TContext | undefined) => void;
  onSettled?: (
    data: TData | undefined,
    error: TError | null,
    variables: TVariables,
    context: TContext | undefined,
  ) => void;
}

interface UseMutationResult<TData, TError, TVariables, TContext> {
  data: TData | undefined;
  error: TError | null;
  isPending: boolean;
  isSuccess: boolean;
  isError: boolean;
  mutate: (
    variables: TVariables,
    options?: Partial<UseMutationOptions<TData, TError, TVariables, TContext>>,
  ) => void;
  mutateAsync: (
    variables: TVariables,
    options?: Partial<UseMutationOptions<TData, TError, TVariables, TContext>>,
  ) => Promise<TData>;
}

type MutationState<TData, TError> = {
  data: TData | undefined;
  error: TError | null;
  status: 'idle' | 'pending' | 'success' | 'error';
};

const mergeMutationOptions = <TData, TError, TVariables, TContext>(
  base: UseMutationOptions<TData, TError, TVariables, TContext>,
  overrides?: Partial<UseMutationOptions<TData, TError, TVariables, TContext>>,
): UseMutationOptions<TData, TError, TVariables, TContext> => ({
  ...base,
  ...overrides,
  mutationFn: overrides?.mutationFn ?? base.mutationFn,
});

export function useMutation<TData, TError = unknown, TVariables = void, TContext = unknown>(
  options: UseMutationOptions<TData, TError, TVariables, TContext>,
): UseMutationResult<TData, TError, TVariables, TContext> {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const [state, dispatch] = useReducer(
    (_prev: MutationState<TData, TError>, action: MutationState<TData, TError>) => action,
    { data: undefined, error: null, status: 'idle' },
  );

  const mutateAsync = async (
    variables: TVariables,
    overrides?: Partial<UseMutationOptions<TData, TError, TVariables, TContext>>,
  ): Promise<TData> => {
    const merged = mergeMutationOptions(optionsRef.current, overrides);

    dispatch({ data: undefined, error: null, status: 'pending' });

    let context: TContext | undefined;

    try {
      context = await merged.onMutate?.(variables);
      const data = await merged.mutationFn(variables, context);
      await merged.onSuccess?.(data, variables, context);
      await merged.onSettled?.(data, null, variables, context);
      dispatch({ data, error: null, status: 'success' });
      return data;
    } catch (error) {
      const typedError = error as TError;
      await merged.onError?.(typedError, variables, context);
      await merged.onSettled?.(undefined, typedError, variables, context);
      dispatch({ data: undefined, error: typedError, status: 'error' });
      throw error;
    }
  };

  const mutate = (
    variables: TVariables,
    overrides?: Partial<UseMutationOptions<TData, TError, TVariables, TContext>>,
  ) => {
    void mutateAsync(variables, overrides);
  };

  return {
    data: state.data,
    error: state.error,
    isPending: state.status === 'pending',
    isSuccess: state.status === 'success',
    isError: state.status === 'error',
    mutate,
    mutateAsync,
  } satisfies UseMutationResult<TData, TError, TVariables, TContext>;
}

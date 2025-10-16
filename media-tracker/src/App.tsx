import { FormEvent, useEffect, useId, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import './App.css';
import {
  mediaApi,
  mediaQueryKey,
  statsQueryKey,
  importApi,
  nextApi,
  nextQueryKey,
  searchApi,
  buildSearchQueryKey,
  type CreateMediaInput,
  type MediaItem,
  type MediaList,
  type MediaStats,
  type MediaTracking,
  type UpdateTrackingInput,
  type ImportApplyInput,
  type ImportSearchResult,
  type NextUpItem,
  type SearchResultItem,
} from './services/api';
import { syncStore } from './lib/syncStore';

type Tab = 'library' | 'stats' | 'search';
type StatusFilter = 'all' | MediaTracking['status'];
type TypeFilter = 'all' | MediaItem['mediaType'];

type MutationError = Error | null;

interface CreateMediaContext {
  previousMedia: MediaList | undefined;
  previousStats: MediaStats | undefined;
  tempId: number;
}

interface UpdateTrackingPayload {
  mediaId: number;
  data: UpdateTrackingInput;
}

interface UpdateTrackingContext {
  previousMedia: MediaList | undefined;
  previousStats: MediaStats | undefined;
}

type ImportSearchCategory = 'movie' | 'tv' | 'book';

interface QuickAddOption extends ImportSearchResult {
  type: ImportApplyInput['type'];
  sourceCategory: ImportSearchCategory;
}

interface FormState {
  title: string;
  mediaType: MediaItem['mediaType'];
  status: MediaTracking['status'];
  rating: string;
  notes: string;
}

const INITIAL_FORM_STATE: FormState = {
  title: '',
  mediaType: 'movie',
  status: 'to_watch',
  rating: '',
  notes: '',
};

const STATUS_TO_STATS_KEY: Record<MediaTracking['status'], keyof MediaStats> = {
  completed: 'completed',
  watching: 'watching',
  to_watch: 'toWatch',
  on_hold: 'onHold',
  dropped: 'dropped',
};

const TYPE_TO_STATS_KEY: Record<MediaItem['mediaType'], keyof MediaStats> = {
  movie: 'movies',
  tv_show: 'tvShows',
  book: 'books',
};

const nowIsoString = () => new Date().toISOString();

const mapCategoryToMediaType = (category: ImportSearchCategory): MediaItem['mediaType'] =>
  category === 'tv' ? 'tv_show' : category;

const mapCategoryToApplyType = (category: ImportSearchCategory): ImportApplyInput['type'] =>
  mapCategoryToMediaType(category);

const QUICK_ADD_MIN_QUERY_LENGTH = 2;
const QUICK_ADD_DEBOUNCE_MS = 300;

const buildCreateInput = (form: FormState): CreateMediaInput => ({
  title: form.title.trim(),
  mediaType: form.mediaType,
  status: form.status,
  rating: form.rating ? Number(form.rating) : null,
  notes: form.notes.trim() === '' ? undefined : form.notes.trim(),
  progress: 0,
});

const createOptimisticMediaItem = (
  input: CreateMediaInput,
  tempId: number,
): MediaItem => ({
  id: tempId,
  userId: 1,
  title: input.title,
  mediaType: input.mediaType,
  description: null,
  author: null,
  director: null,
  genres: null,
  createdAt: nowIsoString(),
  updatedAt: nowIsoString(),
  tracking: {
    id: tempId,
    userId: 1,
    mediaItemId: tempId,
    status: input.status ?? 'to_watch',
    rating: input.rating ?? null,
    progress: input.progress ?? 0,
    notes: (input.notes as string | undefined) ?? null,
    completedDate: input.status === 'completed' ? nowIsoString() : null,
    createdAt: nowIsoString(),
    updatedAt: nowIsoString(),
  },
});

const adjustStatsForCreate = (stats: MediaStats, item: MediaItem): MediaStats => {
  const typeKey = TYPE_TO_STATS_KEY[item.mediaType];
  const statusKey = item.tracking ? STATUS_TO_STATS_KEY[item.tracking.status] : 'toWatch';

  return {
    ...stats,
    totalItems: stats.totalItems + 1,
    [typeKey]: stats[typeKey] + 1,
    [statusKey]: stats[statusKey] + 1,
  } satisfies MediaStats;
};

const adjustStatsForStatusChange = (
  stats: MediaStats,
  previousStatus: MediaTracking['status'],
  nextStatus: MediaTracking['status'],
) => {
  if (previousStatus === nextStatus) {
    return stats;
  }

  const prevKey = STATUS_TO_STATS_KEY[previousStatus];
  const nextKey = STATUS_TO_STATS_KEY[nextStatus];

  return {
    ...stats,
    [prevKey]: Math.max(0, stats[prevKey] - 1),
    [nextKey]: stats[nextKey] + 1,
  } satisfies MediaStats;
};

function App() {
  const [activeTab, setActiveTab] = useState<Tab>('library');
  const [showAddForm, setShowAddForm] = useState(false);
  const [librarySearchQuery, setLibrarySearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadErrorDismissed, setLoadErrorDismissed] = useState(false);
  const [syncPending, setSyncPending] = useState(0);
  const [quickAddQuery, setQuickAddQuery] = useState('');
  const [quickAddType, setQuickAddType] = useState<ImportSearchCategory>('movie');
  const [quickAddOptions, setQuickAddOptions] = useState<QuickAddOption[]>([]);
  const [quickAddLoading, setQuickAddLoading] = useState(false);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const queryClient = useQueryClient();
  const quickAddAbortController = useRef<AbortController | null>(null);
  const quickAddDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const quickAddInputId = useId();
  const quickAddTypeId = useId();
  const quickAddHeadingId = useId();
  const quickAddHelperId = useId();
  const nextUpHeadingId = useId();
  const librarySearchInputId = useId();
  const librarySearchHeadingId = useId();
  const statusFilterId = useId();
  const typeFilterId = useId();
  const globalSearchInputId = useId();
  const searchScreenHeadingId = useId();
  const searchScreenHelperId = useId();

  useEffect(() => {
    const unsubscribe = syncStore.subscribe((count) => {
      setSyncPending(count);
    });
    return unsubscribe;
  }, []);

  const mediaQuery = useQuery({
    queryKey: mediaQueryKey,
    queryFn: () => mediaApi.list(),
  });

  const statsQuery = useQuery({
    queryKey: statsQueryKey,
    queryFn: () => mediaApi.stats(),
  });

  const nextUpQuery = useQuery<NextUpItem[]>({
    queryKey: nextQueryKey,
    queryFn: () => nextApi.list(),
    enabled: activeTab === 'library',
  });

  const trimmedSearchTerm = searchTerm.trim();

  const searchResultsQuery = useQuery<SearchResultItem[]>({
    queryKey: buildSearchQueryKey(trimmedSearchTerm),
    queryFn: () => searchApi.search(trimmedSearchTerm),
    enabled: trimmedSearchTerm.length > 0 && activeTab === 'search',
  });

  useEffect(() => {
    if (quickAddDebounceRef.current) {
      clearTimeout(quickAddDebounceRef.current);
      quickAddDebounceRef.current = null;
    }

    quickAddAbortController.current?.abort();

    if (quickAddQuery.trim().length < QUICK_ADD_MIN_QUERY_LENGTH) {
      setQuickAddOptions([]);
      setQuickAddLoading(false);
      if (quickAddQuery.trim().length === 0) {
        setQuickAddError(null);
      }
      quickAddAbortController.current = null;
      return;
    }

    setQuickAddLoading(true);
    setQuickAddError(null);

    const controller = new AbortController();
    quickAddAbortController.current = controller;
    const requestCategory = quickAddType;
    const requestQuery = quickAddQuery.trim();

    const timeoutId = setTimeout(() => {
      importApi
        .search(requestQuery, requestCategory, controller.signal)
        .then((results) => {
          if (controller.signal.aborted) {
            return;
          }
          const applyType = mapCategoryToApplyType(requestCategory);
          setQuickAddOptions(
            results.map((result) => ({
              ...result,
              type: applyType,
              sourceCategory: requestCategory,
            })),
          );
          setQuickAddLoading(false);
          quickAddAbortController.current = null;
        })
        .catch((error) => {
          if (controller.signal.aborted) {
            return;
          }
          setQuickAddError('Unable to fetch quick add suggestions right now.');
          setQuickAddLoading(false);
          quickAddAbortController.current = null;
          console.error('Quick add search failed:', error);
        });
    }, QUICK_ADD_DEBOUNCE_MS);

    quickAddDebounceRef.current = timeoutId;

    return () => {
      clearTimeout(timeoutId);
      controller.abort();
    };
  }, [quickAddQuery, quickAddType]);

  const createMediaMutation = useMutation<MediaItem, MutationError, CreateMediaInput, CreateMediaContext>({
    mutationFn: (input) => mediaApi.create(input),
    onMutate: async (input) => {
      setErrorMessage(null);
      setLoadErrorDismissed(false);
      await queryClient.cancelQueries({ queryKey: mediaQueryKey });
      await queryClient.cancelQueries({ queryKey: statsQueryKey });
      await queryClient.cancelQueries({ queryKey: nextQueryKey });

      const previousMedia = queryClient.getQueryData<MediaList>(mediaQueryKey);
      const previousStats = queryClient.getQueryData<MediaStats>(statsQueryKey);
      const tempId = -Date.now();
      const optimisticItem = createOptimisticMediaItem(input, tempId);

      queryClient.setQueryData<MediaList>(mediaQueryKey, (items = []) => [...items, optimisticItem]);
      if (previousStats) {
        queryClient.setQueryData<MediaStats>(
          statsQueryKey,
          adjustStatsForCreate(previousStats, optimisticItem),
        );
      }

      return { previousMedia, previousStats, tempId } satisfies CreateMediaContext;
    },
    onError: (error, _variables, context) => {
      if (context?.previousMedia) {
        queryClient.setQueryData(mediaQueryKey, context.previousMedia);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(statsQueryKey, context.previousStats);
      }
      setErrorMessage('Failed to add media item. Please try again.');
      console.error('Failed to add media item:', error);
    },
    onSuccess: (created, _variables, context) => {
      queryClient.setQueryData<MediaList>(mediaQueryKey, (items = []) =>
        items.map((item) => (item.id === context?.tempId ? created : item)),
      );
      setFormData(INITIAL_FORM_STATE);
      setShowAddForm(false);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: mediaQueryKey });
      void queryClient.invalidateQueries({ queryKey: statsQueryKey });
      void queryClient.invalidateQueries({ queryKey: nextQueryKey });
    },
  });

  const quickAddMutation = useMutation<MediaItem, MutationError, QuickAddOption, CreateMediaContext>({
    mutationFn: (option) =>
      importApi.apply({
        title: option.title,
        year: option.year ?? undefined,
        poster: option.poster ?? null,
        external_id: option.external_id,
        type: option.type,
      }),
    onMutate: async (option) => {
      setErrorMessage(null);
      setLoadErrorDismissed(false);
      setQuickAddError(null);
      await queryClient.cancelQueries({ queryKey: mediaQueryKey });
      await queryClient.cancelQueries({ queryKey: statsQueryKey });
      await queryClient.cancelQueries({ queryKey: nextQueryKey });

      const previousMedia = queryClient.getQueryData<MediaList>(mediaQueryKey);
      const previousStats = queryClient.getQueryData<MediaStats>(statsQueryKey);
      const tempId = -Date.now();

      const createInput: CreateMediaInput = {
        title: option.title,
        mediaType: option.type as MediaItem['mediaType'],
        status: 'to_watch',
        rating: null,
        notes: undefined,
        progress: 0,
      } satisfies CreateMediaInput;

      const optimisticItem = createOptimisticMediaItem(createInput, tempId);

      queryClient.setQueryData<MediaList>(mediaQueryKey, (items = []) => [...items, optimisticItem]);
      if (previousStats) {
        queryClient.setQueryData<MediaStats>(
          statsQueryKey,
          adjustStatsForCreate(previousStats, optimisticItem),
        );
      }

      setQuickAddOptions((options) => options.filter((candidate) => candidate.external_id !== option.external_id));

      return { previousMedia, previousStats, tempId } satisfies CreateMediaContext;
    },
    onError: (error, _variables, context) => {
      if (context?.previousMedia) {
        queryClient.setQueryData(mediaQueryKey, context.previousMedia);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(statsQueryKey, context.previousStats);
      }
      setQuickAddError('Failed to import the selected item. Please try again.');
      setErrorMessage('Failed to import the selected item. Please try again.');
      console.error('Failed to import media item:', error);
    },
    onSuccess: (created, _variables, context) => {
      queryClient.setQueryData<MediaList>(mediaQueryKey, (items = []) =>
        items.map((item) => (item.id === context?.tempId ? created : item)),
      );
      setQuickAddQuery('');
      setQuickAddOptions([]);
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: mediaQueryKey });
      void queryClient.invalidateQueries({ queryKey: statsQueryKey });
      void queryClient.invalidateQueries({ queryKey: nextQueryKey });
    },
  });

  const updateTrackingMutation = useMutation<MediaTracking, MutationError, UpdateTrackingPayload, UpdateTrackingContext>({
    mutationFn: ({ mediaId, data }) => mediaApi.updateTracking(mediaId, data),
    onMutate: async ({ mediaId, data }) => {
      setErrorMessage(null);
      setLoadErrorDismissed(false);
      await queryClient.cancelQueries({ queryKey: mediaQueryKey });
      await queryClient.cancelQueries({ queryKey: statsQueryKey });
      await queryClient.cancelQueries({ queryKey: nextQueryKey });

      const previousMedia = queryClient.getQueryData<MediaList>(mediaQueryKey);
      const previousStats = queryClient.getQueryData<MediaStats>(statsQueryKey);

      if (previousMedia) {
        const nextMedia = previousMedia.map((item) => {
          if (item.id !== mediaId) return item;

          const tracking = item.tracking ?? {
            id: item.id,
            userId: item.userId,
            mediaItemId: item.id,
            status: 'to_watch' as MediaTracking['status'],
            rating: null,
            progress: 0,
            notes: null,
            completedDate: null,
            createdAt: nowIsoString(),
            updatedAt: nowIsoString(),
          };

          const nextStatus = data.status ?? tracking.status;
          const nextTracking: MediaTracking = {
            ...tracking,
            status: nextStatus,
            rating: data.rating ?? tracking.rating ?? null,
            notes: (data.notes as string | null | undefined) ?? tracking.notes ?? null,
            progress: data.progress ?? tracking.progress ?? 0,
            updatedAt: nowIsoString(),
            completedDate: nextStatus === 'completed' ? tracking.completedDate ?? nowIsoString() : null,
          };

          return {
            ...item,
            tracking: nextTracking,
          };
        });

        queryClient.setQueryData<MediaList>(mediaQueryKey, nextMedia);

        const targetItem = nextMedia.find((item) => item.id === mediaId);
        const previousItem = previousMedia.find((item) => item.id === mediaId);
        if (targetItem?.tracking && previousItem?.tracking && previousStats) {
          queryClient.setQueryData<MediaStats>(
            statsQueryKey,
            adjustStatsForStatusChange(previousStats, previousItem.tracking.status, targetItem.tracking.status),
          );
        }
      }

      return { previousMedia, previousStats } satisfies UpdateTrackingContext;
    },
    onError: (error, _variables, context) => {
      if (context?.previousMedia) {
        queryClient.setQueryData(mediaQueryKey, context.previousMedia);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(statsQueryKey, context.previousStats);
      }
      setErrorMessage('Failed to update media item. Changes were reverted.');
      console.error('Failed to update media item:', error);
    },
    onSuccess: (tracking, variables) => {
      queryClient.setQueryData<MediaList>(mediaQueryKey, (items = []) =>
        items.map((item) =>
          item.id === variables.mediaId
            ? {
                ...item,
                tracking,
              }
            : item,
        ),
      );
    },
    onSettled: () => {
      void queryClient.invalidateQueries({ queryKey: mediaQueryKey });
      void queryClient.invalidateQueries({ queryKey: statsQueryKey });
      void queryClient.invalidateQueries({ queryKey: nextQueryKey });
    },
  });

  useEffect(() => {
    if (!mediaQuery.error && !statsQuery.error) {
      setLoadErrorDismissed(false);
    }
  }, [mediaQuery.error, statsQuery.error]);

  const filteredMediaItems = useMemo(() => {
    if (!mediaQuery.data) return [] as MediaList;

    return mediaQuery.data.filter((item) => {
      const trimmedQuery = librarySearchQuery.trim().toLowerCase();
      const matchesSearch =
        trimmedQuery === '' ||
        item.title.toLowerCase().includes(trimmedQuery) ||
        item.author?.toLowerCase().includes(trimmedQuery) ||
        item.director?.toLowerCase().includes(trimmedQuery);

      const matchesStatus =
        filterStatus === 'all' || item.tracking?.status === filterStatus;

      const matchesType = filterType === 'all' || item.mediaType === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [mediaQuery.data, librarySearchQuery, filterStatus, filterType]);

  const getStatusColor = (status: MediaTracking['status'] | undefined) => {
    switch (status) {
      case 'completed':
        return '#4CAF50';
      case 'watching':
        return '#2196F3';
      case 'to_watch':
        return '#FF9800';
      case 'dropped':
        return '#f44336';
      case 'on_hold':
        return '#9E9E9E';
      default:
        return '#9E9E9E';
    }
  };

  const getMediaIcon = (type: MediaItem['mediaType']) => {
    switch (type) {
      case 'movie':
        return '🎬';
      case 'tv_show':
        return '📺';
      case 'book':
        return '📚';
      default:
        return '🎬';
    }
  };

  const describeNextUp = (item: NextUpItem) => {
    const status = item.tracking?.status;
    if (status === 'watching') {
      return 'Continue where you left off';
    }
    if (status === 'to_watch') {
      return 'Recommended based on your recent favorites';
    }
    if (status === 'completed') {
      return 'Revisit a recent favorite';
    }
    return 'Ready when you are';
  };

  const formatStatus = (status: MediaTracking['status'] | undefined) =>
    status?.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'Unknown';

  const handleQuickAddSelect = (option: QuickAddOption) => {
    if (quickAddMutation.isPending) return;
    quickAddMutation.mutate(option);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildCreateInput(formData);
    createMediaMutation.mutate(payload);
  };

  const handleStatusChange = (item: MediaItem, status: MediaTracking['status']) => {
    updateTrackingMutation.mutate({
      mediaId: item.id,
      data: {
        status,
        rating: item.tracking?.rating ?? null,
        notes: item.tracking?.notes ?? undefined,
        progress: item.tracking?.progress ?? 0,
      },
    });
  };

  const handleRatingChange = (item: MediaItem, ratingValue: string) => {
    const rating = ratingValue === '' ? null : Number(ratingValue);
    updateTrackingMutation.mutate({
      mediaId: item.id,
      data: {
        status: item.tracking?.status ?? 'to_watch',
        rating,
        notes: item.tracking?.notes ?? undefined,
        progress: item.tracking?.progress ?? 0,
      },
    });
  };

  const isLoading = mediaQuery.isLoading && !mediaQuery.data;
  const loadError = !loadErrorDismissed ? mediaQuery.error || statsQuery.error : null;
  const showErrorBanner = Boolean(errorMessage || loadError);
  const errorBannerMessage = errorMessage ?? 'Failed to load data. Please try refreshing the page.';

  if (isLoading) {
    return (
      <div className="app">
        <header className="header">
          <h1>📱 Media Tracker</h1>
        </header>
        <div className="loading">
          <p>Loading your media library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📱 Media Tracker</h1>
        {syncPending > 0 && (
          <div className="sync-badge">
            ⏳ Sync pending: {syncPending}
          </div>
        )}
      </header>

      {showErrorBanner && (
        <div className="error-banner">
          <p>{errorBannerMessage}</p>
          <button
            onClick={() => {
              setErrorMessage(null);
              setLoadErrorDismissed(true);
            }}
          >
            ✕
          </button>
        </div>
      )}

      <nav className="tabs">
        <button
          className={activeTab === 'library' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('library')}
          aria-current={activeTab === 'library' ? 'page' : undefined}
        >
          📚 Library
        </button>
        <button
          className={activeTab === 'search' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('search')}
          aria-current={activeTab === 'search' ? 'page' : undefined}
        >
          🔎 Search
        </button>
        <button
          className={activeTab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('stats')}
          aria-current={activeTab === 'stats' ? 'page' : undefined}
        >
          📊 Stats
        </button>
      </nav>

      {activeTab === 'library' && (
        <main className="main">
          <section className="quick-add-section" aria-labelledby={quickAddHeadingId}>
            <div className="quick-add-card">
              <div className="quick-add-header">
                <h2 id={quickAddHeadingId}>⚡ Quick Add</h2>
                <p>Search Devin&apos;s catalog and drop items straight into your list.</p>
              </div>
              <div className="quick-add-fields">
                <div className="quick-add-field">
                  <label htmlFor={quickAddTypeId}>Result type</label>
                  <select
                    id={quickAddTypeId}
                    value={quickAddType}
                    onChange={(e) => setQuickAddType(e.target.value as ImportSearchCategory)}
                    disabled={quickAddMutation.isPending}
                  >
                    <option value="movie">🎬 Movies</option>
                    <option value="tv">📺 TV Shows</option>
                    <option value="book">📚 Books</option>
                  </select>
                </div>
                <div className="quick-add-field quick-add-search">
                  <label htmlFor={quickAddInputId}>Search titles</label>
                  <input
                    id={quickAddInputId}
                    type="text"
                    placeholder="Start typing a title..."
                    value={quickAddQuery}
                    onChange={(e) => setQuickAddQuery(e.target.value)}
                    aria-describedby={quickAddHelperId}
                    autoComplete="off"
                  />
                </div>
              </div>
              <p id={quickAddHelperId} className="quick-add-helper">
                Suggestions update as you type. Choose a result to import it instantly.
              </p>
              <div className="quick-add-results-wrapper" aria-live="polite">
                {quickAddMutation.isPending && (
                  <p className="quick-add-status" role="status">
                    Adding to your library…
                  </p>
                )}
                {quickAddLoading ? (
                  <p className="quick-add-status">Looking up suggestions…</p>
                ) : quickAddOptions.length > 0 ? (
                  <ul className="quick-add-results" role="listbox" aria-label="Quick add suggestions">
                    {quickAddOptions.map((option) => (
                      <li key={`${option.external_id}-${option.sourceCategory}`}>
                        <button
                          type="button"
                          className="quick-add-option"
                          onClick={() => handleQuickAddSelect(option)}
                          disabled={quickAddMutation.isPending}
                          aria-label={`Add ${option.title}${option.year ? ` (${option.year})` : ''} to your library`}
                        >
                          <span className="quick-add-option-title">{option.title}</span>
                          <span className="quick-add-option-meta">
                            {option.year ? `${option.year} • ` : ''}
                            {option.sourceCategory === 'tv'
                              ? 'TV show'
                              : option.sourceCategory === 'movie'
                              ? 'Movie'
                              : 'Book'}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : quickAddQuery.trim().length >= QUICK_ADD_MIN_QUERY_LENGTH ? (
                  <p className="quick-add-status">No matches yet—try a different spelling.</p>
                ) : (
                  <p className="quick-add-status">
                    Type at least {QUICK_ADD_MIN_QUERY_LENGTH} letters to see suggestions.
                  </p>
                )}
                {quickAddError && (
                  <p className="quick-add-error" role="alert">
                    {quickAddError}
                  </p>
                )}
              </div>
            </div>
          </section>

          <div className="add-section">
            <button className="add-button" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? '✕ Cancel' : '+ Add Media'}
            </button>
          </div>

          {showAddForm && (
            <form className="add-form" onSubmit={handleSubmit}>
              <input
                type="text"
                placeholder="Title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                required
              />

              <select
                value={formData.mediaType}
                onChange={(e) =>
                  setFormData({ ...formData, mediaType: e.target.value as MediaItem['mediaType'] })
                }
              >
                <option value="movie">🎬 Movie</option>
                <option value="tv_show">📺 TV Show</option>
                <option value="book">📚 Book</option>
              </select>

              <select
                value={formData.status}
                onChange={(e) =>
                  setFormData({ ...formData, status: e.target.value as MediaTracking['status'] })
                }
              >
                <option value="to_watch">To Watch/Read</option>
                <option value="watching">Currently Watching/Reading</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="dropped">Dropped</option>
              </select>

              <input
                type="number"
                placeholder="Rating (1-10)"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                min="1"
                max="10"
                step="0.1"
              />

              <textarea
                placeholder="Notes (optional)"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
              />

              <button type="submit" className="submit-button" disabled={createMediaMutation.isPending}>
                {createMediaMutation.isPending ? 'Adding...' : 'Add to Library'}
              </button>
            </form>
          )}

          <section className="next-up-section" aria-labelledby={nextUpHeadingId}>
            <div className="next-up-card">
              <div className="next-up-header">
                <h2 id={nextUpHeadingId}>🎯 Next up</h2>
                {nextUpQuery.isFetching && (
                  <span className="next-up-refresh" role="status">
                    Refreshing…
                  </span>
                )}
              </div>
              {nextUpQuery.error ? (
                <p className="next-up-status">We couldn&apos;t load recommendations right now.</p>
              ) : nextUpQuery.isLoading ? (
                <p className="next-up-status">Finding your next picks…</p>
              ) : nextUpQuery.data && nextUpQuery.data.length > 0 ? (
                <ol className="next-up-list">
                  {nextUpQuery.data.map((item) => (
                    <li key={item.id} className="next-up-item">
                      <div className="next-up-item-row">
                        <span className="next-up-icon" aria-hidden="true">
                          {getMediaIcon(item.mediaType)}
                        </span>
                        <div className="next-up-text">
                          <span className="next-up-title">{item.title}</span>
                          <span className="next-up-status-label">{formatStatus(item.tracking?.status)}</span>
                        </div>
                      </div>
                      <p className="next-up-hint">{describeNextUp(item)}</p>
                    </li>
                  ))}
                </ol>
              ) : (
                <div className="next-up-empty">
                  <p>You&apos;re all caught up! Update progress to see fresh picks.</p>
                </div>
              )}
            </div>
          </section>

          <section className="search-section" aria-labelledby={librarySearchHeadingId}>
            <div className="search-section-header">
              <h2 id={librarySearchHeadingId}>Filter your library</h2>
            </div>
            <label className="field-label" htmlFor={librarySearchInputId}>
              Search by title, author, or director
            </label>
            <input
              id={librarySearchInputId}
              type="text"
              className="search-input"
              placeholder="🔍 Search by title, author, or director..."
              value={librarySearchQuery}
              onChange={(e) => setLibrarySearchQuery(e.target.value)}
            />

            <div className="filter-row">
              <div className="filter-field">
                <label htmlFor={statusFilterId}>Status filter</label>
                <select
                  id={statusFilterId}
                  className="filter-select"
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
                >
                  <option value="all">All status</option>
                  <option value="to_watch">To watch/read</option>
                  <option value="watching">Currently watching/reading</option>
                  <option value="completed">Completed</option>
                  <option value="on_hold">On hold</option>
                  <option value="dropped">Dropped</option>
                </select>
              </div>

              <div className="filter-field">
                <label htmlFor={typeFilterId}>Type filter</label>
                <select
                  id={typeFilterId}
                  className="filter-select"
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as TypeFilter)}
                >
                  <option value="all">All types</option>
                  <option value="movie">🎬 Movies</option>
                  <option value="tv_show">📺 TV Shows</option>
                  <option value="book">📚 Books</option>
                </select>
              </div>
            </div>
          </section>

          <div className="media-list">
            {filteredMediaItems.length === 0 ? (
              mediaQuery.data && mediaQuery.data.length === 0 ? (
                <div className="empty-state">
                  <p>📚 Your media library is empty</p>
                  <p>Add some movies, TV shows, or books to get started!</p>
                </div>
              ) : (
                <div className="empty-state">
                  <p>🔍 No matches found</p>
                  <p>Try adjusting your search or filters</p>
                </div>
              )
            ) : (
              filteredMediaItems.map((item) => (
                <div key={item.id} className="media-item">
                  <div className="media-header">
                    <span className="media-icon">{getMediaIcon(item.mediaType)}</span>
                    <h3>{item.title}</h3>
                  </div>

                  <div className="media-details">
                    <span className="status-badge" style={{ backgroundColor: getStatusColor(item.tracking?.status) }}>
                      {formatStatus(item.tracking?.status)}
                    </span>
                    {item.tracking?.rating && (
                      <span className="rating">⭐ {item.tracking.rating}/10</span>
                    )}
                  </div>

                  {item.tracking?.notes && <p className="notes">{item.tracking.notes}</p>}

                  <div className="item-actions">
                    <select
                      value={item.tracking?.status ?? 'to_watch'}
                      onChange={(e) => handleStatusChange(item, e.target.value as MediaTracking['status'])}
                      className="status-select"
                      disabled={updateTrackingMutation.isPending}
                    >
                      <option value="to_watch">To Watch/Read</option>
                      <option value="watching">Currently Watching/Reading</option>
                      <option value="completed">Completed</option>
                      <option value="on_hold">On Hold</option>
                      <option value="dropped">Dropped</option>
                    </select>

                    <input
                      type="number"
                      placeholder="Rate 1-10"
                      value={item.tracking?.rating ?? ''}
                      onChange={(e) => handleRatingChange(item, e.target.value)}
                      min="1"
                      max="10"
                      step="0.1"
                      className="rating-input"
                    />
                  </div>

                  <small className="date">Added: {new Date(item.createdAt).toLocaleDateString()}</small>
                </div>
              ))
            )}
          </div>
        </main>
      )}

      {activeTab === 'search' && (
        <main className="main">
          <section className="search-screen" aria-labelledby={searchScreenHeadingId}>
            <h2 id={searchScreenHeadingId}>Search your library</h2>
            <p id={searchScreenHelperId} className="search-screen-helper">
              Results are ranked so the best matches appear first—even if your spelling is a little off.
            </p>
            <label className="field-label" htmlFor={globalSearchInputId}>
              Search query
            </label>
            <input
              id={globalSearchInputId}
              type="search"
              className="search-input"
              placeholder={'Try "Stranger Things" or "Dune"'}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              aria-describedby={searchScreenHelperId}
              autoComplete="off"
            />

            <div className="search-screen-status" aria-live="polite">
              {trimmedSearchTerm.length === 0 ? (
                <p>Start typing to search across your saved items.</p>
              ) : searchResultsQuery.isLoading ? (
                <p>Searching your library…</p>
              ) : searchResultsQuery.error ? (
                <p>We couldn&apos;t run that search. Please try again.</p>
              ) : searchResultsQuery.data && searchResultsQuery.data.length > 0 ? (
                <>
                  <p className="search-result-count">
                    Showing {searchResultsQuery.data.length}{' '}
                    {searchResultsQuery.data.length === 1 ? 'result' : 'results'} for “{trimmedSearchTerm}”.
                  </p>
                  {searchResultsQuery.isFetching && !searchResultsQuery.isLoading && (
                    <p className="search-result-refresh" role="status">
                      Refreshing results…
                    </p>
                  )}
                  <ul className="search-results">
                    {searchResultsQuery.data.map((item) => (
                      <li key={item.id} className="search-result-item">
                        <div className="search-result-row">
                          <span className="search-result-icon" aria-hidden="true">
                            {getMediaIcon(item.mediaType)}
                          </span>
                          <div className="search-result-text">
                            <span className="search-result-title">{item.title}</span>
                            <span className="search-result-meta">{formatStatus(item.tracking?.status)}</span>
                          </div>
                        </div>
                        {item.tracking?.notes && <p className="search-result-notes">{item.tracking.notes}</p>}
                      </li>
                    ))}
                  </ul>
                </>
              ) : (
                <p>
                  No saved items match “{trimmedSearchTerm}”. Try another spelling or add it from Quick Add.
                </p>
              )}
            </div>
          </section>
        </main>
      )}

      {activeTab === 'stats' && (
        <main className="main">
          <div className="stats">
            <h2>📊 Your Stats</h2>
            {statsQuery.data ? (
              <div className="stats-grid">
                <div className="stat-card">
                  <h3>{statsQuery.data.totalItems}</h3>
                  <p>Total Items</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.completed}</h3>
                  <p>Completed</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.watching}</h3>
                  <p>Currently Watching/Reading</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.toWatch}</h3>
                  <p>To Watch</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.onHold}</h3>
                  <p>On Hold</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.dropped}</h3>
                  <p>Dropped</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.movies}</h3>
                  <p>Movies</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.tvShows}</h3>
                  <p>TV Shows</p>
                </div>
                <div className="stat-card">
                  <h3>{statsQuery.data.books}</h3>
                  <p>Books</p>
                </div>
              </div>
            ) : (
              <div className="loading">
                <p>Loading your statistics...</p>
              </div>
            )}
          </div>
        </main>
      )}
    </div>
  );
}

export default App;

import { z } from 'zod';
import {
  createMediaSchema as serverCreateMediaSchema,
  updateTrackingSchema as serverUpdateTrackingSchema,
  mediaTypeSchema,
  statusSchema,
  statsSchema as serverStatsSchema,
} from '../../shared/schemas/index.js';

const API_BASE = '/api/v1';

const isoDateSchema = z.string().min(1);

const trackingResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  mediaItemId: z.number(),
  status: statusSchema,
  rating: z.union([z.string(), z.number()]).nullable().optional(),
  progress: z.number(),
  notes: z.string().nullable(),
  completedDate: z.string().nullable(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
});

const parseRating = (value: unknown): number | null => {
  if (value === null || value === undefined || value === '') {
    return null;
  }

  const numeric = typeof value === 'number' ? value : Number(value);
  return Number.isNaN(numeric) ? null : numeric;
};

const trackingSchema = trackingResponseSchema.transform((tracking) => ({
  ...tracking,
  rating: parseRating(tracking.rating),
}));

const mediaItemResponseSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  mediaType: mediaTypeSchema,
  description: z.string().nullable(),
  author: z.string().nullable(),
  director: z.string().nullable(),
  genres: z.string().nullable(),
  imageUrl: z.string().nullable().optional(),
  releaseDate: z.string().nullable().optional(),
  createdAt: isoDateSchema,
  updatedAt: isoDateSchema,
  tracking: trackingResponseSchema.nullable(),
});

const mediaItemSchema = mediaItemResponseSchema.transform((item) => ({
  ...item,
  tracking: item.tracking ? trackingSchema.parse(item.tracking) : null,
}));

const mediaListSchema = z.array(mediaItemSchema);

const statsSchema = serverStatsSchema;

const importSearchResultSchema = z.object({
  title: z.string(),
  year: z.string().nullable().optional(),
  poster: z.string().nullable().optional(),
  external_id: z.string(),
});

const importApplyInputSchema = z.object({
  title: z.string(),
  year: z.string().nullable().optional(),
  poster: z.string().nullable().optional(),
  external_id: z.string(),
  type: z.enum(['movie', 'tv_show', 'book']),
});

const importSearchResultListSchema = z.array(importSearchResultSchema);

const searchResultsSchema = z.array(mediaItemSchema);

const nextUpSchema = z.array(mediaItemSchema);

const createMediaInputSchema = serverCreateMediaSchema.pick({
  title: true,
  mediaType: true,
  status: true,
  rating: true,
  notes: true,
  description: true,
  author: true,
  director: true,
  genres: true,
  progress: true,
});

const updateTrackingInputSchema = serverUpdateTrackingSchema.pick({
  status: true,
  rating: true,
  notes: true,
  progress: true,
});

export type MediaTracking = z.infer<typeof trackingSchema>;
export type MediaItem = z.infer<typeof mediaItemSchema>;
export type MediaList = z.infer<typeof mediaListSchema>;
export type MediaStats = z.infer<typeof statsSchema>;
export type CreateMediaInput = z.infer<typeof createMediaInputSchema>;
export type UpdateTrackingInput = z.infer<typeof updateTrackingInputSchema>;
export type ImportSearchResult = z.infer<typeof importSearchResultSchema>;
export type ImportApplyInput = z.infer<typeof importApplyInputSchema>;
export type SearchResultItem = z.infer<typeof mediaItemSchema>;
export type NextUpItem = z.infer<typeof mediaItemSchema>;

interface ApiRequestOptions<TBody> {
  endpoint: string;
  method?: 'GET' | 'POST' | 'PUT';
  body?: TBody;
  signal?: AbortSignal;
}

const sanitizePayload = (payload: Record<string, unknown>) => {
  const sanitizedEntries = Object.entries(payload).filter(([, value]) => value !== undefined);
  return Object.fromEntries(sanitizedEntries);
};

async function apiCall<TResponse, TBody = unknown>(
  options: ApiRequestOptions<TBody>,
  parser: z.ZodType<TResponse>,
): Promise<TResponse> {
  const { endpoint, method = 'GET', body, signal } = options;
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };
  
  if (method === 'POST' || method === 'PUT') {
    headers['Idempotency-Key'] = crypto.randomUUID();
  }
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
    signal,
  });

  if (!response.ok) {
    const error = new Error(`Request failed with status ${response.status}`);
    (error as Error & { status?: number }).status = response.status;
    throw error;
  }

  const json = await response.json();
  return parser.parse(json);
}

const normalizeCreateInput = (input: CreateMediaInput) => {
  const payload: Record<string, unknown> = {
    ...input,
  };

  if (payload.rating === '' || payload.rating === undefined) {
    payload.rating = null;
  }

  if (payload.notes === '') {
    payload.notes = undefined;
  }

  return sanitizePayload(payload);
};

const normalizeTrackingInput = (input: UpdateTrackingInput) => {
  const payload: Record<string, unknown> = {
    ...input,
  };

  if (payload.rating === '') {
    payload.rating = null;
  }

  if (payload.notes === '') {
    payload.notes = undefined;
  }

  return sanitizePayload(payload);
};

export const mediaApi = {
  list: (signal?: AbortSignal) => apiCall({ endpoint: '/media', signal }, mediaListSchema),
  create: (input: CreateMediaInput) =>
    apiCall(
      {
        endpoint: '/media',
        method: 'POST',
        body: normalizeCreateInput(createMediaInputSchema.parse(input)),
      },
      mediaItemSchema,
    ),
  updateTracking: (mediaId: number, input: UpdateTrackingInput) =>
    apiCall(
      {
        endpoint: `/media/${mediaId}/tracking`,
        method: 'PUT',
        body: normalizeTrackingInput(updateTrackingInputSchema.parse(input)),
      },
      trackingSchema,
    ),
  stats: () => apiCall({ endpoint: '/stats' }, statsSchema),
};

export type MediaQueryKey = ['media'];
export type StatsQueryKey = ['stats'];

export const mediaQueryKey: MediaQueryKey = ['media'];
export const statsQueryKey: StatsQueryKey = ['stats'];

export type NextQueryKey = ['next'];
export type SearchQueryKey = ['search', string];

const buildSearchEndpoint = (path: string, params: Record<string, string>) => {
  const searchParams = new URLSearchParams(params);
  return `${path}?${searchParams.toString()}`;
};

export const importApi = {
  search: (query: string, type: 'movie' | 'tv' | 'book', signal?: AbortSignal) =>
    apiCall(
      {
        endpoint: buildSearchEndpoint('/import/search', { query, type }),
        signal,
      },
      importSearchResultListSchema,
    ),
  apply: (input: ImportApplyInput) =>
    apiCall(
      {
        endpoint: '/import/apply',
        method: 'POST',
        body: importApplyInputSchema.parse(input),
      },
      mediaItemSchema,
    ),
};

export const searchApi = {
  search: (query: string, signal?: AbortSignal) =>
    apiCall(
      {
        endpoint: buildSearchEndpoint('/search', { q: query }),
        signal,
      },
      searchResultsSchema,
    ),
};

export const nextApi = {
  list: (signal?: AbortSignal) => apiCall({ endpoint: '/next', signal }, nextUpSchema),
};

export const nextQueryKey: NextQueryKey = ['next'];
export const buildSearchQueryKey = (query: string): SearchQueryKey => ['search', query];

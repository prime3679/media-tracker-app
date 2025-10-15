import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import './App.css';
import {
  mediaApi,
  mediaQueryKey,
  statsQueryKey,
  type CreateMediaInput,
  type MediaItem,
  type MediaList,
  type MediaStats,
  type MediaTracking,
  type UpdateTrackingInput,
} from './services/api';
import { syncStore } from './lib/syncStore';

type Tab = 'library' | 'stats';
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
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<StatusFilter>('all');
  const [filterType, setFilterType] = useState<TypeFilter>('all');
  const [formData, setFormData] = useState<FormState>(INITIAL_FORM_STATE);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [loadErrorDismissed, setLoadErrorDismissed] = useState(false);
  const [syncPending, setSyncPending] = useState(0);

  const queryClient = useQueryClient();

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

  const createMediaMutation = useMutation<MediaItem, MutationError, CreateMediaInput, CreateMediaContext>({
    mutationFn: (input) => mediaApi.create(input),
    onMutate: async (input) => {
      setErrorMessage(null);
      setLoadErrorDismissed(false);
      await queryClient.cancelQueries({ queryKey: mediaQueryKey });
      await queryClient.cancelQueries({ queryKey: statsQueryKey });

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
    },
  });

  const updateTrackingMutation = useMutation<MediaTracking, MutationError, UpdateTrackingPayload, UpdateTrackingContext>({
    mutationFn: ({ mediaId, data }) => mediaApi.updateTracking(mediaId, data),
    onMutate: async ({ mediaId, data }) => {
      setErrorMessage(null);
      setLoadErrorDismissed(false);
      await queryClient.cancelQueries({ queryKey: mediaQueryKey });
      await queryClient.cancelQueries({ queryKey: statsQueryKey });

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
      const matchesSearch =
        searchQuery.trim() === '' ||
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.author?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.director?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesStatus =
        filterStatus === 'all' || item.tracking?.status === filterStatus;

      const matchesType = filterType === 'all' || item.mediaType === filterType;

      return matchesSearch && matchesStatus && matchesType;
    });
  }, [mediaQuery.data, searchQuery, filterStatus, filterType]);

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

  const formatStatus = (status: MediaTracking['status'] | undefined) =>
    status?.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) ?? 'Unknown';

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
        >
          📚 Library
        </button>
        <button
          className={activeTab === 'stats' ? 'tab active' : 'tab'}
          onClick={() => setActiveTab('stats')}
        >
          📊 Stats
        </button>
      </nav>

      {activeTab === 'library' && (
        <main className="main">
          <div className="add-section">
            <button className="add-button" onClick={() => setShowAddForm(!showAddForm)}>
              {showAddForm ? '✕ Cancel' : '+ Add Media'}
            </button>
          </div>

          <div className="search-section">
            <input
              type="text"
              className="search-input"
              placeholder="🔍 Search by title, author, or director..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />

            <div className="filter-row">
              <select
                className="filter-select"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as StatusFilter)}
              >
                <option value="all">All Status</option>
                <option value="to_watch">To Watch/Read</option>
                <option value="watching">Currently Watching/Reading</option>
                <option value="completed">Completed</option>
                <option value="on_hold">On Hold</option>
                <option value="dropped">Dropped</option>
              </select>

              <select
                className="filter-select"
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as TypeFilter)}
              >
                <option value="all">All Types</option>
                <option value="movie">🎬 Movies</option>
                <option value="tv_show">📺 TV Shows</option>
                <option value="book">📚 Books</option>
              </select>
            </div>
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

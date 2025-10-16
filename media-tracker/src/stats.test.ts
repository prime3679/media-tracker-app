import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  adjustStatsForCreate,
  adjustStatsForStatusChange,
  buildSparklinePath,
  formatRelativeTime,
} from './utils/stats';
import type { MediaItem, MediaStats, MediaTracking } from './services/api';

const baseTracking: MediaTracking = {
  id: 1,
  userId: 1,
  mediaItemId: 1,
  status: 'watching',
  rating: null,
  progress: 0,
  notes: null,
  episodeId: null,
  completedDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
};

const baseItem: MediaItem = {
  id: 1,
  userId: 1,
  title: 'Sample Show',
  mediaType: 'tv_show',
  description: null,
  author: null,
  director: null,
  genres: null,
  imageUrl: null,
  releaseDate: null,
  createdAt: '2024-01-01T00:00:00.000Z',
  updatedAt: '2024-01-01T00:00:00.000Z',
  tracking: { ...baseTracking },
};

const baseStats: MediaStats = {
  totalItems: 3,
  completed: 1,
  watching: 1,
  toWatch: 1,
  onHold: 0,
  dropped: 0,
  movies: 1,
  tvShows: 1,
  books: 1,
  completionVelocity: 2,
  streakDays: 4,
  genreGravity: [],
};

afterEach(() => {
  vi.useRealTimers();
});

describe('stats helpers', () => {
  it('adjustStatsForCreate increases counts for new items', () => {
    const result = adjustStatsForCreate(baseStats, baseItem);
    expect(result.totalItems).toBe(baseStats.totalItems + 1);
    expect(result.tvShows).toBe(baseStats.tvShows + 1);
    expect(result.watching).toBe(baseStats.watching + 1);
  });

  it('adjustStatsForStatusChange updates status tallies', () => {
    const watchingToCompleted = adjustStatsForStatusChange(baseStats, 'watching', 'completed');
    expect(watchingToCompleted.watching).toBe(baseStats.watching - 1);
    expect(watchingToCompleted.completed).toBe(baseStats.completed + 1);

    const completedToWatching = adjustStatsForStatusChange(baseStats, 'completed', 'watching');
    expect(completedToWatching.completed).toBe(Math.max(0, baseStats.completed - 1));
    expect(completedToWatching.watching).toBe(baseStats.watching + 1);
  });

  it('buildSparklinePath generates an SVG path for weekly velocity', () => {
    const path = buildSparklinePath([0, 2, 4], 120, 36);
    expect(path).toBe('M0.00,36.00 L60.00,18.00 L120.00,0.00');
  });

  it('formatRelativeTime produces human friendly strings', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-08T12:00:00.000Z'));

    expect(formatRelativeTime('2024-01-08T11:55:00.000Z')).toBe('5m ago');
    expect(formatRelativeTime('2024-01-08T10:00:00.000Z')).toBe('2h ago');
    expect(formatRelativeTime('2024-01-05T12:00:00.000Z')).toBe('3d ago');
    expect(formatRelativeTime('2024-01-08T12:00:00.000Z')).toBe('Just now');
  });
});

import type { MediaItem, MediaStats, MediaTracking } from '../services/api';

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

export const adjustStatsForCreate = (stats: MediaStats, item: MediaItem): MediaStats => {
  const typeKey = TYPE_TO_STATS_KEY[item.mediaType];
  const statusKey = item.tracking ? STATUS_TO_STATS_KEY[item.tracking.status] : 'toWatch';
  const typeValue = Number(stats[typeKey] ?? 0);
  const statusValue = Number(stats[statusKey] ?? 0);

  return {
    ...stats,
    totalItems: stats.totalItems + 1,
    [typeKey]: typeValue + 1,
    [statusKey]: statusValue + 1,
  } satisfies MediaStats;
};

export const adjustStatsForStatusChange = (
  stats: MediaStats,
  previousStatus: MediaTracking['status'],
  nextStatus: MediaTracking['status'],
): MediaStats => {
  if (previousStatus === nextStatus) {
    return stats;
  }

  const prevKey = STATUS_TO_STATS_KEY[previousStatus];
  const nextKey = STATUS_TO_STATS_KEY[nextStatus];
  const prevValue = Number(stats[prevKey] ?? 0);
  const nextValue = Number(stats[nextKey] ?? 0);

  return {
    ...stats,
    [prevKey]: Math.max(0, prevValue - 1),
    [nextKey]: nextValue + 1,
  } satisfies MediaStats;
};

export const buildSparklinePath = (values: number[], width: number, height: number) => {
  if (values.length === 0) {
    return '';
  }

  if (values.length === 1) {
    const value = values[0];
    const maxValue = Math.max(value, 1);
    const y = height - (value / maxValue) * height;
    return `M0 ${height} L${width} ${Number.isFinite(y) ? y : height}`;
  }

  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);
  const range = maxValue - minValue || 1;

  return values
    .map((value, index) => {
      const x = (index / (values.length - 1)) * width;
      const normalized = (value - minValue) / range;
      const y = height - normalized * height;
      const safeY = Number.isFinite(y) ? y : height;
      return `${index === 0 ? 'M' : 'L'}${x.toFixed(2)},${safeY.toFixed(2)}`;
    })
    .join(' ');
};

export const formatRelativeTime = (isoString: string | null | undefined) => {
  if (!isoString) return 'Just now';

  const timestamp = new Date(isoString);
  if (Number.isNaN(timestamp.getTime())) {
    return 'Just now';
  }

  const diffMs = Date.now() - timestamp.getTime();
  const minuteMs = 60 * 1000;
  const hourMs = 60 * minuteMs;
  const dayMs = 24 * hourMs;

  if (diffMs < minuteMs) {
    return 'Just now';
  }

  if (diffMs < hourMs) {
    const minutes = Math.floor(diffMs / minuteMs);
    return `${minutes}m ago`;
  }

  if (diffMs < dayMs) {
    const hours = Math.floor(diffMs / hourMs);
    return `${hours}h ago`;
  }

  const days = Math.floor(diffMs / dayMs);
  return `${days}d ago`;
};

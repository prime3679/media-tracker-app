/**
 * Enhanced Next Up Recommendation Engine
 *
 * This is where the magic happens - intelligent, context-aware recommendations
 * that understand YOUR taste and provide explanations for WHY each item is suggested.
 */

import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { eq, and, gte, desc, sql, inArray } from 'drizzle-orm';

export interface EnhancedNextUpItem {
  id: number;
  userId: number;
  mediaType: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  genres: string | null;
  director: string | null;
  author: string | null;
  isbn: string | null;
  tmdbId: string | null;
  imdbId: string | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  totalPages: number | null;
  createdAt: Date;
  updatedAt: Date;
  tracking: typeof mediaTracking.$inferSelect | null;

  // Enhanced fields
  matchScore: number;          // 0-100 percentage
  matchReason: string;          // Why this was recommended
  matchedItems: string[];       // Titles of similar items you loved
  suggestedContext: string;     // "Quick evening watch" | "Weekend epic" | etc
  estimatedTime?: string;       // "22 min" | "2h 45m" | "350 pages"
}

interface GenreGravity {
  genre: string;
  completedCount: number;
  droppedCount: number;
  completionRate: number; // 0-1
  weight: number;         // Higher = more relevant
}

interface UserTaste {
  topGenres: GenreGravity[];
  recentCompletions: Array<{
    title: string;
    genres: string[];
    rating: number | null;
  }>;
  averageRating: number;
  completionRate: number; // Overall completion rate
}

/**
 * Main function to get intelligent recommendations
 */
export async function getEnhancedNextUpItems(userId: number): Promise<EnhancedNextUpItem[]> {
  // Step 1: Analyze user taste
  const userTaste = await analyzeUserTaste(userId);

  // Step 2: Get in-progress items (highest priority)
  const inProgress = await getInProgressItems(userId);

  // Step 3: Get smart recommendations for unwatched items
  const recommendations = await getSmartRecommendations(userId, userTaste);

  // Step 4: Combine and limit to top 10
  const combined = [...inProgress, ...recommendations].slice(0, 10);

  return combined;
}

/**
 * Analyze user's viewing patterns and preferences
 */
async function analyzeUserTaste(userId: number): Promise<UserTaste> {
  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  // Get all tracked items
  const allTracked = await db
    .select({
      item: mediaItems,
      tracking: mediaTracking,
    })
    .from(mediaItems)
    .innerJoin(
      mediaTracking,
      and(
        eq(mediaTracking.mediaItemId, mediaItems.id),
        eq(mediaTracking.userId, userId)
      )
    )
    .where(eq(mediaItems.userId, userId));

  // Calculate genre gravity (which genres do you actually complete?)
  const genreStats = new Map<string, { completed: number; dropped: number; total: number }>();

  for (const { item, tracking } of allTracked) {
    if (!item.genres) continue;

    const genres = parseGenres(item.genres);
    for (const genre of genres) {
      if (!genreStats.has(genre)) {
        genreStats.set(genre, { completed: 0, dropped: 0, total: 0 });
      }
      const stats = genreStats.get(genre)!;
      stats.total++;

      if (tracking.status === 'completed') {
        stats.completed++;
      } else if (tracking.status === 'dropped') {
        stats.dropped++;
      }
    }
  }

  // Convert to GenreGravity with weights
  const topGenres: GenreGravity[] = Array.from(genreStats.entries())
    .map(([genre, stats]) => {
      const completionRate = stats.total > 0 ? stats.completed / stats.total : 0;

      // Weight factors:
      // - High completion rate = good
      // - More completions = better signal
      // - Dropped items = negative signal
      const weight =
        (stats.completed * 10) +           // Base score from completions
        (completionRate * 50) -             // Bonus for high completion rate
        (stats.dropped * 5);                // Penalty for drops

      return {
        genre,
        completedCount: stats.completed,
        droppedCount: stats.dropped,
        completionRate,
        weight,
      };
    })
    .filter(g => g.weight > 0)  // Only genres you actually like
    .sort((a, b) => b.weight - a.weight)
    .slice(0, 5);  // Top 5 genres

  // Get recent completions (last 60 days) for similarity matching
  const recentCompletions = allTracked
    .filter(({ tracking }) => {
      const completedDate = tracking.completedDate ? new Date(tracking.completedDate) : null;
      return tracking.status === 'completed' &&
             completedDate &&
             completedDate >= sixtyDaysAgo;
    })
    .map(({ item, tracking }) => ({
      title: item.title,
      genres: parseGenres(item.genres),
      rating: parseRating(tracking.rating),
    }))
    .sort((a, b) => (b.rating || 0) - (a.rating || 0))
    .slice(0, 10);  // Top 10 recent completions

  // Calculate average rating
  const ratingsSum = recentCompletions.reduce((sum, item) => sum + (item.rating || 0), 0);
  const ratingsCount = recentCompletions.filter(item => item.rating !== null).length;
  const averageRating = ratingsCount > 0 ? ratingsSum / ratingsCount : 7.0;

  // Calculate overall completion rate
  const totalTracked = allTracked.length;
  const totalCompleted = allTracked.filter(({ tracking }) => tracking.status === 'completed').length;
  const completionRate = totalTracked > 0 ? totalCompleted / totalTracked : 0.5;

  return {
    topGenres,
    recentCompletions,
    averageRating,
    completionRate,
  };
}

/**
 * Get items currently in progress (watching)
 */
async function getInProgressItems(userId: number): Promise<EnhancedNextUpItem[]> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const items = await db
    .select({
      item: mediaItems,
      tracking: mediaTracking,
    })
    .from(mediaItems)
    .innerJoin(
      mediaTracking,
      and(
        eq(mediaTracking.mediaItemId, mediaItems.id),
        eq(mediaTracking.userId, userId)
      )
    )
    .where(
      and(
        eq(mediaItems.userId, userId),
        eq(mediaTracking.status, 'watching'),
        gte(mediaTracking.updatedAt, fourteenDaysAgo)
      )
    )
    .orderBy(desc(mediaTracking.updatedAt))
    .limit(3);  // Top 3 in-progress items

  return items.map(({ item, tracking }) => ({
    ...item,
    tracking,
    matchScore: 100,  // In-progress items are always 100% match
    matchReason: 'Continue watching',
    matchedItems: [],
    suggestedContext: getSuggestedContext(item, tracking),
    estimatedTime: getEstimatedTime(item, tracking),
  }));
}

/**
 * Get smart recommendations based on user taste
 */
async function getSmartRecommendations(userId: number, taste: UserTaste): Promise<EnhancedNextUpItem[]> {
  if (taste.topGenres.length === 0) {
    // New user - return recently added items
    return getRecentlyAddedItems(userId);
  }

  // Get all unwatched items
  const unwatchedItems = await db
    .select({
      item: mediaItems,
      tracking: mediaTracking,
    })
    .from(mediaItems)
    .innerJoin(
      mediaTracking,
      and(
        eq(mediaTracking.mediaItemId, mediaItems.id),
        eq(mediaTracking.userId, userId)
      )
    )
    .where(
      and(
        eq(mediaItems.userId, userId),
        eq(mediaTracking.status, 'to_watch')
      )
    );

  // Score each item
  const scoredItems = unwatchedItems.map(({ item, tracking }) => {
    const genres = parseGenres(item.genres);

    // Calculate match score (0-100)
    let score = 0;
    const matchedGenres: string[] = [];

    for (const genre of genres) {
      const genreGravity = taste.topGenres.find(g => g.genre === genre);
      if (genreGravity) {
        score += genreGravity.weight;
        matchedGenres.push(genre);
      }
    }

    // Normalize score to 0-100
    const maxPossibleScore = taste.topGenres[0]?.weight * genres.length || 100;
    const normalizedScore = Math.min(100, Math.round((score / maxPossibleScore) * 100));

    // Find similar items you loved
    const matchedItems = taste.recentCompletions
      .filter(completion => {
        const commonGenres = completion.genres.filter(g => genres.includes(g));
        return commonGenres.length > 0 && (completion.rating || 0) >= 8;
      })
      .slice(0, 3)
      .map(c => c.title);

    // Generate match reason
    const matchReason = generateMatchReason(genres, matchedGenres, taste);

    return {
      ...item,
      tracking,
      matchScore: normalizedScore,
      matchReason,
      matchedItems,
      suggestedContext: getSuggestedContext(item, tracking),
      estimatedTime: getEstimatedTime(item, tracking),
    };
  });

  // Sort by match score and apply diversity
  const sorted = scoredItems.sort((a, b) => b.matchScore - a.matchScore);

  // Apply diversity injection: Don't recommend too many of the same type
  const diversified = applyDiversity(sorted);

  return diversified.slice(0, 7);  // Top 7 recommendations
}

/**
 * Get recently added items for new users
 */
async function getRecentlyAddedItems(userId: number): Promise<EnhancedNextUpItem[]> {
  const items = await db
    .select({
      item: mediaItems,
      tracking: mediaTracking,
    })
    .from(mediaItems)
    .innerJoin(
      mediaTracking,
      and(
        eq(mediaTracking.mediaItemId, mediaItems.id),
        eq(mediaTracking.userId, userId)
      )
    )
    .where(
      and(
        eq(mediaItems.userId, userId),
        eq(mediaTracking.status, 'to_watch')
      )
    )
    .orderBy(desc(mediaItems.createdAt))
    .limit(5);

  return items.map(({ item, tracking }) => ({
    ...item,
    tracking,
    matchScore: 75,  // Default score for new users
    matchReason: 'Recently added to your list',
    matchedItems: [],
    suggestedContext: getSuggestedContext(item, tracking),
    estimatedTime: getEstimatedTime(item, tracking),
  }));
}

/**
 * Apply diversity to prevent echo chambers
 */
function applyDiversity(items: EnhancedNextUpItem[]): EnhancedNextUpItem[] {
  const result: EnhancedNextUpItem[] = [];
  const genreCounts = new Map<string, number>();
  const typeCounts = new Map<string, number>();

  for (const item of items) {
    const genres = parseGenres(item.genres);

    // Check if we've already recommended too many of this type
    const typeCount = typeCounts.get(item.mediaType) || 0;
    if (typeCount >= 3) continue;  // Max 3 of same type

    // Check if we've already recommended too many of this genre
    let tooManyOfGenre = false;
    for (const genre of genres) {
      const count = genreCounts.get(genre) || 0;
      if (count >= 4) {  // Max 4 of same genre
        tooManyOfGenre = true;
        break;
      }
    }

    if (tooManyOfGenre) continue;

    // Add item and update counts
    result.push(item);
    typeCounts.set(item.mediaType, typeCount + 1);
    for (const genre of genres) {
      genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
    }
  }

  return result;
}

/**
 * Generate human-readable match reason
 */
function generateMatchReason(
  itemGenres: string[],
  matchedGenres: string[],
  taste: UserTaste
): string {
  if (matchedGenres.length === 0) {
    return 'Something different to explore';
  }

  if (matchedGenres.length === 1) {
    const genre = matchedGenres[0];
    const gravity = taste.topGenres.find(g => g.genre === genre);
    if (gravity && gravity.completionRate > 0.8) {
      return `You love ${genre.toLowerCase()}`;
    }
    return `Based on your ${genre.toLowerCase()} taste`;
  }

  // Multiple matched genres
  const topTwo = matchedGenres.slice(0, 2);
  return `Perfect for your ${topTwo.join(' + ').toLowerCase()} taste`;
}

/**
 * Suggest best context for watching/reading
 */
function getSuggestedContext(
  item: typeof mediaItems.$inferSelect,
  tracking: typeof mediaTracking.$inferSelect
): string {
  const now = new Date();
  const hour = now.getHours();
  const isWeekend = now.getDay() === 0 || now.getDay() === 6;

  if (item.mediaType === 'tv_show') {
    // Estimate episode length (assume 45min for drama, 22min for comedy/sitcom)
    const genres = parseGenres(item.genres);
    const isComedy = genres.some(g => g.toLowerCase().includes('comedy'));
    const episodeLength = isComedy ? 22 : 45;

    if (episodeLength <= 25) {
      return 'Quick evening watch';
    } else if (isWeekend) {
      return 'Perfect for weekend binging';
    } else {
      return 'Great evening series';
    }
  }

  if (item.mediaType === 'movie') {
    // Estimate runtime (we don't have this data, so use genre heuristics)
    const genres = parseGenres(item.genres);
    const isEpic = genres.some(g => ['Epic', 'Drama', 'Adventure', 'Fantasy'].includes(g));

    if (isEpic && isWeekend) {
      return 'Epic weekend watch';
    } else if (hour >= 20) {
      return 'Perfect evening movie';
    } else if (isWeekend) {
      return 'Weekend entertainment';
    } else {
      return 'Great movie night pick';
    }
  }

  if (item.mediaType === 'book') {
    const pages = item.totalPages || 300;
    if (pages < 200) {
      return 'Quick read';
    } else if (pages > 500) {
      return 'Epic journey ahead';
    } else {
      return 'Engaging read';
    }
  }

  return 'Recommended for you';
}

/**
 * Calculate estimated time
 */
function getEstimatedTime(
  item: typeof mediaItems.$inferSelect,
  tracking: typeof mediaTracking.$inferSelect
): string | undefined {
  if (item.mediaType === 'tv_show' && item.totalEpisodes) {
    const remaining = item.totalEpisodes - (tracking.progress || 0);
    if (remaining === 1) {
      return '1 episode left';
    } else if (remaining <= 5) {
      return `${remaining} episodes left`;
    }
    // Estimate episode length
    const genres = parseGenres(item.genres);
    const isComedy = genres.some(g => g.toLowerCase().includes('comedy'));
    const episodeLength = isComedy ? 22 : 45;
    return `~${episodeLength} min episodes`;
  }

  if (item.mediaType === 'book' && item.totalPages) {
    const remaining = item.totalPages - (tracking.progress || 0);
    if (remaining < 50) {
      return `${remaining} pages left`;
    }
    return `${item.totalPages} pages`;
  }

  // For movies, we don't have runtime data yet
  if (item.mediaType === 'movie') {
    return undefined;
  }

  return undefined;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function parseGenres(genresString: string | null): string[] {
  if (!genresString) return [];

  try {
    const parsed = JSON.parse(genresString);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    return genresString.split(',').map(g => g.trim()).filter(Boolean);
  }

  return [];
}

function parseRating(rating: any): number | null {
  if (rating === null || rating === undefined) return null;
  const num = typeof rating === 'number' ? rating : Number(rating);
  return isNaN(num) ? null : num;
}

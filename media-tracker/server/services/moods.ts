/**
 * Mood Presets - Understanding How Users Feel
 *
 * Each mood has specific criteria that filter and weight recommendations.
 * This makes the app feel like it reads your mind.
 */

export type MoodType =
  | 'cozy_evening'
  | 'adrenaline_rush'
  | 'brain_food'
  | 'quick_laugh'
  | 'epic_journey'
  | 'wind_down';

export interface MoodCriteria {
  name: string;
  emoji: string;
  description: string;

  // Genre preferences
  preferredGenres: string[];
  excludedGenres?: string[];

  // Length constraints (in minutes)
  maxLength?: number;
  minLength?: number;

  // Rating/quality filters
  minRating?: number;

  // Media type preferences
  preferredTypes?: Array<'movie' | 'tv_show' | 'book'>;

  // Time-of-day hints
  bestTimes?: Array<'morning' | 'afternoon' | 'evening' | 'night'>;

  // Additional context
  vibe: string;
  perfect_for: string[];
}

/**
 * Complete mood definitions
 */
export const MOOD_PRESETS: Record<MoodType, MoodCriteria> = {
  cozy_evening: {
    name: 'Cozy Evening',
    emoji: '☕',
    description: 'Warm, feel-good content to unwind with',
    preferredGenres: ['Comedy', 'Romance', 'Animation', 'Family'],
    excludedGenres: ['Horror', 'Thriller', 'War'],
    maxLength: 120, // 2 hours max
    preferredTypes: ['tv_show', 'movie'],
    bestTimes: ['evening', 'night'],
    vibe: 'Comfortable, heartwarming, low-stakes',
    perfect_for: [
      'Relaxing after work',
      'Cuddling up with someone',
      'Winding down before bed',
    ],
  },

  adrenaline_rush: {
    name: 'Adrenaline Rush',
    emoji: '⚡',
    description: 'Intense, fast-paced, edge-of-your-seat excitement',
    preferredGenres: ['Action', 'Thriller', 'Crime', 'Adventure'],
    excludedGenres: ['Romance', 'Drama'],
    minRating: 7.0, // Only good action movies
    preferredTypes: ['movie'],
    bestTimes: ['afternoon', 'evening'],
    vibe: 'High-energy, gripping, explosive',
    perfect_for: [
      'Weekend afternoon energy',
      'Getting pumped up',
      'Escaping reality with intensity',
    ],
  },

  brain_food: {
    name: 'Brain Food',
    emoji: '🧠',
    description: 'Thought-provoking, educational, mind-expanding',
    preferredGenres: ['Documentary', 'History', 'Mystery', 'Sci-Fi', 'Drama'],
    minRating: 7.5, // High quality only
    preferredTypes: ['movie', 'tv_show', 'book'],
    bestTimes: ['morning', 'afternoon'],
    vibe: 'Intellectual, engaging, meaningful',
    perfect_for: [
      'Learning something new',
      'Deep thinking sessions',
      'Expanding your perspective',
    ],
  },

  quick_laugh: {
    name: 'Quick Laugh',
    emoji: '😂',
    description: 'Short, funny content for instant mood boost',
    preferredGenres: ['Comedy'],
    maxLength: 30, // 30 minutes max
    preferredTypes: ['tv_show'], // TV episodes are perfect
    bestTimes: ['afternoon', 'evening'],
    vibe: 'Light, hilarious, easy-watching',
    perfect_for: [
      'Lunch break entertainment',
      'Quick mood lift',
      'Background while cooking',
    ],
  },

  epic_journey: {
    name: 'Epic Journey',
    emoji: '🌟',
    description: 'Grand, immersive storytelling for the long haul',
    preferredGenres: ['Fantasy', 'Adventure', 'Sci-Fi', 'Epic', 'Drama'],
    minLength: 150, // 2.5+ hours
    minRating: 7.5,
    preferredTypes: ['movie'],
    bestTimes: ['afternoon', 'evening'],
    vibe: 'Grand, sweeping, immersive',
    perfect_for: [
      'Weekend movie marathons',
      'When you have time to commit',
      'Getting lost in another world',
    ],
  },

  wind_down: {
    name: 'Wind Down',
    emoji: '😴',
    description: 'Calm, low-stakes content for before sleep',
    preferredGenres: ['Animation', 'Comedy', 'Documentary', 'Family'],
    excludedGenres: ['Horror', 'Thriller', 'Action'],
    maxLength: 45, // Short episodes
    preferredTypes: ['tv_show'],
    bestTimes: ['night'],
    vibe: 'Soothing, gentle, non-intense',
    perfect_for: [
      'Before bedtime',
      'Calming anxiety',
      'Peaceful evening ritual',
    ],
  },
};

/**
 * Get current time of day
 */
export function getCurrentTimeOfDay(): 'morning' | 'afternoon' | 'evening' | 'night' {
  const hour = new Date().getHours();

  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

/**
 * Get mood suggestions based on time of day
 */
export function getMoodSuggestionsForNow(): MoodType[] {
  const currentTime = getCurrentTimeOfDay();

  return (Object.entries(MOOD_PRESETS) as [MoodType, MoodCriteria][])
    .filter(([, criteria]) =>
      !criteria.bestTimes || criteria.bestTimes.includes(currentTime)
    )
    .map(([mood]) => mood);
}

/**
 * Calculate mood match score for an item
 * Returns 0-100 score indicating how well the item fits the mood
 */
export function calculateMoodMatchScore(
  item: {
    genres: string[];
    mediaType: string;
    totalEpisodes?: number | null;
    rating?: number | null;
  },
  mood: MoodType
): number {
  const criteria = MOOD_PRESETS[mood];
  let score = 50; // Base score

  // Genre matching (biggest factor)
  const itemGenres = item.genres.map(g => g.toLowerCase());
  const preferredGenres = criteria.preferredGenres.map(g => g.toLowerCase());
  const excludedGenres = (criteria.excludedGenres || []).map(g => g.toLowerCase());

  // Check excluded genres (instant disqualification or heavy penalty)
  const hasExcludedGenre = excludedGenres.some(eg => itemGenres.includes(eg));
  if (hasExcludedGenre) {
    score -= 40;
  }

  // Count matching preferred genres
  const matchingGenres = itemGenres.filter(ig => preferredGenres.includes(ig)).length;
  score += matchingGenres * 15; // +15 per matching genre

  // Media type preference
  if (criteria.preferredTypes) {
    const isPreferredType = criteria.preferredTypes.includes(item.mediaType as any);
    score += isPreferredType ? 10 : -5;
  }

  // Rating filter
  if (criteria.minRating && item.rating) {
    if (item.rating >= criteria.minRating) {
      score += 10;
    } else {
      score -= 20;
    }
  }

  // Length constraints (estimated)
  // For TV shows, use episode count as proxy (assume 45min episodes)
  if (item.mediaType === 'tv_show' && item.totalEpisodes) {
    const estimatedMinutes = item.totalEpisodes * 45;

    if (criteria.maxLength && estimatedMinutes > criteria.maxLength) {
      score -= 15;
    }
    if (criteria.minLength && estimatedMinutes < criteria.minLength) {
      score -= 15;
    }
  }

  // Clamp score between 0 and 100
  return Math.max(0, Math.min(100, score));
}

/**
 * Get mood-specific context string
 */
export function getMoodContext(mood: MoodType): string {
  const criteria = MOOD_PRESETS[mood];
  return `Perfect for: ${criteria.perfect_for[0]}`;
}

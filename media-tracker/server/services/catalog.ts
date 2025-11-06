/**
 * Discovery Catalog Service
 *
 * Browse and search the shared catalog of curated movies and TV shows.
 * Supports filtering by mood, decade, genre, and intelligent sorting.
 */

import { db } from '../db.js';
import { discoveryCatalog } from '../../shared/schema.js';
import { and, eq, gte, lte, desc, asc, sql, or, like } from 'drizzle-orm';
import { type MoodType, MOOD_PRESETS } from './moods.js';

export interface CatalogFilters {
  mediaType?: 'movie' | 'tv_show' | 'book';
  mood?: MoodType;
  decade?: number; // 1970, 1980, 1990, etc.
  genre?: string;
  country?: string;
  minRating?: number;
  search?: string;
  sortBy?: 'rating' | 'year' | 'popularity' | 'title';
  sortOrder?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

export interface CatalogItem {
  id: number;
  mediaType: 'movie' | 'tv_show' | 'book';
  title: string;
  description: string | null;
  imageUrl: string | null;
  backdropUrl: string | null;
  trailerUrl: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  genres: string | null; // JSON array
  director: string | null;
  cast: string | null; // JSON array
  author: string | null;
  country: string | null;
  language: string | null;
  tmdbId: string | null;
  imdbId: string | null;
  tmdbRating: string | null;
  popularityScore: number | null;
  runtime: number | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  curatedReason: string | null;
}

/**
 * Browse the discovery catalog with filters
 */
export async function browseCatalog(filters: CatalogFilters = {}): Promise<CatalogItem[]> {
  const {
    mediaType,
    mood,
    decade,
    genre,
    country,
    minRating,
    search,
    sortBy = 'popularity',
    sortOrder = 'desc',
    limit = 50,
    offset = 0,
  } = filters;

  // Build WHERE conditions
  const conditions = [];

  if (mediaType) {
    conditions.push(eq(discoveryCatalog.mediaType, mediaType));
  }

  // Mood filtering
  if (mood) {
    const moodCriteria = MOOD_PRESETS[mood];

    // Filter by preferred genres (if item has at least one preferred genre)
    if (moodCriteria.preferredGenres && moodCriteria.preferredGenres.length > 0) {
      const genreConditions = moodCriteria.preferredGenres.map(g =>
        sql`${discoveryCatalog.genres}::text ILIKE ${'%' + g + '%'}`
      );
      conditions.push(or(...genreConditions));
    }

    // Exclude genres
    if (moodCriteria.excludedGenres && moodCriteria.excludedGenres.length > 0) {
      for (const excludedGenre of moodCriteria.excludedGenres) {
        conditions.push(
          sql`${discoveryCatalog.genres}::text NOT ILIKE ${'%' + excludedGenre + '%'}`
        );
      }
    }

    // Length constraints
    if (moodCriteria.maxLength) {
      conditions.push(lte(discoveryCatalog.runtime, moodCriteria.maxLength));
    }
    if (moodCriteria.minLength) {
      conditions.push(gte(discoveryCatalog.runtime, moodCriteria.minLength));
    }

    // Rating filters
    if (moodCriteria.minRating) {
      conditions.push(gte(discoveryCatalog.tmdbRating, moodCriteria.minRating.toString()));
    }
  }

  // Decade filtering
  if (decade) {
    conditions.push(gte(discoveryCatalog.releaseYear, decade));
    conditions.push(lte(discoveryCatalog.releaseYear, decade + 9));
  }

  // Genre filtering (simple text search in JSON)
  if (genre) {
    conditions.push(sql`${discoveryCatalog.genres}::text ILIKE ${'%' + genre + '%'}`);
  }

  // Country filtering
  if (country) {
    conditions.push(eq(discoveryCatalog.country, country));
  }

  // Min rating
  if (minRating) {
    conditions.push(gte(discoveryCatalog.tmdbRating, minRating.toString()));
  }

  // Search query (title, director, author)
  if (search) {
    const searchPattern = `%${search}%`;
    conditions.push(
      or(
        like(discoveryCatalog.title, searchPattern),
        like(discoveryCatalog.director, searchPattern),
        like(discoveryCatalog.author, searchPattern)
      )
    );
  }

  // Build ORDER BY clause
  let orderByClause;
  switch (sortBy) {
    case 'rating':
      orderByClause = sortOrder === 'asc'
        ? asc(discoveryCatalog.tmdbRating)
        : desc(discoveryCatalog.tmdbRating);
      break;
    case 'year':
      orderByClause = sortOrder === 'asc'
        ? asc(discoveryCatalog.releaseYear)
        : desc(discoveryCatalog.releaseYear);
      break;
    case 'title':
      orderByClause = sortOrder === 'asc'
        ? asc(discoveryCatalog.title)
        : desc(discoveryCatalog.title);
      break;
    case 'popularity':
    default:
      orderByClause = sortOrder === 'asc'
        ? asc(discoveryCatalog.popularityScore)
        : desc(discoveryCatalog.popularityScore);
      break;
  }

  // Execute query
  const query = db
    .select()
    .from(discoveryCatalog)
    .where(conditions.length > 0 ? and(...conditions) : undefined)
    .orderBy(orderByClause)
    .limit(limit)
    .offset(offset);

  const results = await query;
  return results as CatalogItem[];
}

/**
 * Get a single catalog item by ID
 */
export async function getCatalogItem(id: number): Promise<CatalogItem | null> {
  const results = await db
    .select()
    .from(discoveryCatalog)
    .where(eq(discoveryCatalog.id, id))
    .limit(1);

  return results[0] as CatalogItem || null;
}

/**
 * Get available genres from the catalog
 */
export async function getCatalogGenres(): Promise<string[]> {
  const results = await db
    .select({ genres: discoveryCatalog.genres })
    .from(discoveryCatalog)
    .where(sql`${discoveryCatalog.genres} IS NOT NULL`);

  // Extract and deduplicate genres
  const genresSet = new Set<string>();

  for (const row of results) {
    if (row.genres) {
      try {
        const genreArray = JSON.parse(row.genres);
        if (Array.isArray(genreArray)) {
          genreArray.forEach(g => genresSet.add(g));
        }
      } catch {
        // Skip invalid JSON
      }
    }
  }

  return Array.from(genresSet).sort();
}

/**
 * Get available decades from the catalog
 */
export async function getCatalogDecades(): Promise<number[]> {
  const results = await db
    .select({
      decade: sql<number>`FLOOR(${discoveryCatalog.releaseYear} / 10) * 10`
    })
    .from(discoveryCatalog)
    .where(sql`${discoveryCatalog.releaseYear} IS NOT NULL`)
    .groupBy(sql`FLOOR(${discoveryCatalog.releaseYear} / 10) * 10`)
    .orderBy(desc(sql`FLOOR(${discoveryCatalog.releaseYear} / 10) * 10`));

  return results.map(r => r.decade).filter(d => d !== null);
}

/**
 * Get catalog statistics
 */
export async function getCatalogStats() {
  const results = await db
    .select({
      mediaType: discoveryCatalog.mediaType,
      count: sql<number>`COUNT(*)`,
      avgRating: sql<number>`AVG(${discoveryCatalog.tmdbRating}::numeric)`,
    })
    .from(discoveryCatalog)
    .groupBy(discoveryCatalog.mediaType);

  return results;
}

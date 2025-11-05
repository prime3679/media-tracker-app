#!/usr/bin/env tsx
/**
 * Discovery Catalog Seeding Script
 *
 * Seeds the discovery_catalog table with curated movies and TV shows from TMDB.
 * This creates a shared pool of content for discovery challenges and recommendations.
 *
 * Usage:
 *   npm run seed:catalog
 *   npm run seed:catalog -- --movies-only
 *   npm run seed:catalog -- --tv-only
 *   npm run seed:catalog -- --limit 50
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { discoveryCatalog, type InsertDiscoveryCatalogItem } from '../../shared/schema';
import { eq } from 'drizzle-orm';

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';

// Rate limiting
let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 250;

interface TMDBMovie {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genre_ids: number[];
  vote_average: number;
  popularity: number;
  original_language: string;
}

interface TMDBMovieDetails {
  id: number;
  title: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date: string;
  genres: { id: number; name: string }[];
  vote_average: number;
  popularity: number;
  runtime: number | null;
  original_language: string;
  production_countries: { iso_3166_1: string; name: string }[];
  imdb_id: string | null;
  credits?: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
}

interface TMDBTVShow {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genre_ids: number[];
  vote_average: number;
  popularity: number;
  original_language: string;
}

interface TMDBTVDetails {
  id: number;
  name: string;
  overview: string;
  poster_path: string | null;
  backdrop_path: string | null;
  first_air_date: string;
  genres: { id: number; name: string }[];
  vote_average: number;
  popularity: number;
  episode_run_time: number[];
  original_language: string;
  production_countries: { iso_3166_1: string; name: string }[];
  number_of_seasons: number;
  number_of_episodes: number;
  credits?: {
    cast: { name: string; order: number }[];
    crew: { name: string; job: string }[];
  };
}

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;

  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }

  lastRequestTime = Date.now();
  return fetch(url);
}

async function fetchTopMovies(limit: number = 250): Promise<TMDBMovie[]> {
  console.log(`📽️  Fetching top ${limit} movies from TMDB...`);

  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const movies: TMDBMovie[] = [];
  const pages = Math.ceil(limit / 20); // TMDB returns 20 per page

  // Fetch from multiple lists for diversity
  const lists = [
    'popular',
    'top_rated',
    'now_playing',
  ];

  for (const list of lists) {
    for (let page = 1; page <= Math.ceil(pages / lists.length); page++) {
      try {
        const url = `${TMDB_BASE_URL}/movie/${list}?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`;
        const response = await rateLimitedFetch(url);

        if (!response.ok) {
          console.error(`Failed to fetch ${list} movies page ${page}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        movies.push(...(data.results || []));

        console.log(`  ✓ Fetched ${list} movies page ${page} (${data.results?.length || 0} items)`);

        if (movies.length >= limit) break;
      } catch (error) {
        console.error(`Error fetching ${list} movies page ${page}:`, error);
      }
    }

    if (movies.length >= limit) break;
  }

  // Deduplicate by ID
  const uniqueMovies = Array.from(
    new Map(movies.map(m => [m.id, m])).values()
  ).slice(0, limit);

  console.log(`  ✓ Fetched ${uniqueMovies.length} unique movies`);
  return uniqueMovies;
}

async function fetchMovieDetails(tmdbId: number): Promise<TMDBMovieDetails | null> {
  try {
    const url = `${TMDB_BASE_URL}/movie/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=en-US`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch movie details for ${tmdbId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching movie details for ${tmdbId}:`, error);
    return null;
  }
}

async function fetchTopTVShows(limit: number = 250): Promise<TMDBTVShow[]> {
  console.log(`📺 Fetching top ${limit} TV shows from TMDB...`);

  if (!TMDB_API_KEY) {
    throw new Error('TMDB_API_KEY not configured');
  }

  const shows: TMDBTVShow[] = [];
  const pages = Math.ceil(limit / 20);

  const lists = [
    'popular',
    'top_rated',
    'on_the_air',
  ];

  for (const list of lists) {
    for (let page = 1; page <= Math.ceil(pages / lists.length); page++) {
      try {
        const url = `${TMDB_BASE_URL}/tv/${list}?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`;
        const response = await rateLimitedFetch(url);

        if (!response.ok) {
          console.error(`Failed to fetch ${list} TV shows page ${page}: ${response.status}`);
          continue;
        }

        const data = await response.json();
        shows.push(...(data.results || []));

        console.log(`  ✓ Fetched ${list} TV shows page ${page} (${data.results?.length || 0} items)`);

        if (shows.length >= limit) break;
      } catch (error) {
        console.error(`Error fetching ${list} TV shows page ${page}:`, error);
      }
    }

    if (shows.length >= limit) break;
  }

  const uniqueShows = Array.from(
    new Map(shows.map(s => [s.id, s])).values()
  ).slice(0, limit);

  console.log(`  ✓ Fetched ${uniqueShows.length} unique TV shows`);
  return uniqueShows;
}

async function fetchTVDetails(tmdbId: number): Promise<TMDBTVDetails | null> {
  try {
    const url = `${TMDB_BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits&language=en-US`;
    const response = await rateLimitedFetch(url);

    if (!response.ok) {
      console.error(`Failed to fetch TV details for ${tmdbId}: ${response.status}`);
      return null;
    }

    return await response.json();
  } catch (error) {
    console.error(`Error fetching TV details for ${tmdbId}:`, error);
    return null;
  }
}

function movieToDiscoveryItem(movie: TMDBMovieDetails, curatedReason: string): InsertDiscoveryCatalogItem {
  const director = movie.credits?.crew.find(c => c.job === 'Director')?.name || null;
  const cast = movie.credits?.cast
    .slice(0, 5)
    .map(c => c.name) || [];
  const country = movie.production_countries[0]?.iso_3166_1 || null;

  return {
    mediaType: 'movie',
    title: movie.title,
    description: movie.overview || null,
    imageUrl: movie.poster_path ? `${TMDB_IMAGE_BASE}${movie.poster_path}` : null,
    backdropUrl: movie.backdrop_path ? `${TMDB_BACKDROP_BASE}${movie.backdrop_path}` : null,
    trailerUrl: null, // TODO: Fetch trailers
    releaseDate: movie.release_date || null,
    releaseYear: movie.release_date ? parseInt(movie.release_date.substring(0, 4)) : null,
    genres: JSON.stringify(movie.genres.map(g => g.name)),
    director: director,
    cast: JSON.stringify(cast),
    author: null,
    country: country,
    language: movie.original_language || 'en',
    tmdbId: `tmdb:${movie.id}`,
    imdbId: movie.imdb_id,
    isbn: null,
    tmdbRating: movie.vote_average ? movie.vote_average.toString() : null,
    imdbRating: null,
    popularityScore: Math.round(movie.popularity),
    runtime: movie.runtime,
    totalSeasons: null,
    totalEpisodes: null,
    totalPages: null,
    isCurated: 1,
    curatedReason: curatedReason,
  };
}

function tvShowToDiscoveryItem(show: TMDBTVDetails, curatedReason: string): InsertDiscoveryCatalogItem {
  const cast = show.credits?.cast
    .slice(0, 5)
    .map(c => c.name) || [];
  const country = show.production_countries[0]?.iso_3166_1 || null;
  const avgRuntime = show.episode_run_time.length > 0
    ? Math.round(show.episode_run_time.reduce((a, b) => a + b, 0) / show.episode_run_time.length)
    : null;

  return {
    mediaType: 'tv_show',
    title: show.name,
    description: show.overview || null,
    imageUrl: show.poster_path ? `${TMDB_IMAGE_BASE}${show.poster_path}` : null,
    backdropUrl: show.backdrop_path ? `${TMDB_BACKDROP_BASE}${show.backdrop_path}` : null,
    trailerUrl: null,
    releaseDate: show.first_air_date || null,
    releaseYear: show.first_air_date ? parseInt(show.first_air_date.substring(0, 4)) : null,
    genres: JSON.stringify(show.genres.map(g => g.name)),
    director: null,
    cast: JSON.stringify(cast),
    author: null,
    country: country,
    language: show.original_language || 'en',
    tmdbId: `tmdb:${show.id}`,
    imdbId: null,
    isbn: null,
    tmdbRating: show.vote_average ? show.vote_average.toString() : null,
    imdbRating: null,
    popularityScore: Math.round(show.popularity),
    runtime: avgRuntime,
    totalSeasons: show.number_of_seasons,
    totalEpisodes: show.number_of_episodes,
    totalPages: null,
    isCurated: 1,
    curatedReason: curatedReason,
  };
}

async function seedMovies(db: ReturnType<typeof drizzle>, limit: number) {
  console.log('\n🎬 Seeding Movies...\n');

  const movies = await fetchTopMovies(limit);
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const movie of movies) {
    try {
      // Check if already exists
      const existing = await db
        .select()
        .from(discoveryCatalog)
        .where(eq(discoveryCatalog.tmdbId, `tmdb:${movie.id}`))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      // Fetch full details
      const details = await fetchMovieDetails(movie.id);
      if (!details) {
        failed++;
        continue;
      }

      const curatedReason = `TMDB Popular/Top Rated (${Math.round(details.vote_average * 10)}% score)`;
      const item = movieToDiscoveryItem(details, curatedReason);

      await db.insert(discoveryCatalog).values(item);
      inserted++;

      if (inserted % 10 === 0) {
        console.log(`  ✓ Inserted ${inserted} movies...`);
      }
    } catch (error) {
      console.error(`Error seeding movie ${movie.id}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ Movies seeded: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

async function seedTVShows(db: ReturnType<typeof drizzle>, limit: number) {
  console.log('\n📺 Seeding TV Shows...\n');

  const shows = await fetchTopTVShows(limit);
  let inserted = 0;
  let skipped = 0;
  let failed = 0;

  for (const show of shows) {
    try {
      const existing = await db
        .select()
        .from(discoveryCatalog)
        .where(eq(discoveryCatalog.tmdbId, `tmdb:${show.id}`))
        .limit(1);

      if (existing.length > 0) {
        skipped++;
        continue;
      }

      const details = await fetchTVDetails(show.id);
      if (!details) {
        failed++;
        continue;
      }

      const curatedReason = `TMDB Popular/Top Rated (${Math.round(details.vote_average * 10)}% score)`;
      const item = tvShowToDiscoveryItem(details, curatedReason);

      await db.insert(discoveryCatalog).values(item);
      inserted++;

      if (inserted % 10 === 0) {
        console.log(`  ✓ Inserted ${inserted} TV shows...`);
      }
    } catch (error) {
      console.error(`Error seeding TV show ${show.id}:`, error);
      failed++;
    }
  }

  console.log(`\n✅ TV Shows seeded: ${inserted} inserted, ${skipped} skipped, ${failed} failed`);
}

async function main() {
  const args = process.argv.slice(2);
  const moviesOnly = args.includes('--movies-only');
  const tvOnly = args.includes('--tv-only');
  const limitArg = args.find(arg => arg.startsWith('--limit='));
  const limit = limitArg ? parseInt(limitArg.split('=')[1]) : 250;

  console.log('🌟 Discovery Catalog Seeding Script\n');
  console.log(`Configuration:`);
  console.log(`  - Movies only: ${moviesOnly}`);
  console.log(`  - TV only: ${tvOnly}`);
  console.log(`  - Limit per type: ${limit}`);
  console.log('');

  if (!TMDB_API_KEY) {
    console.error('❌ TMDB_API_KEY environment variable not set');
    process.exit(1);
  }

  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL environment variable not set');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    if (!tvOnly) {
      await seedMovies(db, limit);
    }

    if (!moviesOnly) {
      await seedTVShows(db, limit);
    }

    console.log('\n🎉 Catalog seeding complete!');
  } catch (error) {
    console.error('\n❌ Error during seeding:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();

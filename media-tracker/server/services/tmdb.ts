import { cache } from './cache.js';

export interface TmdbSearchResult {
  id: number;
  title?: string;
  name?: string;
  poster_path: string | null;
  backdrop_path: string | null;
  release_date?: string;
  first_air_date?: string;
  media_type?: string;
}

export interface ImportSearchResult {
  title: string;
  year: string;
  poster: string | null;
  backdrop: string | null;
  external_id: string;
}

const TMDB_API_KEY = process.env.TMDB_API_KEY || '';
const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const TMDB_BACKDROP_BASE = 'https://image.tmdb.org/t/p/w1280';  // Larger for backdrops
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 250;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

export async function searchMovies(query: string): Promise<ImportSearchResult[]> {
  const cacheKey = `tmdb:movie:${query}`;
  const cached = cache.get<ImportSearchResult[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  if (!TMDB_API_KEY) {
    console.warn('TMDB_API_KEY not configured');
    return [];
  }

  const url = `${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    const results: ImportSearchResult[] = (data.results || [])
      .slice(0, 5)
      .map((item: TmdbSearchResult) => ({
        title: item.title || '',
        year: item.release_date?.substring(0, 4) || '',
        poster: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : null,
        external_id: `tmdb:${item.id}`,
      }));

    cache.set(cacheKey, results, CACHE_TTL_MS);
    return results;
  } catch (error) {
    console.error('Error searching movies:', error);
    return [];
  }
}

export async function searchTvShows(query: string): Promise<ImportSearchResult[]> {
  const cacheKey = `tmdb:tv:${query}`;
  const cached = cache.get<ImportSearchResult[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  if (!TMDB_API_KEY) {
    console.warn('TMDB_API_KEY not configured');
    return [];
  }

  const url = `${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      throw new Error(`TMDB API error: ${response.status}`);
    }

    const data = await response.json();
    const results: ImportSearchResult[] = (data.results || [])
      .slice(0, 5)
      .map((item: TmdbSearchResult) => ({
        title: item.name || '',
        year: item.first_air_date?.substring(0, 4) || '',
        poster: item.poster_path ? `${TMDB_IMAGE_BASE}${item.poster_path}` : null,
        backdrop: item.backdrop_path ? `${TMDB_BACKDROP_BASE}${item.backdrop_path}` : null,
        external_id: `tmdb:${item.id}`,
      }));

    cache.set(cacheKey, results, CACHE_TTL_MS);
    return results;
  } catch (error) {
    console.error('Error searching TV shows:', error);
    return [];
  }
}

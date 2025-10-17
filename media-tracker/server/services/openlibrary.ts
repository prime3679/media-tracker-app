import { cache } from './cache.js';
import type { ImportSearchResult } from './tmdb.js';

interface OpenLibraryDoc {
  key: string;
  title: string;
  author_name?: string[];
  first_publish_year?: number;
  cover_i?: number;
}

const OPENLIBRARY_BASE_URL = 'https://openlibrary.org';
const OPENLIBRARY_COVER_BASE = 'https://covers.openlibrary.org/b/id';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

let lastRequestTime = 0;
const MIN_REQUEST_INTERVAL_MS = 1000;

async function rateLimitedFetch(url: string): Promise<Response> {
  const now = Date.now();
  const timeSinceLastRequest = now - lastRequestTime;
  
  if (timeSinceLastRequest < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - timeSinceLastRequest));
  }
  
  lastRequestTime = Date.now();
  return fetch(url);
}

export async function searchBooks(query: string): Promise<ImportSearchResult[]> {
  const cacheKey = `openlibrary:${query}`;
  const cached = cache.get<ImportSearchResult[]>(cacheKey);
  
  if (cached) {
    return cached;
  }

  const url = `${OPENLIBRARY_BASE_URL}/search.json?q=${encodeURIComponent(query)}&limit=5`;
  
  try {
    const response = await rateLimitedFetch(url);
    if (!response.ok) {
      throw new Error(`OpenLibrary API error: ${response.status}`);
    }

    const data = await response.json();
    const results: ImportSearchResult[] = (data.docs || [])
      .slice(0, 5)
      .map((item: OpenLibraryDoc) => ({
        title: item.title || '',
        year: item.first_publish_year?.toString() || '',
        poster: item.cover_i ? `${OPENLIBRARY_COVER_BASE}/${item.cover_i}-M.jpg` : null,
        external_id: `openlibrary:${item.key.replace('/works/', '')}`,
      }));

    cache.set(cacheKey, results, CACHE_TTL_MS);
    return results;
  } catch (error) {
    console.error('Error searching books:', error);
    return [];
  }
}

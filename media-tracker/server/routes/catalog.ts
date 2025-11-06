/**
 * Discovery Catalog API Routes
 *
 * Browse and search the shared catalog, add items to personal library
 */

import express from 'express';
import { z } from 'zod';
import {
  browseCatalog,
  getCatalogItem,
  getCatalogGenres,
  getCatalogDecades,
  getCatalogStats,
  type CatalogFilters,
} from '../services/catalog.js';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

// Validation schemas
const browseSchema = z.object({
  mediaType: z.enum(['movie', 'tv_show', 'book']).optional(),
  mood: z.string().optional(),
  decade: z.coerce.number().optional(),
  genre: z.string().optional(),
  country: z.string().optional(),
  minRating: z.coerce.number().min(0).max(10).optional(),
  search: z.string().optional(),
  sortBy: z.enum(['rating', 'year', 'popularity', 'title']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.coerce.number().min(1).max(100).optional(),
  offset: z.coerce.number().min(0).optional(),
});

const addToLibrarySchema = z.object({
  catalogItemId: z.number(),
  status: z.enum(['to_watch', 'watching', 'completed', 'dropped', 'on_hold']).optional(),
});

/**
 * GET /api/catalog/browse
 * Browse the discovery catalog with filters
 */
router.get('/browse', async (req, res) => {
  try {
    const filters = browseSchema.parse(req.query);

    const items = await browseCatalog(filters as CatalogFilters);

    return res.json(items);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid filter parameters',
        details: error.issues,
      });
    }
    console.error('Error browsing catalog:', error);
    return res.status(500).json({ error: 'Failed to browse catalog' });
  }
});

/**
 * GET /api/catalog/:id
 * Get a single catalog item by ID
 */
router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid catalog item ID' });
    }

    const item = await getCatalogItem(id);
    if (!item) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    return res.json(item);
  } catch (error) {
    console.error('Error fetching catalog item:', error);
    return res.status(500).json({ error: 'Failed to fetch catalog item' });
  }
});

/**
 * POST /api/catalog/add-to-library
 * Add a catalog item to user's personal library
 */
router.post('/add-to-library', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { catalogItemId, status = 'to_watch' } = addToLibrarySchema.parse(req.body);

    // Fetch catalog item
    const catalogItem = await getCatalogItem(catalogItemId);
    if (!catalogItem) {
      return res.status(404).json({ error: 'Catalog item not found' });
    }

    // Check if user already has this item in their library
    const existing = await db
      .select()
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.userId, userId),
          eq(mediaItems.tmdbId, catalogItem.tmdbId || '')
        )
      )
      .limit(1);

    if (existing.length > 0) {
      return res.status(409).json({
        error: 'Item already in your library',
        existingItemId: existing[0].id,
      });
    }

    // Add to user's library
    const result = await db.transaction(async (tx) => {
      // Insert media item
      const [newMediaItem] = await tx
        .insert(mediaItems)
        .values({
          userId,
          mediaType: catalogItem.mediaType,
          title: catalogItem.title,
          description: catalogItem.description,
          imageUrl: catalogItem.imageUrl,
          backdropUrl: catalogItem.backdropUrl,
          trailerUrl: catalogItem.trailerUrl,
          releaseDate: catalogItem.releaseDate,
          genres: catalogItem.genres,
          director: catalogItem.director,
          author: catalogItem.author,
          tmdbId: catalogItem.tmdbId,
          imdbId: catalogItem.imdbId,
          totalSeasons: catalogItem.totalSeasons,
          totalEpisodes: catalogItem.totalEpisodes,
        })
        .returning();

      // Create tracking entry
      const [tracking] = await tx
        .insert(mediaTracking)
        .values({
          userId,
          mediaItemId: newMediaItem.id,
          status,
        })
        .returning();

      return { mediaItem: newMediaItem, tracking };
    });

    return res.status(201).json({
      message: 'Item added to library',
      mediaItem: result.mediaItem,
      tracking: result.tracking,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid request data',
        details: error.issues,
      });
    }
    console.error('Error adding to library:', error);
    return res.status(500).json({ error: 'Failed to add item to library' });
  }
});

/**
 * GET /api/catalog/genres
 * Get list of available genres in catalog
 */
router.get('/metadata/genres', async (_req, res) => {
  try {
    const genres = await getCatalogGenres();
    return res.json(genres);
  } catch (error) {
    console.error('Error fetching genres:', error);
    return res.status(500).json({ error: 'Failed to fetch genres' });
  }
});

/**
 * GET /api/catalog/decades
 * Get list of available decades in catalog
 */
router.get('/metadata/decades', async (_req, res) => {
  try {
    const decades = await getCatalogDecades();
    return res.json(decades);
  } catch (error) {
    console.error('Error fetching decades:', error);
    return res.status(500).json({ error: 'Failed to fetch decades' });
  }
});

/**
 * GET /api/catalog/stats
 * Get catalog statistics
 */
router.get('/metadata/stats', async (_req, res) => {
  try {
    const stats = await getCatalogStats();
    return res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    return res.status(500).json({ error: 'Failed to fetch stats' });
  }
});

export default router;

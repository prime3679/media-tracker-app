import express from 'express';
import { z } from 'zod';
import { searchMovies, searchTvShows } from '../services/tmdb.js';
import { searchBooks } from '../services/openlibrary.js';
import { db } from '../db.js';
import { mediaItems, mediaTracking, type InsertMediaItem } from '../../shared/schema.js';
import { eq, and } from 'drizzle-orm';

const router = express.Router();

const importSearchSchema = z.object({
  query: z.string().min(1),
  type: z.enum(['movie', 'tv', 'book']),
});

const importApplySchema = z.object({
  title: z.string().min(1),
  year: z.string(),
  poster: z.string().nullable(),
  external_id: z.string().min(1),
  type: z.enum(['movie', 'tv_show', 'book']),
});

router.get('/search', async (req, res) => {
  try {
    const { query, type } = importSearchSchema.parse({
      query: req.query.query,
      type: req.query.type,
    });

    let results;
    switch (type) {
      case 'movie':
        results = await searchMovies(query);
        break;
      case 'tv':
        results = await searchTvShows(query);
        break;
      case 'book':
        results = await searchBooks(query);
        break;
      default:
        return res.status(400).json({ error: 'Invalid type' });
    }

    return res.json(results);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.issues,
      });
    }
    console.error('Error searching for media:', error);
    return res.status(500).json({ error: 'Failed to search for media' });
  }
});

router.post('/apply', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const validatedData = importApplySchema.parse(req.body);

    const externalIdField = validatedData.external_id.startsWith('tmdb:') ? 'tmdbId' : 
                            validatedData.external_id.startsWith('openlibrary:') ? 'isbn' : null;

    if (!externalIdField) {
      return res.status(400).json({ error: 'Invalid external_id format' });
    }

    const existingItems = await db
      .select()
      .from(mediaItems)
      .where(
        and(
          eq(mediaItems.userId, userId),
          externalIdField === 'tmdbId' 
            ? eq(mediaItems.tmdbId, validatedData.external_id)
            : eq(mediaItems.isbn, validatedData.external_id)
        )
      );

    if (existingItems.length > 0) {
      return res.status(409).json({ 
        error: 'Media item with this external_id already exists for this user',
        existingItemId: existingItems[0].id,
      });
    }

    const result = await db.transaction(async (tx) => {
      const mediaItemData: Partial<InsertMediaItem> = {
        userId,
        title: validatedData.title,
        mediaType: validatedData.type,
        imageUrl: validatedData.poster,
        releaseDate: validatedData.year,
      };

      if (externalIdField === 'tmdbId') {
        mediaItemData.tmdbId = validatedData.external_id;
      } else {
        mediaItemData.isbn = validatedData.external_id;
      }

      const [mediaItem] = await tx.insert(mediaItems).values(mediaItemData as InsertMediaItem).returning();

      const [tracking] = await tx.insert(mediaTracking).values({
        userId,
        mediaItemId: mediaItem.id,
        status: 'to_watch',
        rating: null,
        notes: null,
        progress: 0,
      }).returning();

      return { ...mediaItem, tracking };
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.issues,
      });
    }
    console.error('Error creating imported media item:', error);
    return res.status(500).json({ error: 'Failed to create media item' });
  }
});

export default router;

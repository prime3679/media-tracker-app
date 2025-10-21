import express from 'express';
import { z } from 'zod';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { eq, sql, desc } from 'drizzle-orm';

const router = express.Router();

const searchSchema = z.object({
  q: z.string().min(1),
});

router.get('/', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const { q } = searchSchema.parse({ q: req.query.q });

    const weightedSearchVector = sql`
      (
        setweight(to_tsvector('english', coalesce(${mediaItems.title}, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(${mediaItems.director}, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(${mediaItems.author}, '')), 'B')
      )
    `;

    const tsQuery = sql`plainto_tsquery('english', ${q})`;

    const results = await db
      .select({
        id: mediaItems.id,
        userId: mediaItems.userId,
        mediaType: mediaItems.mediaType,
        title: mediaItems.title,
        description: mediaItems.description,
        imageUrl: mediaItems.imageUrl,
        releaseDate: mediaItems.releaseDate,
        genres: mediaItems.genres,
        director: mediaItems.director,
        author: mediaItems.author,
        isbn: mediaItems.isbn,
        tmdbId: mediaItems.tmdbId,
        imdbId: mediaItems.imdbId,
        totalSeasons: mediaItems.totalSeasons,
        totalEpisodes: mediaItems.totalEpisodes,
        totalPages: mediaItems.totalPages,
        createdAt: mediaItems.createdAt,
        updatedAt: mediaItems.updatedAt,
        rank: sql<number>`
          ts_rank(
            ${weightedSearchVector},
            ${tsQuery}
          ) +
          similarity(${mediaItems.title}, ${q}) * 2
        `.as('rank'),
      })
      .from(mediaItems)
      .where(
        sql`${mediaItems.userId} = ${userId} AND (
          ${weightedSearchVector} @@ ${tsQuery}
          OR
          similarity(${mediaItems.title}, ${q}) > 0.1
        )`
      )
      .orderBy(desc(sql`rank`));

    const itemIds = results.map((r: { id: number }) => r.id);
    
    let trackingData: typeof mediaTracking.$inferSelect[] = [];
    if (itemIds.length > 0) {
      trackingData = await db
        .select()
        .from(mediaTracking)
        .where(eq(mediaTracking.userId, userId));
    }

    const resultsWithTracking = results.map((item: typeof results[0]) => {
      const { rank: _rank, ...itemData } = item;
      const tracking = trackingData.find(t => t.mediaItemId === item.id);
      return {
        ...itemData,
        tracking: tracking || null,
      };
    });

    return res.json(resultsWithTracking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        error: 'Invalid input data',
        details: error.issues,
      });
    }
    console.error('Error searching media:', error);
    return res.status(500).json({ error: 'Failed to search media' });
  }
});

export default router;

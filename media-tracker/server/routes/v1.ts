import express from 'express';
import { z } from 'zod';
import { storage } from '../storage.js';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { createMediaSchema, updateTrackingSchema, createSeasonSchema, createEpisodeSchema } from '../../shared/schemas/index.js';
import { writeRateLimiter } from '../middleware/security.js';
import { authenticateToken } from '../middleware/auth.js';
import { idempotencyMiddleware } from '../middleware/idempotency.js';
import authRouter from './auth.js';
import importRouter from './import.js';
import searchRouter from './search.js';
import nextRouter from './next.js';
import { generateWeeklyDigest } from '../jobs/weeklyDigest.js';

const router = express.Router();

router.use('/auth', authRouter);

router.use(authenticateToken);

router.use('/import', importRouter);
router.use('/search', searchRouter);
router.use('/next', nextRouter);

router.get('/media', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItemsList = await storage.getUserMediaItems(userId);
    const tracking = await storage.getUserMediaTracking(userId);
    
    const mediaWithTracking = mediaItemsList.map(item => {
      const trackingData = tracking.find(t => t.mediaItemId === item.id);
      return {
        ...item,
        tracking: trackingData || null
      };
    });
    
    res.json(mediaWithTracking);
  } catch (error) {
    console.error('Error fetching media:', error);
    res.status(500).json({ error: 'Failed to fetch media items' });
  }
});

router.post('/media', idempotencyMiddleware, writeRateLimiter, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const validatedData = createMediaSchema.parse(req.body);
    
    const result = await db.transaction(async (tx) => {
      const [mediaItem] = await tx.insert(mediaItems).values({
        userId,
        title: validatedData.title,
        mediaType: validatedData.mediaType,
        description: validatedData.description || null,
        author: validatedData.author || null,
        director: validatedData.director || null,
        genres: validatedData.genres || null
      }).returning();

      const hasRating = Object.prototype.hasOwnProperty.call(validatedData, 'rating');
      const ratingValue = hasRating ? validatedData.rating : undefined;

      const [tracking] = await tx.insert(mediaTracking).values({
        userId,
        mediaItemId: mediaItem.id,
        status: validatedData.status,
        rating: ratingValue === null || ratingValue === undefined ? null : ratingValue.toString(),
        notes: validatedData.notes || null,
        progress: validatedData.progress,
        completedDate: validatedData.status === 'completed' ? new Date() : null
      }).returning();

      return { ...mediaItem, tracking };
    });

    return res.status(201).json(result);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data', 
        details: error.issues 
      });
    }
    console.error('Error creating media item:', error);
    return res.status(500).json({ error: 'Failed to create media item' });
  }
});

router.put('/media/:id/tracking', idempotencyMiddleware, writeRateLimiter, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItemId = parseInt(req.params.id);
    const validatedData = updateTrackingSchema.parse(req.body);
    
    let tracking = await storage.getMediaTracking(userId, mediaItemId);
    
    if (tracking) {
      const updates: Record<string, unknown> = {};
      if (validatedData.status !== undefined) updates.status = validatedData.status;
      if (Object.prototype.hasOwnProperty.call(validatedData, 'rating')) {
        updates.rating = validatedData.rating === null || validatedData.rating === undefined ? null : validatedData.rating.toString();
      }
      if (validatedData.notes !== undefined) updates.notes = validatedData.notes || null;
      if (validatedData.progress !== undefined) updates.progress = validatedData.progress;
      
      if (validatedData.status !== undefined) {
        if (validatedData.status === 'completed' && tracking.status !== 'completed') {
          updates.completedDate = new Date();
        } else if (validatedData.status !== 'completed') {
          updates.completedDate = null;
        }
      }
      
      tracking = await storage.updateMediaTracking(tracking.id, updates);
    } else {
      const hasRating = Object.prototype.hasOwnProperty.call(validatedData, 'rating');
      const ratingValue = hasRating ? validatedData.rating : undefined;

      tracking = await storage.createMediaTracking({
        userId,
        mediaItemId,
        status: validatedData.status || 'to_watch',
        rating: ratingValue === null || ratingValue === undefined ? null : ratingValue.toString(),
        notes: validatedData.notes || null,
        progress: validatedData.progress || 0,
        completedDate: validatedData.status === 'completed' ? new Date() : null
      });
    }
    
    return res.json(tracking);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ 
        error: 'Invalid input data', 
        details: error.issues 
      });
    }
    console.error('Error updating tracking:', error);
    return res.status(500).json({ error: 'Failed to update tracking' });
  }
});

router.get('/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItemsList = await storage.getUserMediaItems(userId);
    const tracking = await storage.getUserMediaTracking(userId);
    
    const weekStart = new Date();
    weekStart.setHours(0, 0, 0, 0);
    const day = weekStart.getDay();
    const diff = weekStart.getDate() - day;
    weekStart.setDate(diff);
    
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    
    const completionsThisWeek = tracking.filter(t => {
      if (!t.completedDate) return false;
      const completedDate = new Date(t.completedDate);
      return completedDate >= weekStart && completedDate < weekEnd;
    }).length;
    
    let streakDays = 0;
    const completedTracking = tracking
      .filter(t => t.status === 'completed' && t.completedDate)
      .sort((a, b) => new Date(b.completedDate!).getTime() - new Date(a.completedDate!).getTime());
    
    if (completedTracking.length > 0) {
      const completedDates = completedTracking
        .map(t => {
          const d = new Date(t.completedDate!);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        });
      
      const uniqueDates = [...new Set(completedDates)].sort((a, b) => b - a);
      const currentDate = new Date();
      currentDate.setHours(0, 0, 0, 0);
      
      for (const dateTime of uniqueDates) {
        const diff = Math.floor((currentDate.getTime() - dateTime) / (1000 * 60 * 60 * 24));
        if (diff === streakDays) {
          streakDays++;
        } else if (diff > streakDays) {
          break;
        }
      }
    }
    
    const genreCount = new Map<string, number>();
    for (const item of mediaItemsList) {
      if (!item.genres) continue;
      const genres = item.genres.split(',').map(g => g.trim());
      for (const genre of genres) {
        if (genre) {
          genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
        }
      }
    }
    
    const genreGravity = Array.from(genreCount.entries())
      .map(([genre, count]) => ({ genre, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
    
    const stats = {
      totalItems: mediaItemsList.length,
      completed: tracking.filter(t => t.status === 'completed').length,
      watching: tracking.filter(t => t.status === 'watching').length,
      toWatch: tracking.filter(t => t.status === 'to_watch').length,
      onHold: tracking.filter(t => t.status === 'on_hold').length,
      dropped: tracking.filter(t => t.status === 'dropped').length,
      movies: mediaItemsList.filter(item => item.mediaType === 'movie').length,
      tvShows: mediaItemsList.filter(item => item.mediaType === 'tv_show').length,
      books: mediaItemsList.filter(item => item.mediaType === 'book').length,
      completionVelocity: completionsThisWeek,
      streakDays,
      genreGravity
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

router.get('/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

router.post('/seasons', writeRateLimiter, async (req, res) => {
  try {
    const validatedData = createSeasonSchema.parse(req.body);
    const season = await storage.createSeason(validatedData);
    return res.status(201).json(season);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.issues });
    }
    console.error('Error creating season:', error);
    return res.status(500).json({ error: 'Failed to create season' });
  }
});

router.get('/media/:id/seasons', async (req, res) => {
  try {
    const mediaItemId = parseInt(req.params.id);
    const seasonsList = await storage.getMediaItemSeasons(mediaItemId);
    res.json(seasonsList);
  } catch (error) {
    console.error('Error fetching seasons:', error);
    res.status(500).json({ error: 'Failed to fetch seasons' });
  }
});

router.post('/episodes', writeRateLimiter, async (req, res) => {
  try {
    const validatedData = createEpisodeSchema.parse(req.body);
    const episode = await storage.createEpisode(validatedData);
    return res.status(201).json(episode);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: 'Invalid input data', details: error.issues });
    }
    console.error('Error creating episode:', error);
    return res.status(500).json({ error: 'Failed to create episode' });
  }
});

router.get('/seasons/:id/episodes', async (req, res) => {
  try {
    const seasonId = parseInt(req.params.id);
    const episodesList = await storage.getSeasonEpisodes(seasonId);
    res.json(episodesList);
  } catch (error) {
    console.error('Error fetching episodes:', error);
    res.status(500).json({ error: 'Failed to fetch episodes' });
  }
});

router.post('/digest/generate', async (req, res) => {
  try {
    const userId = req.user!.userId;
    await generateWeeklyDigest(userId);
    res.json({ message: 'Weekly digest generated successfully' });
  } catch (error) {
    console.error('Error generating digest:', error);
    res.status(500).json({ error: 'Failed to generate weekly digest' });
  }
});

router.get('/snapshots', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 10;
    const snapshots = await storage.getUserSnapshots(userId, limit);
    res.json(snapshots);
  } catch (error) {
    console.error('Error fetching snapshots:', error);
    res.status(500).json({ error: 'Failed to fetch snapshots' });
  }
});

export default router;

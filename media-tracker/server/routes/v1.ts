import express from 'express';
import { z } from 'zod';
import { storage } from '../storage.js';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { createMediaSchema, updateTrackingSchema } from '../../shared/schemas/index.js';
import { writeRateLimiter } from '../middleware/security.js';

const router = express.Router();
const DEMO_USER_ID = 1;

router.get('/media', async (_req, res) => {
  try {
    const mediaItemsList = await storage.getUserMediaItems(DEMO_USER_ID);
    const tracking = await storage.getUserMediaTracking(DEMO_USER_ID);
    
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

router.post('/media', writeRateLimiter, async (req, res) => {
  try {
    const validatedData = createMediaSchema.parse(req.body);
    
    const result = await db.transaction(async (tx) => {
      const [mediaItem] = await tx.insert(mediaItems).values({
        userId: DEMO_USER_ID,
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
        userId: DEMO_USER_ID,
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

router.put('/media/:id/tracking', writeRateLimiter, async (req, res) => {
  try {
    const mediaItemId = parseInt(req.params.id);
    const validatedData = updateTrackingSchema.parse(req.body);
    
    let tracking = await storage.getMediaTracking(DEMO_USER_ID, mediaItemId);
    
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
        userId: DEMO_USER_ID,
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

router.get('/stats', async (_req, res) => {
  try {
    const mediaItemsList = await storage.getUserMediaItems(DEMO_USER_ID);
    const tracking = await storage.getUserMediaTracking(DEMO_USER_ID);
    
    const stats = {
      totalItems: mediaItemsList.length,
      completed: tracking.filter(t => t.status === 'completed').length,
      watching: tracking.filter(t => t.status === 'watching').length,
      toWatch: tracking.filter(t => t.status === 'to_watch').length,
      onHold: tracking.filter(t => t.status === 'on_hold').length,
      dropped: tracking.filter(t => t.status === 'dropped').length,
      movies: mediaItemsList.filter(item => item.mediaType === 'movie').length,
      tvShows: mediaItemsList.filter(item => item.mediaType === 'tv_show').length,
      books: mediaItemsList.filter(item => item.mediaType === 'book').length
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

export default router;

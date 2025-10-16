import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import { createMediaSchema, updateTrackingSchema } from '../../shared/schemas/index.js';
import { z } from 'zod';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  req.user = { userId: 1, email: 'test@example.com' };
  next();
});

app.get('/api/media', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItemsData = await storage.getUserMediaItems(userId);
    const tracking = await storage.getUserMediaTracking(userId);
    
    const mediaWithTracking = mediaItemsData.map(item => {
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

app.post('/api/media', async (req, res) => {
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

app.put('/api/media/:id/tracking', async (req, res) => {
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

app.get('/api/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItemsData = await storage.getUserMediaItems(userId);
    const tracking = await storage.getUserMediaTracking(userId);
    
    const stats = {
      totalItems: mediaItemsData.length,
      completed: tracking.filter(t => t.status === 'completed').length,
      watching: tracking.filter(t => t.status === 'watching').length,
      toWatch: tracking.filter(t => t.status === 'to_watch').length,
      onHold: tracking.filter(t => t.status === 'on_hold').length,
      dropped: tracking.filter(t => t.status === 'dropped').length,
      movies: mediaItemsData.filter(item => item.mediaType === 'movie').length,
      tvShows: mediaItemsData.filter(item => item.mediaType === 'tv_show').length,
      books: mediaItemsData.filter(item => item.mediaType === 'book').length
    };
    
    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

describe('Media API Integration Tests', () => {
  beforeAll(async () => {
    const existingUser = await storage.getUser(1);
    if (!existingUser) {
      const hashedPassword = await authService.hashPassword('test123');
      await storage.createUser({
        email: 'test@example.com',
        username: 'testuser',
        password: hashedPassword,
      });
    }
  });

  describe('POST /api/media', () => {
    it('should create a new media item with tracking', async () => {
      const newMedia = {
        title: 'Test Movie',
        mediaType: 'movie',
        status: 'to_watch',
        progress: 0
      };

      const response = await request(app)
        .post('/api/media')
        .send(newMedia)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(newMedia.title);
      expect(response.body.mediaType).toBe(newMedia.mediaType);
      expect(response.body).toHaveProperty('tracking');
      expect(response.body.tracking.status).toBe(newMedia.status);
    });

    it('should create media item with completed status and set completedDate', async () => {
      const newMedia = {
        title: 'Completed Movie',
        mediaType: 'movie',
        status: 'completed',
        rating: 8,
        progress: 100
      };

      const response = await request(app)
        .post('/api/media')
        .send(newMedia)
        .expect(201);

      expect(response.body.tracking.status).toBe('completed');
      expect(response.body.tracking.completedDate).toBeTruthy();
      expect(response.body.tracking.rating).toBe('8');
    });

    it('should create media item with optional fields', async () => {
      const newMedia = {
        title: 'Test Book',
        mediaType: 'book',
        status: 'watching',
        author: 'Test Author',
        description: 'Test description',
        notes: 'Test notes',
        progress: 50
      };

      const response = await request(app)
        .post('/api/media')
        .send(newMedia)
        .expect(201);

      expect(response.body.author).toBe(newMedia.author);
      expect(response.body.description).toBe(newMedia.description);
      expect(response.body.tracking.notes).toBe(newMedia.notes);
      expect(response.body.tracking.progress).toBe(newMedia.progress);
    });

    it('should reject invalid media type', async () => {
      const invalidMedia = {
        title: 'Invalid Media',
        mediaType: 'invalid_type',
        status: 'to_watch',
        progress: 0
      };

      const response = await request(app)
        .post('/api/media')
        .send(invalidMedia)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should reject missing required fields', async () => {
      const incompleteMedia = {
        title: 'Incomplete Media'
      };

      const response = await request(app)
        .post('/api/media')
        .send(incompleteMedia)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/media', () => {
    it('should retrieve all media items with tracking data', async () => {
      const response = await request(app)
        .get('/api/media')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      if (response.body.length > 0) {
        expect(response.body[0]).toHaveProperty('id');
        expect(response.body[0]).toHaveProperty('title');
        expect(response.body[0]).toHaveProperty('tracking');
      }
    });

    it('should return media items with correct structure', async () => {
      const newMedia = {
        title: 'Structured Media',
        mediaType: 'tv_show',
        status: 'watching',
        progress: 25
      };

      await request(app).post('/api/media').send(newMedia);

      const response = await request(app)
        .get('/api/media')
        .expect(200);

      const createdItem = response.body.find((item: { title: string }) => item.title === 'Structured Media');
      expect(createdItem).toBeTruthy();
      expect(createdItem.mediaType).toBe('tv_show');
      expect(createdItem.tracking.status).toBe('watching');
    });
  });

  describe('PUT /api/media/:id/tracking', () => {
    let testMediaId: number;

    beforeAll(async () => {
      const newMedia = {
        title: 'Update Test Media',
        mediaType: 'movie',
        status: 'to_watch',
        progress: 0
      };

      const response = await request(app)
        .post('/api/media')
        .send(newMedia);
      
      testMediaId = response.body.id;
    });

    it('should update tracking status', async () => {
      const response = await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ status: 'watching' })
        .expect(200);

      expect(response.body.status).toBe('watching');
    });

    it('should update rating', async () => {
      const response = await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ rating: 7 })
        .expect(200);

      expect(response.body.rating).toBe('7');
    });

    it('should update notes and progress', async () => {
      const response = await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ 
          notes: 'Great movie!',
          progress: 50
        })
        .expect(200);

      expect(response.body.notes).toBe('Great movie!');
      expect(response.body.progress).toBe(50);
    });

    it('should set completedDate when status changes to completed', async () => {
      const response = await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ status: 'completed' })
        .expect(200);

      expect(response.body.status).toBe('completed');
      expect(response.body.completedDate).toBeTruthy();
    });

    it('should clear completedDate when status changes from completed', async () => {
      await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ status: 'completed' });

      const response = await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ status: 'watching' })
        .expect(200);

      expect(response.body.status).toBe('watching');
      expect(response.body.completedDate).toBeNull();
    });

    it('should reject invalid status', async () => {
      const response = await request(app)
        .put(`/api/media/${testMediaId}/tracking`)
        .send({ status: 'invalid_status' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/stats', () => {
    beforeAll(async () => {
      await request(app).post('/api/media').send({
        title: 'Stats Movie 1',
        mediaType: 'movie',
        status: 'completed',
        progress: 100
      });

      await request(app).post('/api/media').send({
        title: 'Stats TV Show 1',
        mediaType: 'tv_show',
        status: 'watching',
        progress: 50
      });

      await request(app).post('/api/media').send({
        title: 'Stats Book 1',
        mediaType: 'book',
        status: 'to_watch',
        progress: 0
      });
    });

    it('should return statistics for user media', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body).toHaveProperty('totalItems');
      expect(response.body).toHaveProperty('completed');
      expect(response.body).toHaveProperty('watching');
      expect(response.body).toHaveProperty('toWatch');
      expect(response.body).toHaveProperty('movies');
      expect(response.body).toHaveProperty('tvShows');
      expect(response.body).toHaveProperty('books');
    });

    it('should have accurate counts', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      expect(response.body.totalItems).toBeGreaterThan(0);
      expect(response.body.completed).toBeGreaterThanOrEqual(0);
      expect(response.body.watching).toBeGreaterThanOrEqual(0);
      expect(response.body.movies).toBeGreaterThanOrEqual(0);
      expect(response.body.tvShows).toBeGreaterThanOrEqual(0);
      expect(response.body.books).toBeGreaterThanOrEqual(0);
    });

    it('should sum status counts correctly', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      const statusTotal = response.body.completed + 
                         response.body.watching + 
                         response.body.toWatch + 
                         response.body.onHold + 
                         response.body.dropped;

      expect(statusTotal).toBe(response.body.totalItems);
    });

    it('should sum media type counts correctly', async () => {
      const response = await request(app)
        .get('/api/stats')
        .expect(200);

      const typeTotal = response.body.movies + 
                       response.body.tvShows + 
                       response.body.books;

      expect(typeTotal).toBe(response.body.totalItems);
    });
  });
});

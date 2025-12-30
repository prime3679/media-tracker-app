import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import swaggerUi from 'swagger-ui-express';
import { storage } from './storage.js';
import { db } from './db.js';
import { mediaItems, mediaTracking } from '../shared/schema.js';
import { createMediaSchema, updateTrackingSchema } from '../shared/schemas/index.js';
import { requestIdMiddleware, helmetMiddleware, getCorsOptions, writeRateLimiter } from './middleware/security.js';
import { authenticateToken } from './middleware/auth.js';
import v1Router from './routes/v1.js';
import { generateOpenApiSpec } from './utils/openapi.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(requestIdMiddleware);
app.use(helmetMiddleware);
app.use(cors(getCorsOptions()));
app.use(express.json());

// Serve static files from dist folder in production
if (process.env.NODE_ENV === 'production') {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
}

app.get('/api/health', (_req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

const openApiSpec = generateOpenApiSpec();
app.get('/api/docs/openapi.json', (_req, res) => {
  res.json(openApiSpec);
});
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(openApiSpec));

app.use('/api/v1', v1Router);

app.use('/api', authenticateToken);

// Get all media items for user
app.get('/api/media', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItems = await storage.getUserMediaItems(userId);
    const tracking = await storage.getUserMediaTracking(userId);

    // Combine media items with their tracking data
    const mediaWithTracking = mediaItems.map(item => {
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

// Add new media item with proper transaction
app.post('/api/media', writeRateLimiter, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const validatedData = createMediaSchema.parse(req.body);

    // Use transaction to ensure atomicity - implement DB calls directly
    const result = await db.transaction(async (tx) => {
      // Create media item using transaction
      const [mediaItem] = await tx.insert(mediaItems).values({
        userId,
        title: validatedData.title,
        mediaType: validatedData.mediaType,
        description: validatedData.description || null,
        author: validatedData.author || null,
        director: validatedData.director || null,
        genres: validatedData.genres || null
      }).returning();

      // Create tracking using same transaction
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

// Update tracking for a media item
app.put('/api/media/:id/tracking', writeRateLimiter, async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItemId = parseInt(req.params.id);
    const validatedData = updateTrackingSchema.parse(req.body);

    let tracking = await storage.getMediaTracking(userId, mediaItemId);

    if (tracking) {
      // Update existing tracking
      const updates: Record<string, unknown> = {};
      if (validatedData.status !== undefined) updates.status = validatedData.status;
      if (Object.prototype.hasOwnProperty.call(validatedData, 'rating')) {
        updates.rating = validatedData.rating === null || validatedData.rating === undefined ? null : validatedData.rating.toString();
      }
      if (validatedData.notes !== undefined) updates.notes = validatedData.notes || null;
      if (validatedData.progress !== undefined) updates.progress = validatedData.progress;

      // FIXED: Only update completedDate when status is explicitly provided
      if (validatedData.status !== undefined) {
        if (validatedData.status === 'completed' && tracking.status !== 'completed') {
          updates.completedDate = new Date();
        } else if (validatedData.status !== 'completed') {
          updates.completedDate = null;
        }
      }

      tracking = await storage.updateMediaTracking(tracking.id, updates);
    } else {
      // Create new tracking entry
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

// Get statistics
app.get('/api/stats', async (req, res) => {
  try {
    const userId = req.user!.userId;
    const mediaItems = await storage.getUserMediaItems(userId);
    const tracking = await storage.getUserMediaTracking(userId);

    const stats = {
      totalItems: mediaItems.length,
      completed: tracking.filter(t => t.status === 'completed').length,
      watching: tracking.filter(t => t.status === 'watching').length,
      toWatch: tracking.filter(t => t.status === 'to_watch').length,
      onHold: tracking.filter(t => t.status === 'on_hold').length,
      dropped: tracking.filter(t => t.status === 'dropped').length,
      movies: mediaItems.filter(item => item.mediaType === 'movie').length,
      tvShows: mediaItems.filter(item => item.mediaType === 'tv_show').length,
      books: mediaItems.filter(item => item.mediaType === 'book').length
    };

    res.json(stats);
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Catch-all handler: send back React's index.html file for production
if (process.env.NODE_ENV === 'production') {
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      return next();
    }
    const indexPath = path.join(__dirname, '..', 'dist', 'index.html');
    res.sendFile(indexPath);
  });
}

// Start server
const startServer = async () => {
  app.listen(PORT, () => {
    console.log(`Media Tracker API server running on port ${PORT}`);
  });
};

// Only start server if run directly
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startServer().catch(console.error);
}

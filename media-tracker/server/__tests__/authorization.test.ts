import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import { authenticateToken } from '../middleware/auth.js';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';

const app = express();
app.use(express.json());

app.use(authenticateToken);

app.get('/protected', (req, res) => {
  res.json({ userId: req.user!.userId });
});

describe('Authorization Middleware', () => {
  let accessToken: string;
  let userId: number;

  beforeAll(async () => {
    const hashedPassword = await authService.hashPassword('password123');
    const user = await storage.createUser({
      email: 'auth-test@example.com',
      username: 'authtest',
      password: hashedPassword,
    });
    userId = user.id;
    accessToken = authService.generateAccessToken(user);
  });

  describe('JWT Validation', () => {
    it('should allow access with valid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.userId).toBe(userId);
    });

    it('should return 401 without token', async () => {
      const response = await request(app)
        .get('/protected')
        .expect(401);

      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('token required');
    });

    it('should return 401 with invalid token', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 401 with malformed authorization header', async () => {
      const response = await request(app)
        .get('/protected')
        .set('Authorization', accessToken)
        .expect(401);

      expect(response.body).toHaveProperty('error');
    });
  });
});

describe('Data Isolation', () => {
  let userA: { id: number; accessToken: string };
  let userB: { id: number; accessToken: string };
  let mediaItemA: number;
  let mediaItemB: number;

  beforeAll(async () => {
    const hashedPassword = await authService.hashPassword('password123');
    
    const userARecord = await storage.createUser({
      email: 'userA@example.com',
      username: 'userA',
      password: hashedPassword,
    });
    userA = {
      id: userARecord.id,
      accessToken: authService.generateAccessToken(userARecord),
    };

    const userBRecord = await storage.createUser({
      email: 'userB@example.com',
      username: 'userB',
      password: hashedPassword,
    });
    userB = {
      id: userBRecord.id,
      accessToken: authService.generateAccessToken(userBRecord),
    };

    const [itemA] = await db.insert(mediaItems).values({
      userId: userA.id,
      mediaType: 'movie',
      title: 'User A Movie',
    }).returning();
    mediaItemA = itemA.id;

    await db.insert(mediaTracking).values({
      userId: userA.id,
      mediaItemId: mediaItemA,
      status: 'watching',
    });

    const [itemB] = await db.insert(mediaItems).values({
      userId: userB.id,
      mediaType: 'movie',
      title: 'User B Movie',
    }).returning();
    mediaItemB = itemB.id;

    await db.insert(mediaTracking).values({
      userId: userB.id,
      mediaItemId: mediaItemB,
      status: 'completed',
    });
  });

  it('should only return user A data when authenticated as user A', async () => {
    const mediaItemsA = await storage.getUserMediaItems(userA.id);
    const trackingA = await storage.getUserMediaTracking(userA.id);

    expect(mediaItemsA.length).toBeGreaterThan(0);
    expect(mediaItemsA.every(item => item.userId === userA.id)).toBe(true);
    expect(trackingA.every(track => track.userId === userA.id)).toBe(true);
  });

  it('should only return user B data when authenticated as user B', async () => {
    const mediaItemsB = await storage.getUserMediaItems(userB.id);
    const trackingB = await storage.getUserMediaTracking(userB.id);

    expect(mediaItemsB.length).toBeGreaterThan(0);
    expect(mediaItemsB.every(item => item.userId === userB.id)).toBe(true);
    expect(trackingB.every(track => track.userId === userB.id)).toBe(true);
  });

  it('should not allow user A to access user B data', async () => {
    const trackingA = await storage.getMediaTracking(userA.id, mediaItemB);
    expect(trackingA).toBeUndefined();
  });

  it('should not allow user B to access user A data', async () => {
    const trackingB = await storage.getMediaTracking(userB.id, mediaItemA);
    expect(trackingB).toBeUndefined();
  });

  it('should ensure user A cannot see user B media items', async () => {
    const mediaItemsA = await storage.getUserMediaItems(userA.id);
    const hasUserBItem = mediaItemsA.some(item => item.id === mediaItemB);
    expect(hasUserBItem).toBe(false);
  });

  it('should ensure user B cannot see user A media items', async () => {
    const mediaItemsB = await storage.getUserMediaItems(userB.id);
    const hasUserAItem = mediaItemsB.some(item => item.id === mediaItemA);
    expect(hasUserAItem).toBe(false);
  });
});

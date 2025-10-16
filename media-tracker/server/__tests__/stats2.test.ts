import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import v1Router from '../routes/v1.js';

const app = express();
app.use(express.json());
app.use('/api/v1', v1Router);

describe('Stats 2.0 API', () => {
  let authToken: string;

  beforeAll(async () => {
    const hashedPassword = await authService.hashPassword('testpass123');
    await storage.createUser({
      email: 'stats2-test@example.com',
      username: 'stats2test',
      password: hashedPassword,
    });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'stats2-test@example.com',
        password: 'testpass123',
      });
    
    authToken = loginResponse.body.tokens.accessToken;

    await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'The Matrix',
        mediaType: 'movie',
        genres: 'Action, Sci-Fi',
        status: 'completed',
        progress: 1,
      });

    await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Inception',
        mediaType: 'movie',
        genres: 'Action, Thriller',
        status: 'completed',
        progress: 1,
      });

    await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'The Dark Knight',
        mediaType: 'movie',
        genres: 'Action, Drama',
        status: 'watching',
        progress: 0,
      });
  });

  describe('GET /api/v1/stats', () => {
    it('should return comprehensive stats including velocity and streaks', async () => {
      const response = await request(app)
        .get('/api/v1/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalItems');
      expect(response.body).toHaveProperty('completed');
      expect(response.body).toHaveProperty('watching');
      expect(response.body).toHaveProperty('toWatch');
      expect(response.body).toHaveProperty('completionVelocity');
      expect(response.body).toHaveProperty('streakDays');
      expect(response.body).toHaveProperty('genreGravity');

      expect(response.body.totalItems).toBe(3);
      expect(response.body.completed).toBe(2);
      expect(response.body.watching).toBe(1);
      expect(response.body.movies).toBe(3);
    });

    it('should calculate genre gravity correctly', async () => {
      const response = await request(app)
        .get('/api/v1/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body.genreGravity)).toBe(true);
      expect(response.body.genreGravity.length).toBeGreaterThan(0);
      
      const actionGenre = response.body.genreGravity.find((g: { genre: string }) => g.genre === 'Action');
      expect(actionGenre).toBeDefined();
      expect(actionGenre.count).toBe(3);
    });

    it('should calculate completion velocity (completions this week)', async () => {
      const response = await request(app)
        .get('/api/v1/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(typeof response.body.completionVelocity).toBe('number');
      expect(response.body.completionVelocity).toBeGreaterThanOrEqual(0);
    });

    it('should calculate streak days', async () => {
      const response = await request(app)
        .get('/api/v1/stats')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(typeof response.body.streakDays).toBe('number');
      expect(response.body.streakDays).toBeGreaterThanOrEqual(0);
    });
  });

  describe('POST /api/v1/digest/generate', () => {
    it('should generate weekly digest snapshot', async () => {
      const response = await request(app)
        .post('/api/v1/digest/generate')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('successfully');
    });
  });

  describe('GET /api/v1/snapshots', () => {
    it('should retrieve weekly snapshots', async () => {
      const response = await request(app)
        .get('/api/v1/snapshots')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should respect limit parameter', async () => {
      await request(app)
        .post('/api/v1/digest/generate')
        .set('Authorization', `Bearer ${authToken}`);

      await request(app)
        .post('/api/v1/digest/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get('/api/v1/snapshots?limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(1);
    });

    it('should verify snapshot data structure', async () => {
      await request(app)
        .post('/api/v1/digest/generate')
        .set('Authorization', `Bearer ${authToken}`);

      const response = await request(app)
        .get('/api/v1/snapshots')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.length > 0) {
        const snapshot = response.body[0];
        expect(snapshot).toHaveProperty('totalItems');
        expect(snapshot).toHaveProperty('completed');
        expect(snapshot).toHaveProperty('completionsThisWeek');
        expect(snapshot).toHaveProperty('streakDays');
        expect(snapshot).toHaveProperty('genreGravity');
      }
    });
  });
});

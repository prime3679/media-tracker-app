import { describe, it, expect, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import v1Router from '../routes/v1.js';

const app = express();
app.use(express.json());
app.use('/api/v1', v1Router);

describe('Episodes API', () => {
  let authToken: string;
  let mediaItemId: number;
  let seasonId: number;
  let episodeId: number;

  beforeAll(async () => {
    const hashedPassword = await authService.hashPassword('testpass123');
    await storage.createUser({
      email: 'episodes-test@example.com',
      username: 'episodestest',
      password: hashedPassword,
    });

    const loginResponse = await request(app)
      .post('/api/v1/auth/login')
      .send({
        email: 'episodes-test@example.com',
        password: 'testpass123',
      });
    
    authToken = loginResponse.body.tokens.accessToken;

    const mediaResponse = await request(app)
      .post('/api/v1/media')
      .set('Authorization', `Bearer ${authToken}`)
      .send({
        title: 'Breaking Bad',
        mediaType: 'tv_show',
        status: 'watching',
        progress: 0,
      });
    
    mediaItemId = mediaResponse.body.id;
  });

  describe('POST /api/v1/seasons', () => {
    it('should create a new season', async () => {
      const response = await request(app)
        .post('/api/v1/seasons')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mediaItemId,
          seasonNumber: 1,
          title: 'Season 1',
          episodeCount: 7,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.seasonNumber).toBe(1);
      expect(response.body.title).toBe('Season 1');
      expect(response.body.episodeCount).toBe(7);
      seasonId = response.body.id;
    });

    it('should fail with invalid data', async () => {
      const response = await request(app)
        .post('/api/v1/seasons')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          mediaItemId: 'invalid',
          seasonNumber: -1,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/media/:id/seasons', () => {
    it('should get all seasons for a media item', async () => {
      const response = await request(app)
        .get(`/api/v1/media/${mediaItemId}/seasons`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].seasonNumber).toBe(1);
    });
  });

  describe('POST /api/v1/episodes', () => {
    it('should create a new episode', async () => {
      const response = await request(app)
        .post('/api/v1/episodes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          seasonId,
          episodeNumber: 1,
          title: 'Pilot',
          description: 'The first episode',
          runtime: 58,
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.episodeNumber).toBe(1);
      expect(response.body.title).toBe('Pilot');
      expect(response.body.runtime).toBe(58);
      episodeId = response.body.id;
    });

    it('should fail with missing required fields', async () => {
      const response = await request(app)
        .post('/api/v1/episodes')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          seasonId,
          episodeNumber: 2,
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /api/v1/seasons/:id/episodes', () => {
    it('should get all episodes for a season', async () => {
      const response = await request(app)
        .get(`/api/v1/seasons/${seasonId}/episodes`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      expect(response.body[0].episodeNumber).toBe(1);
      expect(response.body[0].title).toBe('Pilot');
    });
  });

  describe('Episode progress tracking', () => {
    it('should update tracking with episode progress', async () => {
      const response = await request(app)
        .put(`/api/v1/media/${mediaItemId}/tracking`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'watching',
          progress: 1,
          episodeId,
        })
        .expect(200);

      expect(response.body.progress).toBe(1);
      expect(response.body.episodeId).toBe(episodeId);
    });

    it('should retrieve tracking data with episode information', async () => {
      const response = await request(app)
        .get('/api/v1/media')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const mediaItem = response.body.find((m: { id: number }) => m.id === mediaItemId);
      expect(mediaItem).toBeDefined();
      expect(mediaItem.tracking).toBeDefined();
      expect(mediaItem.tracking.progress).toBe(1);
    });
  });
});

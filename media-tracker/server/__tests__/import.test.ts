import { describe, it, expect, beforeAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import importRouter from '../routes/import.js';
import * as tmdb from '../services/tmdb.js';
import * as openlibrary from '../services/openlibrary.js';

const app = express();
app.use(express.json());

app.use((req, _res, next) => {
  req.user = { userId: 1, email: 'test@example.com' };
  next();
});

app.use('/api/v1/import', importRouter);

describe('Import API', () => {
  const testUser = {
    email: 'import-test@example.com',
    password: 'password123',
    username: 'importtestuser',
  };

  beforeAll(async () => {
    const hashedPassword = await authService.hashPassword(testUser.password);
    try {
      await storage.createUser({
        email: testUser.email,
        username: testUser.username,
        password: hashedPassword,
      });
    } catch {
    }
  });

  describe('GET /api/v1/import/search', () => {
    it('should search for movies with valid query', async () => {
      vi.spyOn(tmdb, 'searchMovies').mockResolvedValue([
        {
          title: 'The Matrix',
          year: '1999',
          poster: 'https://example.com/poster.jpg',
          external_id: 'tmdb:603',
        },
        {
          title: 'The Matrix Reloaded',
          year: '2003',
          poster: 'https://example.com/poster2.jpg',
          external_id: 'tmdb:604',
        },
      ]);

      const response = await request(app)
        .get('/api/v1/import/search')
        .query({ query: 'matrix', type: 'movie' })
        .expect(200);

      expect(response.body).toHaveLength(2);
      expect(response.body[0]).toHaveProperty('title');
      expect(response.body[0]).toHaveProperty('year');
      expect(response.body[0]).toHaveProperty('poster');
      expect(response.body[0]).toHaveProperty('external_id');
      expect(response.body[0].external_id).toContain('tmdb:');
    });

    it('should search for TV shows with valid query', async () => {
      vi.spyOn(tmdb, 'searchTvShows').mockResolvedValue([
        {
          title: 'Breaking Bad',
          year: '2008',
          poster: 'https://example.com/poster.jpg',
          external_id: 'tmdb:1396',
        },
      ]);

      const response = await request(app)
        .get('/api/v1/import/search')
        .query({ query: 'breaking bad', type: 'tv' })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('Breaking Bad');
    });

    it('should search for books with valid query', async () => {
      vi.spyOn(openlibrary, 'searchBooks').mockResolvedValue([
        {
          title: 'The Hobbit',
          year: '1937',
          poster: 'https://example.com/poster.jpg',
          external_id: 'openlibrary:OL27479W',
        },
      ]);

      const response = await request(app)
        .get('/api/v1/import/search')
        .query({ query: 'hobbit', type: 'book' })
        .expect(200);

      expect(response.body).toHaveLength(1);
      expect(response.body[0].title).toBe('The Hobbit');
      expect(response.body[0].external_id).toContain('openlibrary:');
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/api/v1/import/search')
        .query({ type: 'movie' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid type parameter', async () => {
      const response = await request(app)
        .get('/api/v1/import/search')
        .query({ query: 'test', type: 'invalid' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return top 5 results maximum', async () => {
      const mockResults = Array.from({ length: 10 }, (_, i) => ({
        title: `Movie ${i}`,
        year: '2020',
        poster: null,
        external_id: `tmdb:${i}`,
      }));

      vi.spyOn(tmdb, 'searchMovies').mockResolvedValue(mockResults);

      const response = await request(app)
        .get('/api/v1/import/search')
        .query({ query: 'test', type: 'movie' })
        .expect(200);

      expect(response.body.length).toBeLessThanOrEqual(5);
    });
  });

  describe('POST /api/v1/import/apply', () => {
    it('should create media item from import data', async () => {
      const importData = {
        title: 'Inception',
        year: '2010',
        poster: 'https://example.com/inception.jpg',
        external_id: 'tmdb:27205',
        type: 'movie',
      };

      const response = await request(app)
        .post('/api/v1/import/apply')
        .send(importData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe('Inception');
      expect(response.body.tmdbId).toBe('tmdb:27205');
      expect(response.body).toHaveProperty('tracking');
      expect(response.body.tracking.status).toBe('to_watch');
    });

    it('should return 409 for duplicate external_id', async () => {
      const importData = {
        title: 'Duplicate Movie',
        year: '2020',
        poster: null,
        external_id: 'tmdb:99999',
        type: 'movie',
      };

      await request(app)
        .post('/api/v1/import/apply')
        .send(importData)
        .expect(201);

      const response = await request(app)
        .post('/api/v1/import/apply')
        .send(importData)
        .expect(409);

      expect(response.body).toHaveProperty('error');
      expect(response.body).toHaveProperty('existingItemId');
    });

    it('should create book with openlibrary external_id', async () => {
      const importData = {
        title: '1984',
        year: '1949',
        poster: null,
        external_id: 'openlibrary:OL1168007W',
        type: 'book',
      };

      const response = await request(app)
        .post('/api/v1/import/apply')
        .send(importData)
        .expect(201);

      expect(response.body.title).toBe('1984');
      expect(response.body.isbn).toBe('openlibrary:OL1168007W');
      expect(response.body.mediaType).toBe('book');
    });

    it('should return 400 for invalid data', async () => {
      const response = await request(app)
        .post('/api/v1/import/apply')
        .send({
          title: '',
          year: '2020',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 for invalid external_id format', async () => {
      const response = await request(app)
        .post('/api/v1/import/apply')
        .send({
          title: 'Test Movie',
          year: '2020',
          poster: null,
          external_id: 'invalid:123',
          type: 'movie',
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});

import { describe, it, expect, beforeEach, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const selectMock = vi.fn();

function flattenSql(sql: unknown): string {
  if (!sql) return '';
  if (typeof sql === 'string') return sql;
  if (Array.isArray(sql)) {
    return sql.map(chunk => flattenSql(chunk)).join('');
  }
  if (typeof sql === 'object') {
    if ('queryChunks' in (sql as Record<string, unknown>)) {
      return flattenSql((sql as { queryChunks: unknown[] }).queryChunks);
    }
    if ('value' in (sql as Record<string, unknown>)) {
      const value = (sql as { value: unknown }).value;
      return Array.isArray(value) ? value.join('') : flattenSql(value);
    }
    if ('sql' in (sql as Record<string, unknown>)) {
      return flattenSql((sql as { sql: unknown }).sql);
    }
  }
  return '';
}

vi.mock('../db.js', () => ({
  db: {
    select: (...args: unknown[]) => selectMock(...args),
  },
}));

import searchRouter from '../routes/search.js';

const app = express();
const testUserId = 123;

app.use((req, _res, next) => {
  req.user = { userId: testUserId, email: 'search-test@example.com' };
  next();
});

app.use('/api/v1/search', searchRouter);

describe('Search API', () => {
  beforeEach(() => {
    selectMock.mockReset();

    selectMock.mockImplementationOnce((selection?: Record<string, unknown>) => {
      if (selection?.rank) {
        const sqlText = flattenSql(selection.rank);
        expect(sqlText).toContain('plainto_tsquery(');
        expect(sqlText).not.toMatch(/[^a-z]to_tsquery\(/);
      }

      return {
        from: () => ({
          where: () => ({
            orderBy: () => Promise.resolve([
              {
                id: 1,
                userId: testUserId,
                mediaType: 'movie',
                title: 'Dune: Part Two',
                description: 'Sci-fi epic sequel',
                imageUrl: null,
                releaseDate: null,
                genres: null,
                director: null,
                author: null,
                isbn: null,
                tmdbId: null,
                imdbId: null,
                totalSeasons: null,
                totalEpisodes: null,
                totalPages: null,
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                rank: 1,
              },
            ]),
          }),
        }),
      };
    });

    selectMock.mockImplementationOnce(() => ({
      from: () => ({
        where: () => Promise.resolve([]),
      }),
    }));
  });

  it('returns results for punctuation heavy queries', async () => {
    const response = await request(app)
      .get('/api/v1/search')
      .query({ q: 'Dune: Part Two' })
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body.length).toBeGreaterThan(0);
    expect(response.body[0].title).toBe('Dune: Part Two');
  });
});

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

extendZodWithOpenApi(z);

export const ratingSchema = z.union([
  z.coerce.number().min(1).max(10),
  z.literal(null)
]).optional().openapi({
  description: 'Rating from 1-10, or null if not rated',
  example: 8
});

export const mediaTypeSchema = z.enum(['movie', 'tv_show', 'book']).openapi({
  description: 'Type of media item',
  example: 'movie'
});

export const statusSchema = z.enum(['to_watch', 'watching', 'completed', 'on_hold', 'dropped']).openapi({
  description: 'Current tracking status',
  example: 'watching'
});

export const createMediaSchema = z.object({
  title: z.string().min(1).max(500).openapi({ example: 'The Matrix' }),
  mediaType: mediaTypeSchema,
  description: z.string().max(2000).optional().openapi({ example: 'A computer hacker learns...' }),
  author: z.string().max(200).optional().openapi({ example: 'Isaac Asimov' }),
  director: z.string().max(200).optional().openapi({ example: 'Christopher Nolan' }),
  genres: z.string().max(500).optional().openapi({ example: 'Action, Sci-Fi' }),
  status: statusSchema.default('to_watch'),
  rating: ratingSchema,
  notes: z.string().max(1000).optional().openapi({ example: 'Must watch again' }),
  progress: z.coerce.number().min(0).default(0).openapi({ example: 0 })
}).openapi('CreateMedia');

export const updateTrackingSchema = z.object({
  status: statusSchema.optional(),
  rating: ratingSchema,
  notes: z.string().max(1000).optional(),
  progress: z.coerce.number().min(0).optional()
}).openapi('UpdateTracking');

export const mediaWithTrackingSchema = z.object({
  id: z.number(),
  userId: z.number(),
  title: z.string(),
  mediaType: mediaTypeSchema,
  description: z.string().nullable(),
  author: z.string().nullable(),
  director: z.string().nullable(),
  genres: z.string().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
  tracking: z.object({
    id: z.number(),
    status: statusSchema,
    rating: z.string().nullable(),
    progress: z.number(),
    notes: z.string().nullable(),
    completedDate: z.date().nullable(),
  }).nullable()
}).openapi('MediaWithTracking');

export const statsSchema = z.object({
  totalItems: z.number(),
  completed: z.number(),
  watching: z.number(),
  toWatch: z.number(),
  onHold: z.number(),
  dropped: z.number(),
  movies: z.number(),
  tvShows: z.number(),
  books: z.number()
}).openapi('Stats');

export const healthSchema = z.object({
  status: z.string(),
  timestamp: z.string()
}).openapi('Health');

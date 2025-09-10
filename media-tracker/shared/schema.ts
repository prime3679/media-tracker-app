import { pgTable, serial, text, integer, boolean, timestamp, decimal, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for media types and status
export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv_show', 'book']);
export const statusEnum = pgEnum('status', ['to_watch', 'watching', 'completed', 'dropped', 'on_hold']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

// Media items table (movies, tv shows, books)
export const mediaItems = pgTable('media_items', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  mediaType: mediaTypeEnum('media_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  releaseDate: text('release_date'), // Store as string for flexibility
  genres: text('genres'), // JSON string of genres
  director: text('director'), // For movies
  author: text('author'), // For books
  isbn: text('isbn'), // For books
  tmdbId: text('tmdb_id'), // For movies/TV shows
  imdbId: text('imdb_id'), // For movies/TV shows
  totalSeasons: integer('total_seasons'), // For TV shows
  totalEpisodes: integer('total_episodes'), // For TV shows
  totalPages: integer('total_pages'), // For books
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// User's tracking of media items
export const mediaTracking = pgTable('media_tracking', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  mediaItemId: integer('media_item_id').notNull(),
  status: statusEnum('status').notNull().default('to_watch'),
  rating: decimal('rating', { precision: 3, scale: 1 }), // 0.0 to 10.0
  progress: integer('progress').default(0), // Episodes watched or pages read
  notes: text('notes'),
  startDate: timestamp('start_date'),
  completedDate: timestamp('completed_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  mediaItems: many(mediaItems),
  mediaTracking: many(mediaTracking),
}));

export const mediaItemsRelations = relations(mediaItems, ({ one, many }) => ({
  user: one(users, {
    fields: [mediaItems.userId],
    references: [users.id],
  }),
  tracking: many(mediaTracking),
}));

export const mediaTrackingRelations = relations(mediaTracking, ({ one }) => ({
  user: one(users, {
    fields: [mediaTracking.userId],
    references: [users.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [mediaTracking.mediaItemId],
    references: [mediaItems.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = typeof mediaItems.$inferInsert;
export type MediaTracking = typeof mediaTracking.$inferSelect;
export type InsertMediaTracking = typeof mediaTracking.$inferInsert;
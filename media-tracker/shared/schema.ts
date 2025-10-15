import { pgTable, serial, text, integer, timestamp, decimal, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enums for media types and status
export const mediaTypeEnum = pgEnum('media_type', ['movie', 'tv_show', 'book']);
export const statusEnum = pgEnum('status', ['to_watch', 'watching', 'completed', 'dropped', 'on_hold']);

// Users table
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  username: text('username').notNull().unique(),
  email: text('email').notNull().unique(),
  password: text('password').notNull(),
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
}, (table) => ({
  userIdUpdatedAtIdx: index('media_items_user_id_updated_at_idx').on(table.userId, table.updatedAt),
}));

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
}, (table) => ({
  userIdStatusIdx: index('media_tracking_user_id_status_idx').on(table.userId, table.status),
  userIdUpdatedAtIdx: index('media_tracking_user_id_updated_at_idx').on(table.userId, table.updatedAt),
}));

export const refreshTokens = pgTable('refresh_tokens', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expires_at').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  revokedAt: timestamp('revoked_at'),
}, (table) => ({
  userIdIdx: index('refresh_tokens_user_id_idx').on(table.userId),
  tokenIdx: index('refresh_tokens_token_idx').on(table.token),
}));

// Relations
export const usersRelations = relations(users, ({ many }) => ({
  mediaItems: many(mediaItems),
  mediaTracking: many(mediaTracking),
  refreshTokens: many(refreshTokens),
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

export const refreshTokensRelations = relations(refreshTokens, ({ one }) => ({
  user: one(users, {
    fields: [refreshTokens.userId],
    references: [users.id],
  }),
}));

export const idempotencyKeys = pgTable('idempotency_keys', {
  id: serial('id').primaryKey(),
  key: text('key').notNull().unique(),
  userId: integer('user_id').notNull(),
  endpoint: text('endpoint').notNull(),
  responseStatus: integer('response_status'),
  responseBody: text('response_body'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  expiresAt: timestamp('expires_at').notNull(),
}, (table) => ({
  keyIdx: index('idempotency_keys_key_idx').on(table.key),
  expiresAtIdx: index('idempotency_keys_expires_at_idx').on(table.expiresAt),
}));

export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  user: one(users, {
    fields: [idempotencyKeys.userId],
    references: [users.id],
  }),
}));

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type MediaItem = typeof mediaItems.$inferSelect;
export type InsertMediaItem = typeof mediaItems.$inferInsert;
export type MediaTracking = typeof mediaTracking.$inferSelect;
export type InsertMediaTracking = typeof mediaTracking.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = typeof idempotencyKeys.$inferInsert;

import { pgTable, serial, text, integer, timestamp, decimal, pgEnum, index } from 'drizzle-orm/pg-core';
import { relations, sql } from 'drizzle-orm';

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
  backdropUrl: text('backdrop_url'),  // Cinematic backdrop image (16:9)
  trailerUrl: text('trailer_url'),    // YouTube trailer URL
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
  titleTrigramIdx: index('media_items_title_trigram_idx').using('gin', sql`${table.title} gin_trgm_ops`),
  searchVectorIdx: index('media_items_search_vector_idx').using('gin', sql`(
    setweight(to_tsvector('english', coalesce(${table.title}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${table.director}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${table.author}, '')), 'B')
  )`),
}));

// User's tracking of media items
export const mediaTracking = pgTable('media_tracking', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  mediaItemId: integer('media_item_id').notNull(),
  episodeId: integer('episode_id'),
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
  seasons: many(seasons),
}));

export const seasons = pgTable('seasons', {
  id: serial('id').primaryKey(),
  mediaItemId: integer('media_item_id').notNull(),
  seasonNumber: integer('season_number').notNull(),
  title: text('title'),
  episodeCount: integer('episode_count'),
  airDate: text('air_date'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  mediaItemIdIdx: index('seasons_media_item_id_idx').on(table.mediaItemId),
}));

export const episodes = pgTable('episodes', {
  id: serial('id').primaryKey(),
  seasonId: integer('season_id').notNull(),
  episodeNumber: integer('episode_number').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  airDate: text('air_date'),
  runtime: integer('runtime'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  seasonIdIdx: index('episodes_season_id_idx').on(table.seasonId),
}));

export const seasonsRelations = relations(seasons, ({ one, many }) => ({
  mediaItem: one(mediaItems, {
    fields: [seasons.mediaItemId],
    references: [mediaItems.id],
  }),
  episodes: many(episodes),
}));

export const episodesRelations = relations(episodes, ({ one, many }) => ({
  season: one(seasons, {
    fields: [episodes.seasonId],
    references: [seasons.id],
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
  episode: one(episodes, {
    fields: [mediaTracking.episodeId],
    references: [episodes.id],
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

export const weeklyStatsSnapshots = pgTable('weekly_stats_snapshots', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  weekStart: timestamp('week_start').notNull(),
  totalItems: integer('total_items').notNull(),
  completed: integer('completed').notNull(),
  watching: integer('watching').notNull(),
  toWatch: integer('to_watch').notNull(),
  completionsThisWeek: integer('completions_this_week').notNull(),
  completionVelocity: decimal('completion_velocity', { precision: 5, scale: 2 }),
  streakDays: integer('streak_days').notNull(),
  genreGravity: text('genre_gravity'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdWeekStartIdx: index('weekly_stats_snapshots_user_id_week_start_idx').on(table.userId, table.weekStart),
}));

export const idempotencyKeysRelations = relations(idempotencyKeys, ({ one }) => ({
  user: one(users, {
    fields: [idempotencyKeys.userId],
    references: [users.id],
  }),
}));

export const weeklyStatsSnapshotsRelations = relations(weeklyStatsSnapshots, ({ one }) => ({
  user: one(users, {
    fields: [weeklyStatsSnapshots.userId],
    references: [users.id],
  }),
}));

export const usersWithSnapshotsRelations = relations(users, ({ many }) => ({
  weeklyStatsSnapshots: many(weeklyStatsSnapshots),
}));

// Genres table - normalized genre system with visual identity
export const genres = pgTable('genres', {
  id: serial('id').primaryKey(),
  name: text('name').notNull().unique(),
  slug: text('slug').notNull().unique(),
  color: text('color').notNull(), // Hex color for visual identity
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  slugIdx: index('genres_slug_idx').on(table.slug),
}));

// Many-to-many junction table for media items and genres
export const mediaGenres = pgTable('media_genres', {
  id: serial('id').primaryKey(),
  mediaItemId: integer('media_item_id').notNull(),
  genreId: integer('genre_id').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  mediaItemIdIdx: index('media_genres_media_item_id_idx').on(table.mediaItemId),
  genreIdIdx: index('media_genres_genre_id_idx').on(table.genreId),
  // Unique constraint to prevent duplicates
  mediaItemGenreUnique: index('media_genres_media_item_genre_unique').on(table.mediaItemId, table.genreId),
}));

// Genre relations
export const genresRelations = relations(genres, ({ many }) => ({
  mediaGenres: many(mediaGenres),
}));

export const mediaGenresRelations = relations(mediaGenres, ({ one }) => ({
  mediaItem: one(mediaItems, {
    fields: [mediaGenres.mediaItemId],
    references: [mediaItems.id],
  }),
  genre: one(genres, {
    fields: [mediaGenres.genreId],
    references: [genres.id],
  }),
}));

// Update mediaItems relations to include genres
export const mediaItemsWithGenresRelations = relations(mediaItems, ({ one, many }) => ({
  user: one(users, {
    fields: [mediaItems.userId],
    references: [users.id],
  }),
  tracking: many(mediaTracking),
  seasons: many(seasons),
  mediaGenres: many(mediaGenres),
}));

// Skip reasons for algorithm learning
export const skipReasons = pgTable('skip_reasons', {
  id: serial('id').primaryKey(),
  userId: integer('user_id').notNull(),
  mediaItemId: integer('media_item_id').notNull(),
  reason: text('reason').notNull(), // 'not_interested', 'wrong_mood', 'too_long', 'seen_it', 'other'
  feedback: text('feedback'), // Optional text feedback
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('skip_reasons_user_id_idx').on(table.userId),
  mediaItemIdIdx: index('skip_reasons_media_item_id_idx').on(table.mediaItemId),
}));

// Discovery Catalog - Shared catalog of curated movies, TV shows, and books
// This is NOT user-specific - it's a shared pool for discovery challenges and recommendations
export const discoveryCatalog = pgTable('discovery_catalog', {
  id: serial('id').primaryKey(),
  mediaType: mediaTypeEnum('media_type').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  imageUrl: text('image_url'),
  backdropUrl: text('backdrop_url'),
  trailerUrl: text('trailer_url'),
  releaseDate: text('release_date'), // YYYY-MM-DD format
  releaseYear: integer('release_year'), // For easy decade filtering
  genres: text('genres'), // JSON array of genre names
  director: text('director'), // For movies
  cast: text('cast'), // JSON array of main cast members
  author: text('author'), // For books
  country: text('country'), // Primary production country
  language: text('language'), // Original language
  tmdbId: text('tmdb_id').unique(), // For movies/TV shows
  imdbId: text('imdb_id'), // For movies/TV shows
  isbn: text('isbn'), // For books
  tmdbRating: decimal('tmdb_rating', { precision: 3, scale: 1 }), // 0.0 to 10.0
  imdbRating: decimal('imdb_rating', { precision: 3, scale: 1 }), // 0.0 to 10.0
  popularityScore: integer('popularity_score'), // TMDB popularity metric
  runtime: integer('runtime'), // Minutes for movies, average episode length for TV
  totalSeasons: integer('total_seasons'), // For TV shows
  totalEpisodes: integer('total_episodes'), // For TV shows
  totalPages: integer('total_pages'), // For books
  isCurated: integer('is_curated').default(1), // 1 = manually curated, 0 = auto-imported
  curatedReason: text('curated_reason'), // Why this was included (e.g., "IMDb Top 250", "Criterion Collection")
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => ({
  mediaTypeIdx: index('discovery_catalog_media_type_idx').on(table.mediaType),
  releaseYearIdx: index('discovery_catalog_release_year_idx').on(table.releaseYear),
  tmdbIdIdx: index('discovery_catalog_tmdb_id_idx').on(table.tmdbId),
  popularityIdx: index('discovery_catalog_popularity_idx').on(table.popularityScore),
  titleTrigramIdx: index('discovery_catalog_title_trigram_idx').using('gin', sql`${table.title} gin_trgm_ops`),
  // Full-text search on title and director
  searchVectorIdx: index('discovery_catalog_search_vector_idx').using('gin', sql`(
    setweight(to_tsvector('english', coalesce(${table.title}, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(${table.director}, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(${table.author}, '')), 'B')
  )`),
}));

export const skipReasonsRelations = relations(skipReasons, ({ one }) => ({
  user: one(users, {
    fields: [skipReasons.userId],
    references: [users.id],
  }),
  mediaItem: one(mediaItems, {
    fields: [skipReasons.mediaItemId],
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
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type InsertRefreshToken = typeof refreshTokens.$inferInsert;
export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = typeof idempotencyKeys.$inferInsert;
export type Season = typeof seasons.$inferSelect;
export type InsertSeason = typeof seasons.$inferInsert;
export type Episode = typeof episodes.$inferSelect;
export type InsertEpisode = typeof episodes.$inferInsert;
export type WeeklyStatsSnapshot = typeof weeklyStatsSnapshots.$inferSelect;
export type InsertWeeklyStatsSnapshot = typeof weeklyStatsSnapshots.$inferInsert;
export type Genre = typeof genres.$inferSelect;
export type InsertGenre = typeof genres.$inferInsert;
export type MediaGenre = typeof mediaGenres.$inferSelect;
export type InsertMediaGenre = typeof mediaGenres.$inferInsert;
export type SkipReason = typeof skipReasons.$inferSelect;
export type InsertSkipReason = typeof skipReasons.$inferInsert;
export type DiscoveryCatalogItem = typeof discoveryCatalog.$inferSelect;
export type InsertDiscoveryCatalogItem = typeof discoveryCatalog.$inferInsert;

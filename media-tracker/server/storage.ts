import { mediaItems, mediaTracking, users, refreshTokens, seasons, episodes, weeklyStatsSnapshots, type User, type InsertUser, type MediaItem, type InsertMediaItem, type MediaTracking, type InsertMediaTracking, type RefreshToken, type InsertRefreshToken, type Season, type InsertSeason, type Episode, type InsertEpisode, type WeeklyStatsSnapshot, type InsertWeeklyStatsSnapshot } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and, lt, desc } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(insertUser: InsertUser): Promise<User>;
  
  // Media item methods
  getMediaItem(id: number): Promise<MediaItem | undefined>;
  getUserMediaItems(userId: number): Promise<MediaItem[]>;
  createMediaItem(insertMediaItem: InsertMediaItem): Promise<MediaItem>;
  
  // Media tracking methods
  getMediaTracking(userId: number, mediaItemId: number): Promise<MediaTracking | undefined>;
  getUserMediaTracking(userId: number): Promise<MediaTracking[]>;
  createMediaTracking(insertMediaTracking: InsertMediaTracking): Promise<MediaTracking>;
  updateMediaTracking(id: number, updates: Partial<MediaTracking>): Promise<MediaTracking>;
  
  getSeason(id: number): Promise<Season | undefined>;
  getMediaItemSeasons(mediaItemId: number): Promise<Season[]>;
  createSeason(insertSeason: InsertSeason): Promise<Season>;
  
  getEpisode(id: number): Promise<Episode | undefined>;
  getSeasonEpisodes(seasonId: number): Promise<Episode[]>;
  createEpisode(insertEpisode: InsertEpisode): Promise<Episode>;
  
  getLatestSnapshot(userId: number): Promise<WeeklyStatsSnapshot | undefined>;
  getUserSnapshots(userId: number, limit?: number): Promise<WeeklyStatsSnapshot[]>;
  createSnapshot(insertSnapshot: InsertWeeklyStatsSnapshot): Promise<WeeklyStatsSnapshot>;
  
  getRefreshToken(token: string): Promise<RefreshToken | undefined>;
  createRefreshToken(insertRefreshToken: InsertRefreshToken): Promise<RefreshToken>;
  revokeRefreshToken(token: string): Promise<void>;
  revokeAllUserRefreshTokens(userId: number): Promise<void>;
  deleteExpiredRefreshTokens(): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getMediaItem(id: number): Promise<MediaItem | undefined> {
    const [item] = await db.select().from(mediaItems).where(eq(mediaItems.id, id));
    return item || undefined;
  }

  async getUserMediaItems(userId: number): Promise<MediaItem[]> {
    return await db.select().from(mediaItems).where(eq(mediaItems.userId, userId));
  }

  async createMediaItem(insertMediaItem: InsertMediaItem): Promise<MediaItem> {
    const [item] = await db
      .insert(mediaItems)
      .values(insertMediaItem)
      .returning();
    return item;
  }

  async getMediaTracking(userId: number, mediaItemId: number): Promise<MediaTracking | undefined> {
    const [tracking] = await db
      .select()
      .from(mediaTracking)
      .where(and(eq(mediaTracking.userId, userId), eq(mediaTracking.mediaItemId, mediaItemId)));
    return tracking || undefined;
  }

  async getUserMediaTracking(userId: number): Promise<MediaTracking[]> {
    return await db.select().from(mediaTracking).where(eq(mediaTracking.userId, userId));
  }

  async createMediaTracking(insertMediaTracking: InsertMediaTracking): Promise<MediaTracking> {
    const [tracking] = await db
      .insert(mediaTracking)
      .values(insertMediaTracking)
      .returning();
    return tracking;
  }

  async updateMediaTracking(id: number, updates: Partial<MediaTracking>): Promise<MediaTracking> {
    const [tracking] = await db
      .update(mediaTracking)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(mediaTracking.id, id))
      .returning();
    return tracking;
  }

  async getRefreshToken(token: string): Promise<RefreshToken | undefined> {
    const [refreshToken] = await db
      .select()
      .from(refreshTokens)
      .where(eq(refreshTokens.token, token));
    return refreshToken || undefined;
  }

  async createRefreshToken(insertRefreshToken: InsertRefreshToken): Promise<RefreshToken> {
    const [refreshToken] = await db
      .insert(refreshTokens)
      .values(insertRefreshToken)
      .returning();
    return refreshToken;
  }

  async revokeRefreshToken(token: string): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.token, token));
  }

  async revokeAllUserRefreshTokens(userId: number): Promise<void> {
    await db
      .update(refreshTokens)
      .set({ revokedAt: new Date() })
      .where(eq(refreshTokens.userId, userId));
  }

  async deleteExpiredRefreshTokens(): Promise<void> {
    await db
      .delete(refreshTokens)
      .where(lt(refreshTokens.expiresAt, new Date()));
  }

  async getSeason(id: number): Promise<Season | undefined> {
    const [season] = await db.select().from(seasons).where(eq(seasons.id, id));
    return season || undefined;
  }

  async getMediaItemSeasons(mediaItemId: number): Promise<Season[]> {
    return await db.select().from(seasons).where(eq(seasons.mediaItemId, mediaItemId));
  }

  async createSeason(insertSeason: InsertSeason): Promise<Season> {
    const [season] = await db
      .insert(seasons)
      .values(insertSeason)
      .returning();
    return season;
  }

  async getEpisode(id: number): Promise<Episode | undefined> {
    const [episode] = await db.select().from(episodes).where(eq(episodes.id, id));
    return episode || undefined;
  }

  async getSeasonEpisodes(seasonId: number): Promise<Episode[]> {
    return await db.select().from(episodes).where(eq(episodes.seasonId, seasonId));
  }

  async createEpisode(insertEpisode: InsertEpisode): Promise<Episode> {
    const [episode] = await db
      .insert(episodes)
      .values(insertEpisode)
      .returning();
    return episode;
  }

  async getLatestSnapshot(userId: number): Promise<WeeklyStatsSnapshot | undefined> {
    const [snapshot] = await db
      .select()
      .from(weeklyStatsSnapshots)
      .where(eq(weeklyStatsSnapshots.userId, userId))
      .orderBy(desc(weeklyStatsSnapshots.weekStart))
      .limit(1);
    return snapshot || undefined;
  }

  async getUserSnapshots(userId: number, limit = 10): Promise<WeeklyStatsSnapshot[]> {
    return await db
      .select()
      .from(weeklyStatsSnapshots)
      .where(eq(weeklyStatsSnapshots.userId, userId))
      .orderBy(desc(weeklyStatsSnapshots.weekStart))
      .limit(limit);
  }

  async createSnapshot(insertSnapshot: InsertWeeklyStatsSnapshot): Promise<WeeklyStatsSnapshot> {
    const [snapshot] = await db
      .insert(weeklyStatsSnapshots)
      .values(insertSnapshot)
      .returning();
    return snapshot;
  }
}

export const storage = new DatabaseStorage();

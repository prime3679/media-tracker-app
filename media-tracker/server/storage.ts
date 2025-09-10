import { mediaItems, mediaTracking, users, type User, type InsertUser, type MediaItem, type InsertMediaItem, type MediaTracking, type InsertMediaTracking } from "../shared/schema.js";
import { db } from "./db.js";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
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
}

export const storage = new DatabaseStorage();
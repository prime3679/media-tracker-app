import { db } from '../db.js';
import { storage } from '../storage.js';
import { users, mediaTracking, mediaItems } from '../../shared/schema.js';
import { eq, and, sql } from 'drizzle-orm';

interface WeeklyStatsResult {
  userId: number;
  totalItems: number;
  completed: number;
  watching: number;
  toWatch: number;
  completionsThisWeek: number;
  streakDays: number;
  genreGravity: { genre: string; count: number }[];
}

function getWeekStart(date: Date = new Date()): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day;
  d.setDate(diff);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const end = new Date(weekStart);
  end.setDate(end.getDate() + 7);
  return end;
}

async function calculateStreakDays(userId: number): Promise<number> {
  const trackingRecords = await db
    .select({
      completedDate: mediaTracking.completedDate,
    })
    .from(mediaTracking)
    .where(
      and(
        eq(mediaTracking.userId, userId),
        eq(mediaTracking.status, 'completed')
      )
    )
    .orderBy(sql`${mediaTracking.completedDate} DESC`);

  if (trackingRecords.length === 0 || !trackingRecords[0].completedDate) {
    return 0;
  }

  let streak = 0;
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);

  const completedDates = trackingRecords
    .filter(r => r.completedDate)
    .map(r => {
      const d = new Date(r.completedDate!);
      d.setHours(0, 0, 0, 0);
      return d.getTime();
    });

  const uniqueDates = [...new Set(completedDates)].sort((a, b) => b - a);

  for (const dateTime of uniqueDates) {
    const diff = Math.floor((currentDate.getTime() - dateTime) / (1000 * 60 * 60 * 24));
    
    if (diff === streak) {
      streak++;
    } else if (diff > streak) {
      break;
    }
  }

  return streak;
}

async function calculateGenreGravity(userId: number): Promise<{ genre: string; count: number }[]> {
  const userMediaItems = await db
    .select({
      genres: mediaItems.genres,
    })
    .from(mediaItems)
    .where(eq(mediaItems.userId, userId));

  const genreCount = new Map<string, number>();

  for (const item of userMediaItems) {
    if (!item.genres) continue;
    
    const genres = item.genres.split(',').map(g => g.trim());
    for (const genre of genres) {
      if (genre) {
        genreCount.set(genre, (genreCount.get(genre) || 0) + 1);
      }
    }
  }

  return Array.from(genreCount.entries())
    .map(([genre, count]) => ({ genre, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
}

export async function calculateWeeklyStats(userId: number): Promise<WeeklyStatsResult> {
  const weekStart = getWeekStart();
  const weekEnd = getWeekEnd(weekStart);

  const allTracking = await storage.getUserMediaTracking(userId);
  const userMediaItems = await storage.getUserMediaItems(userId);

  const completed = allTracking.filter(t => t.status === 'completed').length;
  const watching = allTracking.filter(t => t.status === 'watching').length;
  const toWatch = allTracking.filter(t => t.status === 'to_watch').length;

  const completionsThisWeek = allTracking.filter(t => {
    if (!t.completedDate) return false;
    const completedDate = new Date(t.completedDate);
    return completedDate >= weekStart && completedDate < weekEnd;
  }).length;

  const streakDays = await calculateStreakDays(userId);
  const genreGravity = await calculateGenreGravity(userId);

  return {
    userId,
    totalItems: userMediaItems.length,
    completed,
    watching,
    toWatch,
    completionsThisWeek,
    streakDays,
    genreGravity,
  };
}

export async function generateWeeklyDigest(userId: number): Promise<void> {
  const weekStart = getWeekStart();
  const stats = await calculateWeeklyStats(userId);

  const previousSnapshot = await storage.getLatestSnapshot(userId);
  
  const completionVelocity = previousSnapshot 
    ? stats.completionsThisWeek 
    : 0;

  await storage.createSnapshot({
    userId: stats.userId,
    weekStart,
    totalItems: stats.totalItems,
    completed: stats.completed,
    watching: stats.watching,
    toWatch: stats.toWatch,
    completionsThisWeek: stats.completionsThisWeek,
    completionVelocity: completionVelocity.toString(),
    streakDays: stats.streakDays,
    genreGravity: JSON.stringify(stats.genreGravity),
  });
}

export async function generateWeeklyDigestForAllUsers(): Promise<void> {
  const allUsers = await db.select({ id: users.id }).from(users);
  
  const startTime = Date.now();
  
  for (const user of allUsers) {
    await generateWeeklyDigest(user.id);
  }
  
  const duration = Date.now() - startTime;
  console.log(`Generated ${allUsers.length} weekly digests in ${duration}ms`);
}

import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { eq, and, gte, desc, sql } from 'drizzle-orm';

export interface NextUpItem {
  id: number;
  userId: number;
  mediaType: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  releaseDate: string | null;
  genres: string | null;
  director: string | null;
  author: string | null;
  isbn: string | null;
  tmdbId: string | null;
  imdbId: string | null;
  totalSeasons: number | null;
  totalEpisodes: number | null;
  totalPages: number | null;
  createdAt: Date;
  updatedAt: Date;
  tracking: typeof mediaTracking.$inferSelect | null;
}

export async function getNextUpItems(userId: number): Promise<NextUpItem[]> {
  const fourteenDaysAgo = new Date();
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);

  const sixtyDaysAgo = new Date();
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

  const inProgressItems = await db
    .select({
      item: mediaItems,
      tracking: mediaTracking,
    })
    .from(mediaItems)
    .innerJoin(
      mediaTracking,
      and(
        eq(mediaTracking.mediaItemId, mediaItems.id),
        eq(mediaTracking.userId, userId)
      )
    )
    .where(
      and(
        eq(mediaItems.userId, userId),
        eq(mediaTracking.status, 'watching'),
        gte(mediaTracking.updatedAt, fourteenDaysAgo)
      )
    )
    .orderBy(desc(mediaTracking.updatedAt));

  const inProgressResults: NextUpItem[] = inProgressItems.map(({ item, tracking }) => ({
    ...item,
    tracking,
  }));

  if (inProgressResults.length >= 5) {
    return inProgressResults.slice(0, 5);
  }

  const completedInLast60Days = await db
    .select({
      genres: mediaItems.genres,
    })
    .from(mediaItems)
    .innerJoin(
      mediaTracking,
      and(
        eq(mediaTracking.mediaItemId, mediaItems.id),
        eq(mediaTracking.userId, userId)
      )
    )
    .where(
      and(
        eq(mediaItems.userId, userId),
        eq(mediaTracking.status, 'completed'),
        gte(sql`coalesce(${mediaTracking.completedDate}, ${mediaTracking.updatedAt})`, sixtyDaysAgo)
      )
    );

  const genreCounts = new Map<string, number>();
  for (const row of completedInLast60Days) {
    if (row.genres) {
      try {
        const genres = JSON.parse(row.genres) as string[];
        for (const genre of genres) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
      } catch {
        const genres = row.genres.split(',').map(g => g.trim());
        for (const genre of genres) {
          genreCounts.set(genre, (genreCounts.get(genre) || 0) + 1);
        }
      }
    }
  }

  const sortedGenres = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([genre]) => genre);

  const topGenres = sortedGenres.slice(0, 3);

  let newItems: NextUpItem[] = [];
  
  if (topGenres.length > 0) {
    const toWatchItems = await db
      .select({
        item: mediaItems,
        tracking: mediaTracking,
      })
      .from(mediaItems)
      .innerJoin(
        mediaTracking,
        and(
          eq(mediaTracking.mediaItemId, mediaItems.id),
          eq(mediaTracking.userId, userId)
        )
      )
      .where(
        and(
          eq(mediaItems.userId, userId),
          eq(mediaTracking.status, 'to_watch')
        )
      )
      .orderBy(mediaItems.createdAt);

    const scoredItems = toWatchItems.map(({ item, tracking }) => {
      let score = 0;
      if (item.genres) {
        try {
          const genres = JSON.parse(item.genres) as string[];
          for (const genre of genres) {
            const genreIndex = topGenres.indexOf(genre);
            if (genreIndex !== -1) {
              score += (topGenres.length - genreIndex) * 10;
            }
          }
        } catch {
          const genres = item.genres.split(',').map(g => g.trim());
          for (const genre of genres) {
            const genreIndex = topGenres.indexOf(genre);
            if (genreIndex !== -1) {
              score += (topGenres.length - genreIndex) * 10;
            }
          }
        }
      }

      return {
        ...item,
        tracking,
        score,
      };
    });

    scoredItems.sort((a, b) => {
      if (b.score !== a.score) {
        return b.score - a.score;
      }
      return a.createdAt.getTime() - b.createdAt.getTime();
    });

    newItems = scoredItems.slice(0, 2).map(({ score, ...rest }) => {
      void score;
      return rest;
    });
  }

  const combined = [...inProgressResults, ...newItems];
  return combined.slice(0, 5);
}

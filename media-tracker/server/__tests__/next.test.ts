import { describe, it, expect, beforeAll, afterEach } from 'vitest';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import { getNextUpItems } from '../services/next.js';
import { db } from '../db.js';
import { mediaItems, mediaTracking } from '../../shared/schema.js';
import { eq } from 'drizzle-orm';

describe('Next Up Ranking Logic', () => {
  let testUserId: number;

  beforeAll(async () => {
    const hashedPassword = await authService.hashPassword('password123');
    const user = await storage.createUser({
      email: 'nextup-test@example.com',
      username: 'nextupuser',
      password: hashedPassword,
    });
    testUserId = user.id;
  });

  afterEach(async () => {
    await db.delete(mediaTracking).where(eq(mediaTracking.userId, testUserId));
    await db.delete(mediaItems).where(eq(mediaItems.userId, testUserId));
  });

  it('should return in-progress items updated in last 14 days', async () => {
    const [item1] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'In Progress Movie',
      mediaType: 'movie',
    }).returning();

    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: item1.id,
      status: 'watching',
      updatedAt: threeDaysAgo,
    });

    const results = await getNextUpItems(testUserId);

    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('In Progress Movie');
    expect(results[0].tracking?.status).toBe('watching');
  });

  it('should not return in-progress items older than 14 days', async () => {
    const [item1] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Old In Progress',
      mediaType: 'movie',
    }).returning();

    const fifteenDaysAgo = new Date();
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15);

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: item1.id,
      status: 'watching',
      updatedAt: fifteenDaysAgo,
    });

    const results = await getNextUpItems(testUserId);

    expect(results).toHaveLength(0);
  });

  it('should order in-progress items by most recently updated first', async () => {
    const [item1] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Older Update',
      mediaType: 'movie',
    }).returning();

    const [item2] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Recent Update',
      mediaType: 'tv_show',
    }).returning();

    const fiveDaysAgo = new Date();
    fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: item1.id,
      status: 'watching',
      updatedAt: fiveDaysAgo,
    });

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: item2.id,
      status: 'watching',
      updatedAt: twoDaysAgo,
    });

    const results = await getNextUpItems(testUserId);

    expect(results).toHaveLength(2);
    expect(results[0].title).toBe('Recent Update');
    expect(results[1].title).toBe('Older Update');
  });

  it('should recommend new items based on completed genres in last 60 days', async () => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [completed1] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Completed Action Movie',
      mediaType: 'movie',
      genres: JSON.stringify(['Action', 'Thriller']),
    }).returning();

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: completed1.id,
      status: 'completed',
      completedDate: thirtyDaysAgo,
      updatedAt: thirtyDaysAgo,
    });

    const [toWatch1] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Action Movie To Watch',
      mediaType: 'movie',
      genres: JSON.stringify(['Action', 'Adventure']),
    }).returning();

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: toWatch1.id,
      status: 'to_watch',
    });

    const [toWatch2] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Romance Movie To Watch',
      mediaType: 'movie',
      genres: JSON.stringify(['Romance', 'Drama']),
    }).returning();

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: toWatch2.id,
      status: 'to_watch',
    });

    const results = await getNextUpItems(testUserId);

    expect(results.length).toBeGreaterThan(0);
    const titles = results.map(r => r.title);
    expect(titles).toContain('Action Movie To Watch');
  });

  it('should return max 5 items total', async () => {
    for (let i = 0; i < 10; i++) {
      const [item] = await db.insert(mediaItems).values({
        userId: testUserId,
        title: `In Progress ${i}`,
        mediaType: 'movie',
      }).returning();

      await db.insert(mediaTracking).values({
        userId: testUserId,
        mediaItemId: item.id,
        status: 'watching',
      });
    }

    const results = await getNextUpItems(testUserId);

    expect(results).toHaveLength(5);
  });

  it('should combine in-progress and new items up to 5 total', async () => {
    const threeDaysAgo = new Date();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    const [inProgress] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'In Progress Item',
      mediaType: 'movie',
      genres: JSON.stringify(['Action']),
    }).returning();

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: inProgress.id,
      status: 'watching',
      updatedAt: threeDaysAgo,
    });

    const fortyDaysAgo = new Date();
    fortyDaysAgo.setDate(fortyDaysAgo.getDate() - 40);

    const [completed] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Completed Action',
      mediaType: 'movie',
      genres: JSON.stringify(['Action', 'Sci-Fi']),
    }).returning();

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: completed.id,
      status: 'completed',
      completedDate: fortyDaysAgo,
      updatedAt: fortyDaysAgo,
    });

    const [toWatch] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'To Watch Action',
      mediaType: 'movie',
      genres: JSON.stringify(['Action']),
    }).returning();

    await db.insert(mediaTracking).values({
      userId: testUserId,
      mediaItemId: toWatch.id,
      status: 'to_watch',
    });

    const results = await getNextUpItems(testUserId);

    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    
    const titles = results.map(r => r.title);
    expect(titles).toContain('In Progress Item');
  });

  it('should have stable ordering for same inputs', async () => {
    const [item1] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Item 1',
      mediaType: 'movie',
    }).returning();

    const [item2] = await db.insert(mediaItems).values({
      userId: testUserId,
      title: 'Item 2',
      mediaType: 'movie',
    }).returning();

    const twoDaysAgo = new Date();
    twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);

    await db.insert(mediaTracking).values([
      {
        userId: testUserId,
        mediaItemId: item1.id,
        status: 'watching',
        updatedAt: twoDaysAgo,
      },
      {
        userId: testUserId,
        mediaItemId: item2.id,
        status: 'watching',
        updatedAt: twoDaysAgo,
      },
    ]);

    const results1 = await getNextUpItems(testUserId);
    const results2 = await getNextUpItems(testUserId);

    expect(results1.map(r => r.id)).toEqual(results2.map(r => r.id));
  });
});

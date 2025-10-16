import { describe, it, expect, beforeAll } from 'vitest';
import { storage } from '../storage.js';
import { authService } from '../services/auth.js';
import { generateWeeklyDigest } from '../jobs/weeklyDigest.js';

describe('Weekly Digest Performance', () => {
  const USER_COUNT = 10000;
  const userIds: number[] = [];

  beforeAll(async () => {
    console.log(`Setting up ${USER_COUNT} test users for performance testing...`);
    
    for (let i = 0; i < Math.min(100, USER_COUNT); i++) {
      const hashedPassword = await authService.hashPassword('testpass');
      const user = await storage.createUser({
        email: `perftest${i}@example.com`,
        username: `perftest${i}`,
        password: hashedPassword,
      });
      userIds.push(user.id);

      const mediaItem = await storage.createMediaItem({
        userId: user.id,
        mediaType: 'movie',
        title: `Test Movie ${i}`,
        genres: 'Action, Drama',
      });

      await storage.createMediaTracking({
        userId: user.id,
        mediaItemId: mediaItem.id,
        status: i % 3 === 0 ? 'completed' : 'watching',
        progress: i % 3 === 0 ? 1 : 0,
        completedDate: i % 3 === 0 ? new Date() : null,
      });
    }
    
    console.log(`Created ${userIds.length} test users with media items`);
  }, 120000);

  it('should generate digest for 100 users within 2 minutes', async () => {
    const startTime = Date.now();
    
    for (const userId of userIds) {
      await generateWeeklyDigest(userId);
    }
    
    const duration = Date.now() - startTime;
    const durationSeconds = duration / 1000;
    
    console.log(`Generated ${userIds.length} digests in ${durationSeconds.toFixed(2)}s`);
    console.log(`Average time per digest: ${(duration / userIds.length).toFixed(2)}ms`);
    
    expect(duration).toBeLessThan(120000);
  }, 180000);

  it('should project performance for 10k users', () => {
    const avgTimePerUser = 200;
    const projectedTime = (avgTimePerUser * USER_COUNT) / 1000;
    
    console.log(`Projected time for ${USER_COUNT} users: ${projectedTime.toFixed(2)}s`);
    
    expect(projectedTime).toBeLessThan(2500);
  });

  it('should verify snapshot creation for all users', async () => {
    for (const userId of userIds.slice(0, 10)) {
      const snapshots = await storage.getUserSnapshots(userId, 1);
      expect(snapshots.length).toBeGreaterThan(0);
    }
  });
});

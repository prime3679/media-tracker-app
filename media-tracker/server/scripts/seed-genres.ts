#!/usr/bin/env tsx
/**
 * Genre Seeding and Migration Script
 *
 * This script:
 * 1. Seeds the genres table with curated genres and beautiful colors
 * 2. Migrates existing genre data from media_items.genres (text) to the normalized tables
 */

import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { genres, mediaGenres, mediaItems } from '../../shared/schema';
import { sql } from 'drizzle-orm';

// Genre color palette - Each genre gets a distinct, beautiful color
const GENRE_DEFINITIONS = [
  // Movies & TV
  { name: 'Action', slug: 'action', color: '#ef4444' },           // Red
  { name: 'Adventure', slug: 'adventure', color: '#f59e0b' },     // Amber
  { name: 'Animation', slug: 'animation', color: '#ec4899' },     // Pink
  { name: 'Comedy', slug: 'comedy', color: '#fbbf24' },           // Yellow
  { name: 'Crime', slug: 'crime', color: '#64748b' },             // Slate
  { name: 'Documentary', slug: 'documentary', color: '#14b8a6' }, // Teal
  { name: 'Drama', slug: 'drama', color: '#8b5cf6' },             // Purple
  { name: 'Family', slug: 'family', color: '#fb923c' },           // Orange
  { name: 'Fantasy', slug: 'fantasy', color: '#a855f7' },         // Violet
  { name: 'History', slug: 'history', color: '#92400e' },         // Brown
  { name: 'Horror', slug: 'horror', color: '#7c2d12' },           // Dark red
  { name: 'Music', slug: 'music', color: '#ec4899' },             // Hot pink
  { name: 'Mystery', slug: 'mystery', color: '#4f46e5' },         // Indigo
  { name: 'Romance', slug: 'romance', color: '#f43f5e' },         // Rose
  { name: 'Sci-Fi', slug: 'sci-fi', color: '#6366f1' },           // Indigo
  { name: 'Science Fiction', slug: 'science-fiction', color: '#6366f1' }, // Alias
  { name: 'Thriller', slug: 'thriller', color: '#dc2626' },       // Red
  { name: 'War', slug: 'war', color: '#78716c' },                 // Stone
  { name: 'Western', slug: 'western', color: '#d97706' },         // Amber

  // Books
  { name: 'Fiction', slug: 'fiction', color: '#8b5cf6' },         // Purple
  { name: 'Non-Fiction', slug: 'non-fiction', color: '#10b981' }, // Green
  { name: 'Biography', slug: 'biography', color: '#059669' },     // Emerald
  { name: 'Self-Help', slug: 'self-help', color: '#06b6d4' },     // Cyan
  { name: 'Philosophy', slug: 'philosophy', color: '#6366f1' },   // Indigo
  { name: 'Poetry', slug: 'poetry', color: '#db2777' },           // Pink
  { name: 'Young Adult', slug: 'young-adult', color: '#f472b6' }, // Pink
  { name: 'Graphic Novel', slug: 'graphic-novel', color: '#ec4899' }, // Hot pink
];

async function seedGenres() {
  console.log('🎨 Starting genre seeding and migration...\n');

  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
  });

  const db = drizzle(pool);

  try {
    // Step 1: Insert all genre definitions
    console.log('📝 Seeding genres...');

    const insertedGenres = await db
      .insert(genres)
      .values(GENRE_DEFINITIONS)
      .onConflictDoNothing()
      .returning();

    console.log(`✅ Seeded ${insertedGenres.length} genres`);

    // Step 2: Get all existing genres in database (for mapping)
    const allGenres = await db.select().from(genres);
    const genreMap = new Map(allGenres.map(g => [g.slug.toLowerCase(), g.id]));
    const genreNameMap = new Map(allGenres.map(g => [g.name.toLowerCase(), g.id]));

    console.log('\n📚 Migrating existing genre data from media items...');

    // Step 3: Get all media items with genres
    const allMediaItems = await db
      .select({
        id: mediaItems.id,
        genres: mediaItems.genres,
      })
      .from(mediaItems)
      .where(sql`${mediaItems.genres} IS NOT NULL`);

    console.log(`Found ${allMediaItems.length} media items with genres`);

    let migratedCount = 0;
    let skippedCount = 0;

    // Step 4: Migrate each media item's genres
    for (const item of allMediaItems) {
      if (!item.genres) continue;

      let genreList: string[] = [];

      // Parse genres (handle both JSON array and comma-separated strings)
      try {
        genreList = JSON.parse(item.genres);
      } catch {
        // If not JSON, try comma-separated
        genreList = item.genres.split(',').map(g => g.trim()).filter(Boolean);
      }

      // Create media_genres entries
      for (const genreName of genreList) {
        const normalizedName = genreName.toLowerCase().trim();

        // Try to find by name first, then by slug
        let genreId = genreNameMap.get(normalizedName);

        if (!genreId) {
          // Try slug format (replace spaces with hyphens)
          const slugFormat = normalizedName.replace(/\s+/g, '-');
          genreId = genreMap.get(slugFormat);
        }

        if (genreId) {
          try {
            await db
              .insert(mediaGenres)
              .values({
                mediaItemId: item.id,
                genreId: genreId,
              })
              .onConflictDoNothing();

            migratedCount++;
          } catch (error) {
            console.warn(`⚠️  Failed to migrate genre "${genreName}" for item ${item.id}:`, error);
          }
        } else {
          console.warn(`⚠️  Unknown genre: "${genreName}" - consider adding to GENRE_DEFINITIONS`);
          skippedCount++;
        }
      }
    }

    console.log(`\n✅ Migration complete:`);
    console.log(`   - Migrated ${migratedCount} genre associations`);
    if (skippedCount > 0) {
      console.log(`   - Skipped ${skippedCount} unknown genres`);
    }

    // Step 5: Show summary
    const genreUsage = await db.execute(sql`
      SELECT g.name, g.color, COUNT(mg.id) as usage_count
      FROM genres g
      LEFT JOIN media_genres mg ON g.id = mg.genre_id
      GROUP BY g.id, g.name, g.color
      ORDER BY usage_count DESC, g.name
    `);

    console.log('\n📊 Genre usage summary:');
    console.log('─'.repeat(60));
    for (const row of genreUsage.rows) {
      const bar = '█'.repeat(Math.min(20, Math.floor((row.usage_count as number) / 2)));
      console.log(`${(row.name as string).padEnd(20)} ${row.color} ${bar} (${row.usage_count})`);
    }

    console.log('\n🎉 Genre seeding and migration complete!');

  } catch (error) {
    console.error('❌ Error during migration:', error);
    throw error;
  } finally {
    await pool.end();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedGenres()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

export { seedGenres };

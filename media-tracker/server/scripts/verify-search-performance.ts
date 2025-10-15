import { db } from '../db.js';
import { sql } from 'drizzle-orm';

async function verifySearchPerformance() {
  console.log('Verifying search query performance with EXPLAIN ANALYZE...\n');

  const testQuery = 'matrix';
  const tsQuery = testQuery.trim().split(/\s+/).join(' & ');
  const userId = 1;

  console.log('Test query:', testQuery);
  console.log('PostgreSQL tsquery:', tsQuery);
  console.log('User ID:', userId);
  console.log('\n--- EXPLAIN ANALYZE Output ---\n');

  const explainResult = await db.execute(sql`
    EXPLAIN ANALYZE
    SELECT 
      id, title, media_type, director, author,
      ts_rank(
        setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
        setweight(to_tsvector('english', coalesce(director, '')), 'B') ||
        setweight(to_tsvector('english', coalesce(author, '')), 'B'),
        to_tsquery('english', ${tsQuery})
      ) +
      similarity(title, ${testQuery}) * 2 AS rank
    FROM media_items
    WHERE user_id = ${userId}
      AND (
        (
          setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
          setweight(to_tsvector('english', coalesce(director, '')), 'B') ||
          setweight(to_tsvector('english', coalesce(author, '')), 'B')
        ) @@ to_tsquery('english', ${tsQuery})
        OR
        similarity(title, ${testQuery}) > 0.1
      )
    ORDER BY rank DESC
  `);

  for (const row of explainResult.rows) {
    console.log(row['QUERY PLAN']);
  }

  console.log('\n--- Checking for Index Usage ---\n');

  const hasGinIndex = (explainResult.rows as Array<Record<string, string>>).some((row) => {
    const queryPlan = row['QUERY PLAN'];
    return queryPlan && queryPlan.includes('Index') && queryPlan.includes('gin');
  });

  if (hasGinIndex) {
    console.log('✓ GIN index is being used for search');
  } else {
    console.log('✗ WARNING: GIN index not detected in query plan');
  }

  console.log('\n--- Index Information ---\n');

  const indexes = await db.execute(sql`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'media_items'
      AND indexname LIKE '%search%' OR indexname LIKE '%trigram%'
  `);

  if (indexes.rows.length > 0) {
    console.log('Search-related indexes found:');
    for (const idx of indexes.rows) {
      console.log(`\n  Index: ${idx.indexname}`);
      console.log(`  Definition: ${idx.indexdef}`);
    }
  } else {
    console.log('WARNING: No search-related indexes found!');
    console.log('Run: npm run db:migrate');
  }

  console.log('\n--- Performance Check Complete ---\n');

  process.exit(0);
}

verifySearchPerformance().catch((error) => {
  console.error('Error verifying search performance:', error);
  process.exit(1);
});

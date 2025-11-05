# Discovery Catalog Seeding

This document explains how to seed the discovery catalog with curated movies, TV shows, and books for Discovery Challenges and recommendations.

## Overview

The discovery catalog is a shared database of high-quality, popular content that all users can discover from. Unlike personal libraries, this catalog:

- Is shared across all users
- Contains curated popular/acclaimed content
- Powers Discovery Challenges (e.g., "Watch 3 films from the 1970s")
- Provides rich metadata for filtering and recommendations

## Prerequisites

1. **TMDB API Key** - Required for movies and TV shows
   ```bash
   export TMDB_API_KEY="your_api_key_here"
   ```
   Get your API key at: https://www.themoviedb.org/settings/api

2. **Database Connection**
   ```bash
   export DATABASE_URL="postgresql://user:pass@host:port/db"
   ```

3. **Run Migration** (first time only)
   ```bash
   npm run db:generate  # Generate migration
   npm run db:migrate   # Apply to database
   ```

## Usage

### Seed Everything (Recommended)
Seeds both movies and TV shows with default limits:
```bash
npm run seed:catalog
```

This will fetch:
- ~250 popular/top-rated movies
- ~250 popular/top-rated TV shows

### Seed Movies Only
```bash
npm run seed:catalog -- --movies-only
```

### Seed TV Shows Only
```bash
npm run seed:catalog -- --tv-only
```

### Custom Limits
```bash
# Seed 100 movies and 100 TV shows
npm run seed:catalog -- --limit=100

# Seed 50 movies only
npm run seed:catalog -- --movies-only --limit=50
```

## What Gets Seeded

### Movies
- Fetched from TMDB's `popular`, `top_rated`, and `now_playing` lists
- Full metadata including:
  - Title, description, poster, backdrop
  - Director and top 5 cast members
  - Release year (for decade filtering)
  - Genres (for challenge filtering)
  - TMDB/IMDb ratings
  - Runtime
  - Country and language

### TV Shows
- Fetched from TMDB's `popular`, `top_rated`, and `on_the_air` lists
- Full metadata including:
  - Title, description, poster, backdrop
  - Top 5 cast members
  - First air date and year
  - Genres
  - Number of seasons/episodes
  - Average episode runtime
  - Country and language

### Books
_(Not yet implemented - TODO)_

## Rate Limiting

The script respects TMDB's rate limits:
- Minimum 250ms between requests
- Fetches details for each item individually
- Expect seeding to take 10-15 minutes for full catalog

## Idempotency

The script is idempotent:
- Checks if items already exist (by `tmdb_id`)
- Skips existing items
- Safe to run multiple times

## Examples

```bash
# First time setup
npm run db:migrate
npm run seed:catalog

# Add more content later
npm run seed:catalog -- --limit=500

# Refresh TV shows only
npm run seed:catalog -- --tv-only
```

## Querying the Catalog

Once seeded, you can query the catalog:

```typescript
import { db } from './server/db';
import { discoveryCatalog } from './shared/schema';
import { eq, and, gte, lte } from 'drizzle-orm';

// Find 1970s action movies
const seventiesAction = await db
  .select()
  .from(discoveryCatalog)
  .where(
    and(
      eq(discoveryCatalog.mediaType, 'movie'),
      gte(discoveryCatalog.releaseYear, 1970),
      lte(discoveryCatalog.releaseYear, 1979),
      // genres is JSON string, need to use SQL for JSON search
    )
  );
```

## Maintenance

### Updating the Catalog

Re-run the seeding script periodically to add new popular content:
```bash
# Monthly update recommended
npm run seed:catalog -- --limit=300
```

### Checking Catalog Size

```sql
SELECT
  media_type,
  COUNT(*) as count,
  MIN(release_year) as earliest,
  MAX(release_year) as latest
FROM discovery_catalog
GROUP BY media_type;
```

## Troubleshooting

### "TMDB_API_KEY not configured"
Make sure your TMDB API key is set in environment variables.

### "Failed to fetch movies page X: 401"
Your TMDB API key is invalid. Check: https://www.themoviedb.org/settings/api

### "Rate limit exceeded"
The script already includes rate limiting. If you still hit limits, the script will continue on next run (idempotent).

### Slow seeding
This is expected. Fetching 500 items with full details takes 10-15 minutes due to rate limiting. Consider:
- Using smaller `--limit` for testing
- Seeding incrementally over time

## Next Steps

After seeding the catalog:
1. Build Discovery Challenges feature
2. Add catalog browsing to UI
3. Integrate with recommendation engine
4. Add filtering by decade, genre, country, etc.

# Database Migration Steps

## Genre Normalization Migration

We've created a new normalized genre system with beautiful color coding. To apply these changes:

### 1. Run the Migration

```bash
cd media-tracker

# Make sure DATABASE_URL is set in your .env
export DATABASE_URL=postgresql://user:password@localhost:5432/media_tracker

# Run Drizzle migrations
npm run db:migrate
```

### 2. Seed Genres and Migrate Data

```bash
# Run the genre seed script
npx tsx server/scripts/seed-genres.ts
```

This will:
- Create 27 curated genres with beautiful colors
- Migrate all existing genre data from `media_items.genres` (text field) to the normalized tables
- Show a usage summary with color visualization

### 3. Verify the Migration

```sql
-- Check genres were created
SELECT * FROM genres ORDER BY name;

-- Check media_genres associations
SELECT
  mi.title,
  g.name as genre,
  g.color
FROM media_items mi
JOIN media_genres mg ON mi.id = mg.media_item_id
JOIN genres g ON mg.genre_id = g.id
LIMIT 10;
```

## What Changed

### New Tables

**genres**
- `id` - Primary key
- `name` - Genre name (unique)
- `slug` - URL-friendly slug (unique)
- `color` - Hex color for visual identity
- `created_at` - Timestamp

**media_genres**
- `id` - Primary key
- `media_item_id` - FK to media_items
- `genre_id` - FK to genres
- `created_at` - Timestamp

### Genre Color Palette

Each genre has a distinct, beautiful color:
- **Action**: `#ef4444` (Red)
- **Sci-Fi**: `#6366f1` (Indigo)
- **Drama**: `#8b5cf6` (Purple)
- **Comedy**: `#fbbf24` (Yellow)
- **Horror**: `#7c2d12` (Dark red)
- And 22 more...

These colors will be used throughout the UI for genre pills, visualizations, and the taste map.

## Next Steps

After migration, the old `media_items.genres` text field will remain for backward compatibility but won't be used by new code. We can drop it in a future migration after ensuring everything works correctly.

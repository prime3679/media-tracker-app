CREATE EXTENSION IF NOT EXISTS pg_trgm;--> statement-breakpoint
CREATE INDEX "media_items_title_trigram_idx" ON "media_items" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "media_items_search_vector_idx" ON "media_items" USING gin ((
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("director", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("author", '')), 'B')
  ));

CREATE TABLE "discovery_catalog" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"backdrop_url" text,
	"trailer_url" text,
	"release_date" text,
	"release_year" integer,
	"genres" text,
	"director" text,
	"cast" text,
	"author" text,
	"country" text,
	"language" text,
	"tmdb_id" text,
	"imdb_id" text,
	"isbn" text,
	"tmdb_rating" numeric(3, 1),
	"imdb_rating" numeric(3, 1),
	"popularity_score" integer,
	"runtime" integer,
	"total_seasons" integer,
	"total_episodes" integer,
	"total_pages" integer,
	"is_curated" integer DEFAULT 1,
	"curated_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discovery_catalog_tmdb_id_unique" UNIQUE("tmdb_id")
);
--> statement-breakpoint
CREATE INDEX "discovery_catalog_media_type_idx" ON "discovery_catalog" USING btree ("media_type");--> statement-breakpoint
CREATE INDEX "discovery_catalog_release_year_idx" ON "discovery_catalog" USING btree ("release_year");--> statement-breakpoint
CREATE INDEX "discovery_catalog_tmdb_id_idx" ON "discovery_catalog" USING btree ("tmdb_id");--> statement-breakpoint
CREATE INDEX "discovery_catalog_popularity_idx" ON "discovery_catalog" USING btree ("popularity_score");--> statement-breakpoint
CREATE INDEX "discovery_catalog_title_trigram_idx" ON "discovery_catalog" USING gin ("title" gin_trgm_ops);--> statement-breakpoint
CREATE INDEX "discovery_catalog_search_vector_idx" ON "discovery_catalog" USING gin ((
    setweight(to_tsvector('english', coalesce("title", '')), 'A') ||
    setweight(to_tsvector('english', coalesce("director", '')), 'B') ||
    setweight(to_tsvector('english', coalesce("author", '')), 'B')
  ));
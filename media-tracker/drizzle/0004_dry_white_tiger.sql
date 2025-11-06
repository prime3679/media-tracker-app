CREATE TABLE "genres" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"color" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "genres_name_unique" UNIQUE("name"),
	CONSTRAINT "genres_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "media_genres" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_item_id" integer NOT NULL,
	"genre_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "genres_slug_idx" ON "genres" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "media_genres_media_item_id_idx" ON "media_genres" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "media_genres_genre_id_idx" ON "media_genres" USING btree ("genre_id");--> statement-breakpoint
CREATE INDEX "media_genres_media_item_genre_unique" ON "media_genres" USING btree ("media_item_id","genre_id");
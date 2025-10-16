CREATE TABLE "episodes" (
	"id" serial PRIMARY KEY NOT NULL,
	"season_id" integer NOT NULL,
	"episode_number" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"air_date" text,
	"runtime" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"media_item_id" integer NOT NULL,
	"season_number" integer NOT NULL,
	"title" text,
	"episode_count" integer,
	"air_date" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "weekly_stats_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"week_start" timestamp NOT NULL,
	"total_items" integer NOT NULL,
	"completed" integer NOT NULL,
	"watching" integer NOT NULL,
	"to_watch" integer NOT NULL,
	"completions_this_week" integer NOT NULL,
	"completion_velocity" numeric(5, 2),
	"streak_days" integer NOT NULL,
	"genre_gravity" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_tracking" ADD COLUMN "episode_id" integer;--> statement-breakpoint
CREATE INDEX "episodes_season_id_idx" ON "episodes" USING btree ("season_id");--> statement-breakpoint
CREATE INDEX "seasons_media_item_id_idx" ON "seasons" USING btree ("media_item_id");--> statement-breakpoint
CREATE INDEX "weekly_stats_snapshots_user_id_week_start_idx" ON "weekly_stats_snapshots" USING btree ("user_id","week_start");
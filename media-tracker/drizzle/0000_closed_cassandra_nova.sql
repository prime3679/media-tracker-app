CREATE TYPE "public"."media_type" AS ENUM('movie', 'tv_show', 'book');--> statement-breakpoint
CREATE TYPE "public"."status" AS ENUM('to_watch', 'watching', 'completed', 'dropped', 'on_hold');--> statement-breakpoint
CREATE TABLE "media_items" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_type" "media_type" NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"release_date" text,
	"genres" text,
	"director" text,
	"author" text,
	"isbn" text,
	"tmdb_id" text,
	"imdb_id" text,
	"total_seasons" integer,
	"total_episodes" integer,
	"total_pages" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_tracking" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"status" "status" DEFAULT 'to_watch' NOT NULL,
	"rating" numeric(3, 1),
	"progress" integer DEFAULT 0,
	"notes" text,
	"start_date" timestamp,
	"completed_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"revoked_at" timestamp,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE INDEX "media_items_user_id_updated_at_idx" ON "media_items" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "media_tracking_user_id_status_idx" ON "media_tracking" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "media_tracking_user_id_updated_at_idx" ON "media_tracking" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "refresh_tokens_user_id_idx" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_token_idx" ON "refresh_tokens" USING btree ("token");
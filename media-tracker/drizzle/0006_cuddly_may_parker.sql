CREATE TABLE "skip_reasons" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"media_item_id" integer NOT NULL,
	"reason" text NOT NULL,
	"feedback" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "media_items" ADD COLUMN "trailer_url" text;--> statement-breakpoint
CREATE INDEX "skip_reasons_user_id_idx" ON "skip_reasons" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "skip_reasons_media_item_id_idx" ON "skip_reasons" USING btree ("media_item_id");
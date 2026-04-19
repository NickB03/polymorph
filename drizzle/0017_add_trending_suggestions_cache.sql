CREATE TABLE "trending_suggestions_cache" (
	"id" integer PRIMARY KEY DEFAULT 1 NOT NULL,
	"suggestions" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "trending_suggestions_cache_singleton" CHECK ("trending_suggestions_cache"."id" = 1)
);
--> statement-breakpoint
ALTER TABLE "trending_suggestions_cache" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "public_read_trending_suggestions_cache" ON "trending_suggestions_cache" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint

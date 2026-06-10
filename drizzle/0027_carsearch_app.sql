CREATE TABLE "carsearch_listings" (
	"vin" varchar(32) PRIMARY KEY NOT NULL,
	"brand" varchar(256) NOT NULL,
	"model" varchar(256) NOT NULL,
	"model_label" text NOT NULL,
	"year" integer NOT NULL,
	"trim" text NOT NULL,
	"trim_type" varchar(256) NOT NULL,
	"awd" boolean NOT NULL,
	"price" integer NOT NULL,
	"miles" integer NOT NULL,
	"epa_range_miles" integer NOT NULL,
	"location" text NOT NULL,
	"distance_miles" integer NOT NULL,
	"location_type" varchar(256) NOT NULL,
	"deal" varchar(256),
	"cpo" boolean DEFAULT false NOT NULL,
	"assist" varchar(256) NOT NULL,
	"lemon" boolean DEFAULT false NOT NULL,
	"top_pick" boolean DEFAULT false NOT NULL,
	"top_pick_reason" text,
	"features" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"image_url" text,
	"source_url" text NOT NULL,
	"source_site" varchar(256) NOT NULL,
	"listed_since" timestamp with time zone,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carsearch_price_history" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"vin" varchar(32) NOT NULL,
	"observed_at" timestamp with time zone DEFAULT now() NOT NULL,
	"price" integer NOT NULL,
	"source_site" varchar(256) NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carsearch_saved_listings" (
	"vin" varchar(32) PRIMARY KEY NOT NULL,
	"saved_by_user_id" varchar(255) NOT NULL,
	"status" varchar(256) DEFAULT 'saved' NOT NULL,
	"note" text,
	"saved_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "carsearch_refresh_runs" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	"status" varchar(256) NOT NULL,
	"source_site" varchar(256) NOT NULL,
	"seen_count" integer DEFAULT 0 NOT NULL,
	"inserted_count" integer DEFAULT 0 NOT NULL,
	"updated_count" integer DEFAULT 0 NOT NULL,
	"deactivated_count" integer DEFAULT 0 NOT NULL,
	"error" text
);
--> statement-breakpoint
ALTER TABLE "carsearch_price_history" ADD CONSTRAINT "carsearch_price_history_vin_carsearch_listings_vin_fk" FOREIGN KEY ("vin") REFERENCES "public"."carsearch_listings"("vin") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "carsearch_saved_listings" ADD CONSTRAINT "carsearch_saved_listings_vin_carsearch_listings_vin_fk" FOREIGN KEY ("vin") REFERENCES "public"."carsearch_listings"("vin") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "carsearch_listings_active_brand_idx" ON "carsearch_listings" USING btree ("is_active","brand");--> statement-breakpoint
CREATE INDEX "carsearch_listings_source_site_idx" ON "carsearch_listings" USING btree ("source_site");--> statement-breakpoint
CREATE INDEX "carsearch_price_history_vin_observed_idx" ON "carsearch_price_history" USING btree ("vin","observed_at" DESC);--> statement-breakpoint
CREATE INDEX "carsearch_saved_status_idx" ON "carsearch_saved_listings" USING btree ("status");--> statement-breakpoint
CREATE INDEX "carsearch_refresh_runs_started_idx" ON "carsearch_refresh_runs" USING btree ("started_at" DESC);--> statement-breakpoint
ALTER TABLE "carsearch_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carsearch_price_history" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carsearch_saved_listings" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "carsearch_refresh_runs" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE POLICY "public_read_active_carsearch_listings" ON "carsearch_listings" AS PERMISSIVE FOR SELECT TO public USING (is_active = true);--> statement-breakpoint
CREATE POLICY "public_read_carsearch_price_history" ON "carsearch_price_history" AS PERMISSIVE FOR SELECT TO public USING (true);--> statement-breakpoint
CREATE POLICY "public_read_carsearch_refresh_runs" ON "carsearch_refresh_runs" AS PERMISSIVE FOR SELECT TO public USING (true);

ALTER TABLE "eval_summaries" ADD COLUMN "threshold_bps" integer;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "threshold_breached" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "failed_evaluators" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD CONSTRAINT "eval_summaries_threshold_bps_range" CHECK ("eval_summaries"."threshold_bps" IS NULL OR ("eval_summaries"."threshold_bps" >= 0 AND "eval_summaries"."threshold_bps" <= 10000));

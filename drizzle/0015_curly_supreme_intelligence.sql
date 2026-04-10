CREATE TABLE "eval_summaries" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"suite" varchar(256) NOT NULL,
	"experiment_name" text NOT NULL,
	"dataset_name" text NOT NULL,
	"pass_rate_bps" integer NOT NULL,
	"evaluator_scores" jsonb NOT NULL,
	"total_cases" integer NOT NULL,
	"phoenix_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eval_summaries_pass_rate_bps_range" CHECK ("eval_summaries"."pass_rate_bps" >= 0 AND "eval_summaries"."pass_rate_bps" <= 10000)
);
--> statement-breakpoint
ALTER TABLE "eval_summaries" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
CREATE INDEX "eval_summaries_suite_created_at_idx" ON "eval_summaries" USING btree ("suite","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE UNIQUE INDEX "eval_summaries_experiment_name_idx" ON "eval_summaries" USING btree ("experiment_name");--> statement-breakpoint
CREATE POLICY "authenticated_read_eval_summaries" ON "eval_summaries" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.current_user_id', true) IS NOT NULL);
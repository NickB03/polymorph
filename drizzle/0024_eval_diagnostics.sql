CREATE TABLE "eval_case_results" (
	"id" varchar(191) PRIMARY KEY NOT NULL,
	"eval_summary_id" varchar(191) NOT NULL,
	"suite" varchar(256) NOT NULL,
	"experiment_name" text NOT NULL,
	"experiment_run_id" text NOT NULL,
	"dataset_example_id" text,
	"case_id" text NOT NULL,
	"evaluator_name" text NOT NULL,
	"annotator_kind" text,
	"score_bps" integer,
	"label" text,
	"explanation" text,
	"error" text,
	"failed" boolean DEFAULT false NOT NULL,
	"failure_mode" text DEFAULT 'other' NOT NULL,
	"app_model_id" text,
	"model_type" text,
	"search_mode" text,
	"correlation_id" text,
	"otel_trace_id" text,
	"evaluator_trace_id" text,
	"phoenix_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "eval_case_results_score_bps_range" CHECK ("eval_case_results"."score_bps" IS NULL OR ("eval_case_results"."score_bps" >= 0 AND "eval_case_results"."score_bps" <= 10000)),
	CONSTRAINT "eval_case_results_suite_enum" CHECK ("eval_case_results"."suite" IN ('capability', 'regression', 'traffic-monitor'))
);
--> statement-breakpoint
ALTER TABLE "eval_case_results" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "app_model_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "primary_app_model_id" text;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "judge_provider" text DEFAULT 'openrouter' NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "judge_model" text;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "judge_base_url" text;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "judge_settings" jsonb DEFAULT '{}'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "corpus_version" text;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "dataset_version" text;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "evaluator_template_version" text DEFAULT 'v1' NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "app_git_sha" text;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "sample_size" integer;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "lookback_hours" integer;--> statement-breakpoint
ALTER TABLE "eval_case_results" ADD CONSTRAINT "eval_case_results_eval_summary_id_eval_summaries_id_fk" FOREIGN KEY ("eval_summary_id") REFERENCES "public"."eval_summaries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "eval_case_results_summary_idx" ON "eval_case_results" USING btree ("eval_summary_id");--> statement-breakpoint
CREATE INDEX "eval_case_results_suite_created_at_idx" ON "eval_case_results" USING btree ("suite","created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "eval_case_results_failure_idx" ON "eval_case_results" USING btree ("eval_summary_id","evaluator_name","failed");--> statement-breakpoint
CREATE UNIQUE INDEX "eval_case_results_summary_case_evaluator_idx" ON "eval_case_results" USING btree ("eval_summary_id","case_id","evaluator_name");--> statement-breakpoint
CREATE POLICY "authenticated_read_eval_case_results" ON "eval_case_results" AS PERMISSIVE FOR SELECT TO public USING (current_setting('app.current_user_id', true) IS NOT NULL);
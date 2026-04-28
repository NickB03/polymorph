ALTER TABLE "eval_summaries" ADD COLUMN "attempted_cases" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "failed_cases" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD CONSTRAINT "eval_summaries_failed_cases_lte_attempted" CHECK ("eval_summaries"."failed_cases" <= "eval_summaries"."attempted_cases");
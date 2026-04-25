ALTER TABLE "eval_summaries" ADD CONSTRAINT "eval_summaries_suite_enum" CHECK ("eval_summaries"."suite" IN ('capability', 'regression', 'traffic-monitor'));

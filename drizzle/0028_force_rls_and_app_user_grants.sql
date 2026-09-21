-- FORCE ROW LEVEL SECURITY on the user-scoped tables, so the policies also
-- apply to the table owner. Without FORCE the owner is exempt from its own
-- tables' policies.
--
-- This does NOT constrain a SUPERUSER or BYPASSRLS role (the Supabase
-- `postgres` role has BYPASSRLS): RLS is only enforced for the app when it
-- connects as the restricted `app_user` role via DATABASE_RESTRICTED_URL
-- (see scripts/provision-app-user.sql).
--
-- Deliberately NOT forced: eval_summaries, eval_case_results and
-- trending_suggestions_cache. They have no write policy and are written by
-- owner-role jobs (evals cron, suggestions cron via lib/db/admin.ts), which
-- FORCE would break on an owner without BYPASSRLS.
--
-- Note for future data migrations: on an owner without BYPASSRLS, an
-- UPDATE/DELETE on a forced table with no app.current_user_id matches no rows.
ALTER TABLE "chats" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "messages" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "feedback" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifact_revisions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "artifact_runtime_sessions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canvas_artifacts" FORCE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "canvas_artifact_versions" FORCE ROW LEVEL SECURITY;--> statement-breakpoint

-- Grant the restricted app_user role access to every current table and
-- sequence. No-op if the role does not exist yet (scripts/provision-app-user.sql
-- applies the same grants when it creates the role), so the role ends up with
-- grants whether it is provisioned before or after migrations run.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT USAGE ON SCHEMA public TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
    GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user';
  END IF;
END;
$$;

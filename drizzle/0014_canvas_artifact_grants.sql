-- Grant table-level permissions for canvas artifacts to the restricted app_user role.
-- This is a no-op if the role does not exist (safe to run in all environments).
-- Required because GRANT ALL ON ALL TABLES only covers tables that exist at grant time;
-- tables added by later migrations (like canvas_artifacts) are not automatically covered.
DO $$
BEGIN
  IF EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON "canvas_artifacts" TO app_user;
    GRANT SELECT, INSERT, UPDATE, DELETE ON "canvas_artifact_versions" TO app_user;
    -- Prevent recurrence: automatically grant on all future tables created in this schema
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user';
    EXECUTE 'ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_user';
  END IF;
END;
$$;

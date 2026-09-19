-- Provision the restricted application role that makes Row-Level Security
-- effective. Run ONCE as the database owner (the role that runs migrations):
--
--   psql "<owner connection string>" -v ON_ERROR_STOP=1 \
--     -v app_user_password='<generated secret>' \
--     -f scripts/provision-app-user.sql
--
-- Idempotent: re-running resets the password and re-applies the grants.
-- The app then connects as this role via DATABASE_RESTRICTED_URL. The owner
-- role (DATABASE_URL / POSTGRES_URL) stays in use for migrations and the
-- privileged cron client (lib/db/admin.ts).
--
-- The password is never written here; it must be passed with -v. Without it
-- the statement below fails (keep ON_ERROR_STOP=1 so nothing else runs).
\if :{?app_user_password}
\else
  \echo 'ERROR: pass the password with: psql -v app_user_password=...'
\endif

-- psql does not interpolate variables inside dollar-quoted blocks, so build
-- the statement with format() and run it with \gexec.
SELECT format(
  '%s ROLE app_user WITH LOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD %L',
  CASE
    WHEN EXISTS (SELECT FROM pg_roles WHERE rolname = 'app_user') THEN 'ALTER'
    ELSE 'CREATE'
  END,
  :'app_user_password'
) \gexec

GRANT USAGE ON SCHEMA public TO app_user;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_user;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_user;

-- Tables and sequences created later by this owner (future migrations).
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO app_user;

-- Sanity check: both flags must be false or RLS is not enforced for this role.
SELECT rolname, rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'app_user';

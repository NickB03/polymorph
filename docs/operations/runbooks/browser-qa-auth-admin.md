# Browser QA for Authenticated Admin Surfaces

> **Audience:** Developer | Operator
> **Prerequisites:** [Quickstart](../../getting-started/QUICKSTART.md), [Environment Reference](../../getting-started/ENVIRONMENT.md)

Use this runbook when a change needs real browser verification on an authenticated
admin route such as `/admin/evals`. The default target is local Supabase plus
`bun dev`; preview and production browser checks are allowed only when app admin
credentials and safe data access are available.

## Ground Rules

- Do not point local dev at the production owner `DATABASE_URL`.
- Use local Supabase for pre-merge browser QA.
- For production dashboard validation, browse the production deployment. Do not
  connect local dev to production with the owner database URL.
- Leave `ENABLE_AUTH=true`. Admin access is disabled when auth is disabled.
- Do not paste secrets, cookies, database URLs, or passwords in PRs, logs, or
  screenshots.
- Stop and report the exact blocker if admin credentials, Vercel share access,
  local Supabase keys, or restricted production data access are unavailable.

## Local Admin QA

1. Start local Supabase:

   ```bash
   npx supabase start
   ```

2. Set local-only app environment:

   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
   DATABASE_SSL_DISABLED=true
   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321
   NEXT_PUBLIC_SUPABASE_ANON_KEY=<local anon key from npx supabase status>
   NEXT_PUBLIC_APP_URL=http://localhost:43100
   ENABLE_AUTH=true
   ```

   Keep `DATABASE_RESTRICTED_URL` unset unless you are intentionally testing the
   restricted runtime path; the shared app DB client prefers it over
   `DATABASE_URL`.

3. Migrate and seed synthetic eval dashboard rows:

   ```bash
   bun run migrate
   bun run seed:evals:dry-run
   bun run seed:evals
   ```

   `bun run seed:evals` resets only `local-seed-*` rows and refuses non-local DB
   hosts. The seed data is deterministic, uses current evaluator keys including
   `tool_selection`, and does not call Phoenix, OpenRouter, or the eval runner.

4. Create or reuse a local Supabase user:
   - Start the app with `bun dev`.
   - Sign up at `http://localhost:43100/auth/sign-up`, or create the user in
     Supabase Studio at `http://127.0.0.1:44323`.
   - Find the user's UUID in Studio under **Authentication -> Users**, or run:

     ```sql
     select id, email
     from auth.users
     where email = 'browser-qa-admin@example.test';
     ```

   - Set `ADMIN_USER_ID=<that UUID>` in local env and restart `bun dev`.

5. Verify auth boundaries before visual QA:
   - Logged-out `/admin/evals` redirects to `/auth/login`.
   - Logged-in non-admin users get a 404.
   - Logged-in admin users reach `/admin/evals`.

6. Verify the dashboard in a browser:
   - `http://localhost:43100/admin/evals`
   - `http://localhost:43100/admin/evals?view=suites`
   - `http://localhost:43100/admin/evals?view=history`
   - `http://localhost:43100/admin/evals?suite=capability`
   - `http://localhost:43100/admin/evals?suite=regression`
   - `http://localhost:43100/admin/evals?suite=trafficMonitor`

   Check desktop and mobile widths. Confirm the page does not remain on
   `/auth/login`, no unexpected console errors appear, network requests complete,
   seeded suites render, deep links survive refresh, the evaluator breakdown shows
   `Tool Selection`, and the radar chart is visible when at least three numeric
   evaluator scores exist.

## Preview QA

Preview deployments are visual-QA targets only. Vercel Authentication and app
authentication are separate:

- If the preview is Vercel-protected, use a Vercel share URL to reach the app.
- The share URL does not sign into Polymorph. You still need a Supabase user
  whose UUID matches that environment's `ADMIN_USER_ID`.
- Preview deployments intentionally do not have `EVAL_RUNNER_SECRET`; do not run
  `services/evals` against preview URLs.

If preview admin credentials are unavailable, report browser QA as blocked at app
login and include the preview URL that was tested.

## Production QA

Production browser QA should use the production deployment and an authorized admin
session. For database inspection, use restricted or read-only credentials. Never
seed production data and never run local dev against the production owner
`DATABASE_URL`.

Production eval refresh is a separate post-merge operation through the Railway
`polymorph-evals` cron service. Use the deployment runbook for Railway
redeploys, Phoenix checks, and `EVAL_RUN_MODE` changes.

## Evidence To Report

Include this block in PR or merge-readiness notes:

```text
Browser QA:
- target:
- auth user:
- data source:
- routes checked:
- viewport(s):
- console/network:
- screenshot(s):
- blocked by:
```

# Deployment Guide

> **Audience:** Operator
> **Prerequisites:** [Quickstart Guide](../getting-started/QUICKSTART.md)

This guide describes the Polymorph production deployment baseline.

## Recommended targets

- **Primary**: Vercel (fastest path for App Router + edge-friendly DX)
- **Alternative**: Docker/Kubernetes using the provided container setup

## Production minimum requirements

Set these before first public deployment:

```bash
ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=[YOUR_SUPABASE_PROJECT_URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
SUPABASE_STORAGE_BUCKET=[YOUR_BUCKET_NAME]
DATABASE_URL=[PRODUCTION_POSTGRES_URL]
AI_GATEWAY_API_KEY=[YOUR_VERCEL_GATEWAY_KEY]
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_KEY]
NEXT_PUBLIC_APP_URL=[YOUR_PUBLIC_APP_URL]
CRON_SECRET=[RANDOM_LONG_STRING]
ADMIN_USER_ID=[SUPABASE_USER_ID_FOR_ADMIN_ACCESS]
```

`BRAVE_SEARCH_API_KEY` is the default search provider (`SEARCH_API=brave`). Set `TAVILY_API_KEY`, `EXA_API_KEY`, or another provider key instead if you prefer. `CRON_SECRET` is required for the Vercel cron in the next section. `ADMIN_USER_ID` is optional — required only if you want `/admin/*` routes to resolve for a specific user.

For the current Vercel production alias, set:

```bash
NEXT_PUBLIC_APP_URL=https://polymorph-nb.vercel.app
```

If cloud controls are enabled:

```bash
POLYMORPH_CLOUD_DEPLOYMENT=true
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are only needed if you want chat limits enforced in cloud mode. If they are absent, the app still boots and the limit checks fall back to allow-all behavior.

For geo maps, routing, and static map images, also set:

```bash
NEXT_PUBLIC_MAPTILER_API_KEY=[YOUR_CLIENT_MAPTILER_KEY]
MAPTILER_API_KEY=[YOUR_SERVER_MAPTILER_KEY]
ORS_API_KEY=[YOUR_OPENROUTESERVICE_KEY]
```

- `NEXT_PUBLIC_MAPTILER_API_KEY` serves client-side tiles for `displayGeoMap` and the public static map URLs returned by `getStaticMapImage`.
- `MAPTILER_API_KEY` serves `geocodeAddress`, `getDirections`, and other server-only MapTiler calls.
- `ORS_API_KEY` enables `getIsochrone`; without it the tool returns a structured error instead of a polygon.

## Vercel cron — trending suggestions refresh

`vercel.json` at the repo root declares a single daily cron job:

```json
{
  "crons": [{ "path": "/api/suggestions/refresh", "schedule": "0 14 * * *" }]
}
```

- **Schedule:** 14:00 UTC daily.
- **Target:** `GET /api/suggestions/refresh` (`app/api/suggestions/refresh/route.ts`, `maxDuration = 60` seconds).
- **Auth:** `Authorization: Bearer <CRON_SECRET>`. Vercel sends `CRON_SECRET` automatically when the env var is set in the project — you only need to set it in the dashboard.
- **Side effect:** regenerates trending suggestions via `generateTrendingSuggestions()` (multi-provider cascade: Brave → Tavily → Exa) and upserts the singleton row in `trending_suggestions_cache` via the privileged DB client (`lib/db/admin.ts`).
- **Failure modes:** returns `500` with `error: 'not-configured'` if `CRON_SECRET` is absent; `401` on bad auth; `500` on generation failure. Inspect Vercel function logs for the specific error message.
- **Read path:** `GET /api/suggestions` reads the same table and blends cached suggestions with static rotation. A stale cache (over 25 hours old) is treated as absent and falls back to static suggestions — so a missed cron run is degraded, not broken.

## Healthcheck expectations

- App should respond on `/` and complete one end-to-end chat request
- Database migrations must be applied (`bun run migrate`) before accepting traffic
- **Docker/Railway deployments:** Consider moving `bun run migrate` from the Docker entrypoint to a Railway Pre-Deploy Command to avoid race conditions with multi-replica deployments. The entrypoint runs migrations on every container start; pre-deploy runs once between build and deploy.
- At least one configured model/provider must be enabled at runtime
- Monitor `https://polymorph-nb.vercel.app/api/health` rather than raw deployment URLs. Deployment URLs may still be protected by Vercel Authentication.

## Rollback strategy

1. Keep immutable build artifacts/images per release tag
2. If deployment fails, roll back to prior known-good release
3. Re-run smoke test (homepage + one query + citations) on rolled-back version

## Observability (Phoenix on Railway)

Polymorph exports OpenTelemetry traces to a self-hosted Arize Phoenix instance on Railway.

### Architecture

```
Vercel (polymorph) --OTLP/HTTPS--> Railway (phoenix)
                                       ^
Railway (polymorph-evals cron) --API--/
      \--SQL read--> Supabase Postgres
```

### Phoenix service

- **Railway project:** `polymorph`
- **Service:** `phoenix` (region: `us-east4`)
- **Image:** `arizephoenix/phoenix`
- **Storage:** SQLite on Railway volume `phoenix-volume-v8K9` (us-east4, 5 GB, mounted at `/data`, `PHOENIX_WORKING_DIR=/data/v4`). All state — projects, datasets, experiments, users, API keys — lives in `/data/v4/phoenix.db` on this volume.
- **Public domain:** `phoenix-production-c6b5.up.railway.app`
- **Private domain:** `phoenix.railway.internal` (for Railway-internal services)
- **Auth:** Enabled (`PHOENIX_ENABLE_AUTH=true`, `PHOENIX_SECRET` for JWT signing). The durable login is `admin@localhost` (password from `PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD`, applied only on an empty DB). Accounts listed in `PHOENIX_ADMINS` are created as rows but have no usable password without SMTP — plan user access around `admin@localhost`.

> **HTTPS required in production.** The `instrumentation.ts` enforces HTTPS for the collector endpoint when `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `RAILWAY_ENVIRONMENT=production`, or `NODE_ENV=production` (without `VERCEL_ENV`). If the endpoint uses plain HTTP, tracing is silently disabled and a console error is logged.

### Persistence verification (run after every Phoenix deploy)

Phoenix is a single stateful SQLite file. An unmounted or region-mismatched volume looks healthy at boot but wipes on every redeploy, so run this check after any change touching the `phoenix` service.

1. **Confirm the volume is real, attached, and region-matched.** Do **not** trust `deployment.meta.volumeMounts` — that field reflects the `arizephoenix/phoenix` image's Dockerfile `VOLUME /data` declaration, not a Railway-attached volume. Instead:

   ```bash
   railway volume list --json | jq '.volumes[] | select(.name|startswith("phoenix"))'
   ```

   The entry must report `serviceId` equal to the `phoenix` service id **and** a region matching the phoenix deployment region (currently `us-east4`). Railway volumes are region-pinned and cannot cross regions; a region-mismatched attachment causes the next deploy to fail in ~7 seconds with `instances: []`.

2. **Run the redeploy acid test.** Query `/v1/projects` (or `/v1/datasets`) with `PHOENIX_ADMIN_SECRET`, then `railway redeploy --service phoenix --yes`, then re-query. Relay IDs must be identical across the fresh container. If project counts or IDs reset, storage is ephemeral and the "restore" only appeared to work.

   ```bash
   curl -sS -o /dev/null -w "HTTP %{http_code}\n" https://phoenix-production-c6b5.up.railway.app/
   ```

3. **Rotate client API keys last.** Phoenix API keys are rows in the same DB. If you rotate `PHOENIX_API_KEY` on Vercel and `polymorph-evals` before confirming persistence, a subsequent wipe will drop the token rows and surface as bulk `401` on `/v1/traces` and `/v1/datasets`.

### Enabling tracing on Vercel

Set these env vars in the Vercel dashboard (Settings → Environment Variables, Production):

| Variable                     | Value                                            |
| ---------------------------- | ------------------------------------------------ |
| `ENABLE_TRACING`             | `true`                                           |
| `PHOENIX_COLLECTOR_ENDPOINT` | `https://phoenix-production-c6b5.up.railway.app` |
| `PHOENIX_PROJECT_NAME`       | `polymorph-prod`                                 |
| `PHOENIX_API_KEY`            | System API key created in Phoenix UI             |

See [Environment Reference](../getting-started/ENVIRONMENT.md#tracing-arize-phoenix) for details.

### Evals cron service

The `services/evals/` directory contains a scheduled evaluation pipeline:

- Samples recent chats from Supabase Postgres using parameterized SQL (no string interpolation)
- Runs 5 LLM-judge evaluators (faithfulness, relevance, response quality, safety, citation accuracy) built with a shared factory pattern and `extractVerdict()` with word-boundary matching
- Pushes results to Phoenix as experiments **and** persists eval summaries to the `eval_summaries` Postgres table, which powers the admin `/admin/evals` dashboard (capability, regression, and Traffic Monitor sections). After the next cron firing, operators should see fresh rows on the dashboard; if they don't, suspect the sampler's DB role missing the RLS context for write paths (see `lib/db/schema.ts:558-560` and the live Railway `DATABASE_URL` role).
- **Robustness:** `closeDb()` guaranteed on all exit paths (happy + fatal), NaN-safe `validInt()` config parsing, `maxAttempts >= 1` retry validation, safe `JSON.parse` for citations
- **Failure-mode split in logs:** two distinct error labels, each pointing at a different system.
  - `[evals] PHOENIX UNAVAILABLE - could not record <suite> experiment results` — Phoenix HTTP layer is down, dataset/experiment creation failed. The suite never reached the DB write step. Investigate Phoenix service health (`railway logs -s phoenix`, `/` 200 check).
  - `[evals] DB WRITE FAILED - could not persist <suite> eval summary` — Phoenix experiment was created successfully, but the Postgres write to `eval_summaries` failed. The Phoenix experiment is intact; only the dashboard row is missing. Investigate Postgres connectivity, the RLS role on `DATABASE_URL`, and the `eval_summaries` table.
  - Threshold breaches are warning-only by default so a personal-project cron keeps publishing Phoenix and dashboard evidence. Set `EVAL_EXIT_ON_THRESHOLD_BREACH=true` when you want threshold breaches from capability, regression, traffic-monitor, or any other persisted eval suite to fail the cron. If a DB write fails, the runner still surfaces the DB failure after the mode finishes so the missing dashboard row is visible.

> **The `evaluators` project in the Phoenix UI is Phoenix-managed, not ours.** When an experiment runs, Phoenix auto-routes the judge model's LLM spans into a reserved project called `evaluators`. You can't rename, delete, or reconfigure it — it exists anywhere experiments run. This is why you'll see traces there even though `services/evals/` never sets `PHOENIX_PROJECT_NAME`.
>
> **Ad-hoc evals run locally against `bun dev`, not against preview deployments.** The Railway cron above targets production (`EVAL_RUNNER_URL=https://polymorph-nb.vercel.app`). For one-off runs on a branch, run `services/evals/` locally with `EVAL_RUNNER_URL=http://localhost:43100` and a matching `EVAL_RUNNER_SECRET` set in both your local `.env.local` and the shell invoking the evals service. The `capability`, `regression`, and `traffic-monitor` modes call `/api/evals/run` (secret-gated); the `smoke` mode instead calls `/api/chat` directly using a Supabase seed user, so it needs `APP_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` — see `services/evals/src/config.ts` for the exact required set per mode. Vercel Preview deployments intentionally do **not** have `EVAL_RUNNER_SECRET` configured, so `/api/evals/run` on a preview URL returns HTTP 403 — preview remains a visual-QA surface, not an eval target.

**Railway deployment:**

- Deploy as a Railway cron service from `services/evals/Dockerfile`
- Schedule: set the Railway cron to an every-48-hours cadence for the personal-project baseline. This schedule is managed in Railway, not in git.
- Uses private networking to Phoenix for writes (`PHOENIX_HOST=http://phoenix.railway.internal:6006`) and `PHOENIX_PUBLIC_URL` for dashboard links.

> **Triggering a cron run manually.** `railway redeploy -s polymorph-evals` from the CLI rebuilds the image and re-registers the schedule — it does **not** execute the container CMD. For an immediate one-off run use the Railway dashboard (`Deployments → ⋯ → Redeploy`), which does run the CMD. Otherwise wait for the next scheduled tick.

**Cost-sensitive baseline defaults:**

- Judge model: `google/gemini-3.1-flash-lite-preview`
- Traffic monitor lookback: `48` hours
- Traffic monitor sample cap: `10` chats
- Eval concurrency: `1`

These defaults are tuned for low-volume personal-project traffic. If you widen the lookback beyond the cron cadence, the sampler can rescore the same chats on multiple runs because it samples from the current window and does not track previously evaluated chat IDs.

**Required env vars:**

| Variable                     | Value                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`               | Supabase Postgres connection string                                |
| `EVAL_RUN_MODE`              | `traffic-monitor` for the scheduled production cron                |
| `EVAL_RUNNER_URL`            | Production app URL for `/api/evals/run`                            |
| `EVAL_RUNNER_SECRET`         | Shared secret that matches the app's `EVAL_RUNNER_SECRET`          |
| `PHOENIX_HOST`               | `http://phoenix.railway.internal:6006`                             |
| `PHOENIX_PUBLIC_URL`         | Public Phoenix URL used in persisted dashboard links               |
| `PHOENIX_API_KEY`            | Phoenix System API key                                             |
| `JUDGE_API_KEY`              | OpenRouter API key for the judge model (preferred)                 |
| `OPENROUTER_API_KEY`         | Fallback; read by the OpenRouter SDK when `JUDGE_API_KEY` is unset |
| `JUDGE_BASE_URL`             | `https://openrouter.ai/api/v1`                                     |
| `JUDGE_MODEL`                | `google/gemini-3.1-flash-lite-preview` (default)                   |
| `JUDGE_REASONING_ENABLED`    | `true` (default)                                                   |
| `JUDGE_REASONING_MAX_TOKENS` | `1024` (default, positive integer)                                 |
| `SAMPLE_SIZE`                | `10` (default)                                                     |
| `LOOKBACK_HOURS`             | `48` (default)                                                     |
| `EVAL_CASE_CONCURRENCY`      | `1` (default)                                                      |

### Rotating Phoenix API keys

1. **First**, run the persistence verification above. Rotating before you have confirmed the volume is real will leave you with tokens that vanish on the next redeploy.
2. Log into Phoenix UI (`admin@localhost`) → Settings → API Keys
3. Create a new System API key
4. Update `PHOENIX_API_KEY` on both Vercel and the `polymorph-evals` Railway service
5. Delete the old key in Phoenix

## Staging checklist

- [ ] Auth enabled and verified
- [ ] Required secrets present
- [ ] Migration status confirmed
- [ ] Chat/search flow validated
- [ ] Basic logs/telemetry visible
- [ ] Phoenix traces appearing (if `ENABLE_TRACING=true`)

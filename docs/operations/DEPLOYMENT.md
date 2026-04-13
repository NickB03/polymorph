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
TAVILY_API_KEY=[YOUR_TAVILY_API_KEY]
NEXT_PUBLIC_APP_URL=[YOUR_PUBLIC_APP_URL]
```

For the current Vercel production alias, set:

```bash
NEXT_PUBLIC_APP_URL=https://polymorph-nb.vercel.app
```

If cloud controls are enabled:

```bash
POLYMORPH_CLOUD_DEPLOYMENT=true
NEXT_PUBLIC_POLYMORPH_CLOUD_DEPLOYMENT=true
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

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
- Pushes results to Phoenix as experiments
- **Robustness:** `closeDb()` guaranteed on all exit paths (happy + fatal), NaN-safe `validInt()` config parsing, `maxAttempts >= 1` retry validation, safe `JSON.parse` for citations

> **The `evaluators` project in the Phoenix UI is Phoenix-managed, not ours.** When an experiment runs, Phoenix auto-routes the judge model's LLM spans into a reserved project called `evaluators`. You can't rename, delete, or reconfigure it — it exists anywhere experiments run. This is why you'll see traces there even though `services/evals/` never sets `PHOENIX_PROJECT_NAME`.

> **Ad-hoc evals run locally against `bun dev`, not against preview deployments.** The Railway cron above targets production (`EVAL_RUNNER_URL=https://polymorph-nb.vercel.app`). For one-off runs on a branch, point the evals service at your local app and a fresh `EVAL_RUN_MODE=smoke`: `cd services/evals && EVAL_RUNNER_URL=http://localhost:43100 EVAL_RUN_MODE=smoke bun src/index.ts` (plus the usual `DATABASE_URL` / `PHOENIX_*` / `JUDGE_API_KEY` env). Vercel Preview deployments do **not** have `EVAL_RUNNER_SECRET` set and will reject `/api/evals/run` with 401 — this is intentional, so that preview remains a visual-QA surface, not an eval target.

**Railway deployment:**

- Deploy as a Railway cron service from `services/evals/Dockerfile`
- Schedule: `0 */6 * * *` (every 6 hours UTC)
- Uses private networking to Phoenix (`PHOENIX_HOST=http://phoenix.railway.internal:6006`)

> **Triggering a cron run manually.** `railway redeploy -s polymorph-evals` from the CLI rebuilds the image and re-registers the schedule — it does **not** execute the container CMD. For an immediate one-off run use the Railway dashboard (`Deployments → ⋯ → Redeploy`), which does run the CMD. Otherwise wait for the next natural tick.

**Required env vars:**

| Variable                     | Value                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`               | Supabase Postgres connection string                                |
| `PHOENIX_HOST`               | `http://phoenix.railway.internal:6006`                             |
| `PHOENIX_API_KEY`            | Phoenix System API key                                             |
| `JUDGE_API_KEY`              | OpenRouter API key for the judge model (preferred)                 |
| `OPENROUTER_API_KEY`         | Fallback; read by the OpenRouter SDK when `JUDGE_API_KEY` is unset |
| `JUDGE_BASE_URL`             | `https://openrouter.ai/api/v1`                                     |
| `JUDGE_MODEL`                | `google/gemini-2.5-flash` (default)                                |
| `JUDGE_REASONING_ENABLED`    | `true` (default)                                                   |
| `JUDGE_REASONING_MAX_TOKENS` | `1024` (default, positive integer)                                 |
| `SAMPLE_SIZE`                | `50` (default)                                                     |
| `LOOKBACK_HOURS`             | `6` (default)                                                      |

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

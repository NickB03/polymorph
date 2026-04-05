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
- **Service:** `phoenix`
- **Image:** `arizephoenix/phoenix`
- **Storage:** SQLite + Railway Volume (mounted at `/data`, working dir `/data/v2`)
- **Public domain:** `phoenix-production-c6b5.up.railway.app`
- **Private domain:** `phoenix.railway.internal` (for Railway-internal services)
- **Auth:** Enabled (`PHOENIX_ENABLE_AUTH=true`, `PHOENIX_SECRET` for JWT signing)

> **HTTPS required in production.** The `instrumentation.ts` enforces HTTPS for the collector endpoint when `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `RAILWAY_ENVIRONMENT=production`, or `NODE_ENV=production` (without `VERCEL_ENV`). If the endpoint uses plain HTTP, tracing is silently disabled and a console error is logged.

### Enabling tracing on Vercel

Set these env vars in the Vercel dashboard (Settings → Environment Variables, Production):

| Variable                     | Value                                            |
| ---------------------------- | ------------------------------------------------ |
| `ENABLE_TRACING`             | `true`                                           |
| `PHOENIX_COLLECTOR_ENDPOINT` | `https://phoenix-production-c6b5.up.railway.app` |
| `PHOENIX_PROJECT_NAME`       | `polymorph`                                      |
| `PHOENIX_API_KEY`            | System API key created in Phoenix UI             |

See [Environment Reference](../getting-started/ENVIRONMENT.md#tracing-arize-phoenix) for details.

### Evals cron service

The `services/evals/` directory contains a scheduled evaluation pipeline:

- Samples recent chats from Supabase Postgres using parameterized SQL (no string interpolation)
- Runs 3 LLM-judge evaluators (faithfulness, search relevance, response quality) built with a shared factory pattern and `extractVerdict()` with word-boundary matching
- Pushes results to Phoenix as experiments
- **Robustness:** `closeDb()` guaranteed on all exit paths (happy + fatal), NaN-safe `validInt()` config parsing, `maxAttempts >= 1` retry validation, safe `JSON.parse` for citations

**Railway deployment:**

- Deploy as a Railway cron service from `services/evals/Dockerfile`
- Schedule: `0 */6 * * *` (every 6 hours UTC)
- Uses private networking to Phoenix (`PHOENIX_HOST=http://phoenix.railway.internal:6006`)

**Required env vars:**

| Variable                     | Value                                                              |
| ---------------------------- | ------------------------------------------------------------------ |
| `DATABASE_URL`               | Supabase Postgres connection string                                |
| `PHOENIX_HOST`               | `http://phoenix.railway.internal:6006`                             |
| `PHOENIX_API_KEY`            | Phoenix System API key                                             |
| `JUDGE_API_KEY`              | OpenRouter API key for the judge model (preferred)                 |
| `OPENROUTER_API_KEY`         | Fallback; read by the OpenRouter SDK when `JUDGE_API_KEY` is unset |
| `JUDGE_BASE_URL`             | `https://openrouter.ai/api/v1`                                     |
| `JUDGE_MODEL`                | `google/gemini-3.1-flash-lite-preview` (default)                   |
| `JUDGE_REASONING_ENABLED`    | `false` (default)                                                  |
| `JUDGE_REASONING_MAX_TOKENS` | `1024` (default, positive integer)                                 |
| `SAMPLE_SIZE`                | `50` (default)                                                     |
| `LOOKBACK_HOURS`             | `6` (default)                                                      |

### Rotating Phoenix API keys

1. Log into Phoenix UI → Settings → API Keys
2. Create a new System API key
3. Update `PHOENIX_API_KEY` on both Vercel and the evals Railway service
4. Delete the old key in Phoenix

## Staging checklist

- [ ] Auth enabled and verified
- [ ] Required secrets present
- [ ] Migration status confirmed
- [ ] Chat/search flow validated
- [ ] Basic logs/telemetry visible
- [ ] Phoenix traces appearing (if `ENABLE_TRACING=true`)

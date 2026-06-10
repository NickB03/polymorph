# Environment Operations Variables

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Environment Reference](ENVIRONMENT.md)

This leaf covers admin access, cron jobs, evals, Phoenix tracing, and research-fetch troubleshooting.

## Admin surface

| Variable        | Required          | Purpose                                                                                                                                                                |
| --------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADMIN_USER_ID` | When admin needed | Supabase user ID that gates `app/(admin)/admin/*` routes via `lib/auth/is-admin.ts`. Without this, admin routes return `notFound()`. Ignored when `ENABLE_AUTH=false`. |

Use the [Browser QA runbook](../operations/runbooks/browser-qa-auth-admin.md)
for local admin user setup and `/admin/evals` browser verification.

## Vercel cron jobs

| Variable      | Required          | Purpose                                                                                                                      |
| ------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `CRON_SECRET` | In Vercel deploys | Bearer token required by `GET /api/suggestions/refresh` (declared in `vercel.json`, schedule `0 14 * * *`). Reject-on-empty. |

## Evals cron (Railway `polymorph-evals`)

See [Deployment → Evals cron service](../operations/EVALS-CRON.md#evals-cron-service) for the full env matrix.
The current repo baseline is OpenRouter-backed `google/gemini-3.1-flash-lite-preview` with `LOOKBACK_HOURS=48`, `SAMPLE_SIZE=10`, and `EVAL_CASE_CONCURRENCY=1`; the live cron cadence itself is managed in Railway.

## Tracing (Arize Phoenix)

Polymorph exports OpenTelemetry traces to a self-hosted Arize Phoenix instance. Tracing is gated behind `ENABLE_TRACING` and configured in `instrumentation.ts`.

| Variable                      | Required          | Default                 | Purpose                                                                                                                                                          |
| ----------------------------- | ----------------- | ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ENABLE_TRACING`              | No                | `false`                 | Gate all OTel trace export                                                                                                                                       |
| `EVAL_REPLAY_TRACING_ENABLED` | No                | `false`                 | Opt-in tracing for eval replay runs; leave off by default to avoid noisy/costly Phoenix traces                                                                   |
| `PHOENIX_COLLECTOR_ENDPOINT`  | When tracing on   | `http://localhost:6006` | Phoenix OTLP HTTP endpoint (base URL, no `/v1/traces`)                                                                                                           |
| `PHOENIX_PROJECT_NAME`        | No                | `polymorph-local`       | Project name shown in Phoenix UI. Convention: `polymorph-{env}` — `polymorph-prod`, `polymorph-preview`, `polymorph-local`. Never use the bare name `polymorph`. |
| `PHOENIX_API_KEY`             | When auth enabled | —                       | API key created in Phoenix; sets `Authorization: Bearer` header on the OTLP exporter                                                                             |
| `OTEL_EXPORTER_OTLP_HEADERS`  | No                | —                       | Standard OTel env var for exporter headers (redundant if `PHOENIX_API_KEY` is set; see note below)                                                               |

> **Production HTTPS enforcement:** When the app detects a production environment (`VERCEL_ENV`, `VERCEL_TARGET_ENV`, `RAILWAY_ENVIRONMENT`, or `NODE_ENV` set to `production`), the collector endpoint must use `https://`. Plain HTTP endpoints cause tracing to be silently disabled to protect the API key in transit.

**Production values** (Vercel environment variables):

```env
ENABLE_TRACING=true
PHOENIX_COLLECTOR_ENDPOINT=<public Phoenix URL, e.g. https://phoenix-production-xxxx.up.railway.app>
PHOENIX_PROJECT_NAME=polymorph-prod
PHOENIX_API_KEY=<API key created in Phoenix>
EVAL_REPLAY_TRACING_ENABLED=false
```

Set these in the Vercel dashboard under **Settings → Environment Variables** for the Production environment. Since Vercel serverless functions run outside of any private network, the Phoenix endpoint must be publicly reachable (with auth via `PHOENIX_API_KEY`).

For production masking, configure OpenInference environment variables according to the sensitivity of your trace data: `OPENINFERENCE_HIDE_INPUTS`, `OPENINFERENCE_HIDE_OUTPUTS`, `OPENINFERENCE_HIDE_INPUT_MESSAGES`, `OPENINFERENCE_HIDE_OUTPUT_MESSAGES`, `OPENINFERENCE_HIDE_INPUT_IMAGES`, `OPENINFERENCE_HIDE_INPUT_TEXT`, and `OPENINFERENCE_BASE64_IMAGE_MAX_LENGTH`.

**`PHOENIX_API_KEY` vs `OTEL_EXPORTER_OTLP_HEADERS`:** `instrumentation.ts` (lines 29-31) reads `PHOENIX_API_KEY` and explicitly sets the `Authorization: Bearer` header on the `OTLPTraceExporter`. The standard OTel env var `OTEL_EXPORTER_OTLP_HEADERS=Authorization=Bearer <key>` accomplishes the same thing at the SDK level. Setting `PHOENIX_API_KEY` alone is sufficient. Adding `OTEL_EXPORTER_OTLP_HEADERS` is harmless as a belt-and-suspenders approach but not required.

**Local development:** Set `ENABLE_TRACING=true` and leave `PHOENIX_COLLECTOR_ENDPOINT` at the default (`http://localhost:6006`) if running Phoenix locally via Docker.

## Troubleshooting research fetches

- If an extractor is rate-limited or over quota, the UI now surfaces the provider message instead of a generic failure.
- Typical symptoms include `Tavily extract error 432` or `Jina Reader error 429` in the fetch section and activity list.
- Search-based research should still complete because Brave, Tavily, and Exa are used before extraction and normal article pages can fall back to regular HTML fetching.

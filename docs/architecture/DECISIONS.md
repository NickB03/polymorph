# Architecture Decisions

> **Audience:** Architect | Contributor

Last updated: 2026-04-19

This document records the foundational architecture decisions for Polymorph.

## 1) Authentication and Backend

- **Provider**: Supabase
- **Local Dev**: Supabase CLI (Docker-based local backend)
- **Database**: PostgreSQL + Drizzle ORM
- **Authentication mode**: `ENABLE_AUTH=true` by default; can be disabled with `ENABLE_AUTH=false` (not allowed in cloud deployment mode)
- **Admin surface**: `ADMIN_USER_ID` env var gates `app/(admin)/admin/*` routes via `lib/auth/is-admin.ts`. Admin pages are route-group-isolated under `app/(admin)/`; the default chat shell lives under `app/(chat)/`.

## 2) Search and Content Extraction

- **Primary Search**: Brave (`BRAVE_SEARCH_API_KEY`) — default `SEARCH_API=brave` for optimized searches, and the dedicated general-search provider when its key is present. When Brave is not available for `type="general"`, the search tool falls back to the optimized provider chain.
- **Fallback / Alternative Providers**: Tavily (`TAVILY_API_KEY`), Exa (`EXA_API_KEY`), SearXNG (self-hosted, `SEARXNG_API_URL`), Firecrawl (`FIRECRAWL_API_KEY`) — any of which can be selected via `SEARCH_API`; the default optimized chain is Brave -> Tavily -> Exa.
- **Error Handling**: Typed `SearchProviderError` with HTTP status, retryable flag, and parsed `Retry-After`. Retries use jittered exponential backoff via `retrySearchOperation()` in `lib/utils/retry.ts`. See [Search Providers → Error Handling and Retries](SEARCH-PROVIDERS.md#error-handling-and-retries).
- **Extraction**: Jina Reader (`JINA_API_KEY`) when available, otherwise Tavily Extract. Recoverable extractor failures can fall back to regular HTML fetches for non-PDF URLs.

## 3) AI Model Orchestration

- **Primary Interface**: Vercel AI Gateway (`AI_GATEWAY_API_KEY`)
- **Default Models**: Grok 4.1 Fast Non-Reasoning (Speed), Grok 4.1 Fast Reasoning (Quality) — see [`config/models/default.json`](../../config/models/default.json)
- **Image Generation**: `gateway:google/gemini-2.5-flash-image` via the same Gateway interface (see `lib/tools/generate-image.ts`)

## 4) Storage Strategy

- **Provider**: Supabase Storage
- **Bucket**: `user-uploads` (Public/RLS-protected). Generated images upload to `{userId}/chats/{chatId}/generated-{timestamp}.{ext}` via `lib/supabase/server-storage.ts`.

## 5) Deployment Target

- **Primary**: Vercel (app, API routes, Vercel cron — see §7)
- **Secondary**: Docker (containerized app + local Redis)
- **Ancillary services (Railway)**: Phoenix observability (`phoenix` service, persistent SQLite on volume `phoenix-volume-v8K9`) and the offline evals cron (`polymorph-evals`)

## 6) Observability

- **Selected**: Arize Phoenix (replaced Langfuse). OpenInference semantic conventions via OpenTelemetry.
- **Project naming convention**: `polymorph-{env}` (e.g., `polymorph-prod`, `polymorph-preview`, `polymorph-local`). Controlled via `PHOENIX_PROJECT_NAME`.
- **HTTPS enforced in production**: `instrumentation.ts` silently disables tracing if `PHOENIX_COLLECTOR_ENDPOINT` is plain HTTP and the environment is production (`VERCEL_ENV`, `VERCEL_TARGET_ENV`, `RAILWAY_ENVIRONMENT`, or `NODE_ENV` set to `production`).
- **Persistence**: Phoenix data lives on a Railway volume. Verify via `railway volume list --json`. Without an attached volume, redeploy wipes traces.

## 7) Scheduled Jobs

- **Vercel cron (user-facing refresh tasks)**: `vercel.json` declares `GET /api/suggestions/refresh` at `0 14 * * *` (14:00 UTC daily). Bearer-token auth via `CRON_SECRET`; regenerates the `trending_suggestions_cache` Postgres singleton used by `/api/suggestions`.
- **Railway cron (offline evals)**: `polymorph-evals` is intended to run on an every-48-hours cadence for the personal-project baseline. The exact live schedule is managed in Railway rather than this repo. The repo defaults use `google/gemini-3.1-flash-lite-preview`, `LOOKBACK_HOURS=48`, `SAMPLE_SIZE=10`, and `EVAL_CASE_CONCURRENCY=1`, then push results to Phoenix as experiments and persist summaries to `eval_summaries` for the admin `/admin/evals` dashboard.

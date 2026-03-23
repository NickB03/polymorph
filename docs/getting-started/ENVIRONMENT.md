# Polymorph Environment Reference

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Quickstart Guide](QUICKSTART.md)

This document defines the environment-variable matrix for Polymorph.

## Required (Day-1 bootstrap)

| Variable             | Required | Purpose                                           |
| -------------------- | -------- | ------------------------------------------------- |
| `DATABASE_URL`       | Yes      | PostgreSQL connection string for Drizzle/Supabase |
| `AI_GATEWAY_API_KEY` | Yes      | Vercel AI Gateway provider key                    |
| `TAVILY_API_KEY`     | Optional | Secondary search / extract provider key           |

## Core behavior controls

| Variable              | Default                           | Purpose                                    |
| --------------------- | --------------------------------- | ------------------------------------------ |
| `ENABLE_AUTH`         | `true`                            | Toggle auth required mode                  |
| `ANONYMOUS_USER_ID`   | `anonymous-user`                  | Shared local user id when auth is disabled |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:43100` fallback | Metadata base URL and canonical links      |

## Cloud deployment controls

| Variable                                 | Required in cloud       | Purpose                                    |
| ---------------------------------------- | ----------------------- | ------------------------------------------ |
| `POLYMORPH_CLOUD_DEPLOYMENT`             | Yes                     | Enables cloud-mode guardrails and behavior |
| `NEXT_PUBLIC_POLYMORPH_CLOUD_DEPLOYMENT` | Recommended             | Hides client-only controls in cloud mode   |
| `UPSTASH_REDIS_REST_URL`                 | Yes (if limits enabled) | Redis endpoint for limits                  |
| `UPSTASH_REDIS_REST_TOKEN`               | Yes (if limits enabled) | Redis credential                           |

## Authentication (Supabase)

Required when `ENABLE_AUTH=true`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Storage (Supabase)

- `SUPABASE_STORAGE_BUCKET` (default: `user-uploads`)

## Search provider options

- `BRAVE_SEARCH_API_KEY` (primary search provider; preferred for general web research and multimedia results)
- `TAVILY_API_KEY` (secondary search provider and optional extract fallback for `fetch type="api"`)
- `EXA_API_KEY` (tertiary text-search fallback when Brave and Tavily fail)
- `JINA_API_KEY` (optional extract provider for `fetch type="api"`, not required for the default setup)
- `SEARCH_API` (`brave`, `tavily`, `exa`, `searxng`, `firecrawl`)
- `FIRECRAWL_API_KEY` (if selected explicitly)
- `SEARXNG_API_URL` (required when `SEARCH_API=searxng`)

`fetch type="api"` is reserved for PDFs and explicit extraction needs on hard-to-parse pages. Normal HTML article pages should generally be handled by search results or `fetch type="regular"`, which keeps research resilient even when an extractor is rate-limited or quota-limited.

## AI provider options (Direct)

- `OPENAI_API_KEY`
- `ANTHROPIC_API_KEY`
- `GOOGLE_GENERATIVE_AI_API_KEY`
- `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL` (any OpenAI-compatible API)
- `OLLAMA_BASE_URL`

## Canvas artifacts

| Variable              | Default | Purpose                                                                              |
| --------------------- | ------- | ------------------------------------------------------------------------------------ |
| `GUEST_CANVAS_SECRET` | —       | HMAC-SHA256 secret for signing guest canvas tokens (required for guest artifact use) |

## Optional platform features

- Guest mode: `ENABLE_GUEST_CHAT` (recommended), `GUEST_CHAT_DAILY_LIMIT`
- Tracing/observability: `ENABLE_LANGFUSE_TRACING`, `LANGFUSE_*`
- Performance diagnostics: `ENABLE_PERF_LOGGING`

### Troubleshooting research fetches

- If an extractor is rate-limited or over quota, the UI now surfaces the provider message instead of a generic failure.
- Typical symptoms include `Tavily extract error 432` or `Jina Reader error 429` in the fetch section and activity list.
- Search-based research should still complete because Brave, Tavily, and Exa are used before extraction and normal article pages can fall back to regular HTML fetching.

## Local setup workflow

1. `cp .env.local.example .env.local`
2. Start local Supabase CLI: `npx supabase start`
   - **Note:** This project uses a custom port range (**4432x**) to avoid conflicts with other Supabase projects.
3. Fill required variables in `.env.local`:
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres`
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321`
   - `DATABASE_SSL_DISABLED=true` (Required for local DB)
4. **Docker Networking:** If running the app via Docker, the container must use `host.docker.internal:44322` for the database URL (this is pre-configured in `docker-compose.yaml`).
5. `bun run migrate`
6. `bun dev`

## Implementation Details

### Guest Chat (`ENABLE_GUEST_CHAT`)

Guest mode is the recommended default experience. It lets unauthenticated users search immediately without signing in — reducing friction and letting users experience the product before creating an account.

- Set `ENABLE_GUEST_CHAT=true` (recommended) to allow unauthenticated users to search.
- Set `ENABLE_GUEST_CHAT=false` to require sign-in before any search.
- Guest sessions are ephemeral: chats are not persisted, and guests are limited to speed-mode models.
- `GUEST_CHAT_DAILY_LIMIT` (default: `10`) caps daily searches per IP. Requires Redis (`UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN`) when running in cloud mode. When the limit is reached, a friendly 429 response encourages account creation.

### Cloud Mode (`POLYMORPH_CLOUD_DEPLOYMENT`)

- Enabling this mode locally requires `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to be configured, or the app will fail to initialize rate limiting and search caching.

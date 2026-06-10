# Environment Core Variables

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Environment Reference](ENVIRONMENT.md)

This leaf lists the required bootstrap variables and core runtime controls.

## Required (Day-1 bootstrap)

| Variable                  | Required                         | Purpose                                                                                                                                                                         |
| ------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`            | Yes                              | PostgreSQL connection string for Drizzle/Supabase; `POSTGRES_URL` is also accepted                                                                                              |
| `DATABASE_RESTRICTED_URL` | Optional                         | Lower-privilege PostgreSQL connection string. When set, the runtime query client prefers it over `DATABASE_URL` (`lib/db/index.ts`); the privileged admin client never uses it. |
| `OPENROUTER_API_KEY`      | Required for default text models | OpenRouter provider key                                                                                                                                                         |
| `AI_GATEWAY_API_KEY`      | Optional                         | Vercel AI Gateway provider key; currently used for image generation                                                                                                             |
| `BRAVE_SEARCH_API_KEY`    | Required for the default search  | Primary search provider when `SEARCH_API=brave` (default); enables web + multimedia search                                                                                      |
| `TAVILY_API_KEY`          | Optional                         | Alternative search / extract provider key                                                                                                                                       |

## Core behavior controls

| Variable                | Default                               | Purpose                                                        |
| ----------------------- | ------------------------------------- | -------------------------------------------------------------- |
| `ENABLE_AUTH`           | `true`                                | Toggle auth required mode                                      |
| `ANONYMOUS_USER_ID`     | `anonymous-user`                      | Shared local user id when auth is disabled                     |
| `DATABASE_SSL_DISABLED` | `false`                               | Disable SSL for local Supabase / Docker PostgreSQL             |
| `NEXT_PUBLIC_APP_URL`   | `http://localhost:43100` in local dev | Metadata base URL and canonical links. Required in production. |

## Cloud deployment controls

| Variable                     | Required in cloud                     | Purpose                                                                                                                                     |
| ---------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `POLYMORPH_CLOUD_DEPLOYMENT` | Yes                                   | Enables cloud-mode guardrails and behavior. `VANA_CLOUD_DEPLOYMENT=true` is accepted as a backward-compatible alias (`lib/utils/index.ts`). |
| `UPSTASH_REDIS_REST_URL`     | Yes, if you want chat limits enforced | Redis endpoint for limits                                                                                                                   |
| `UPSTASH_REDIS_REST_TOKEN`   | Yes, if you want chat limits enforced | Redis credential                                                                                                                            |

## Authentication (Supabase)

Required when `ENABLE_AUTH=true`:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## Storage (Supabase)

- `SUPABASE_STORAGE_BUCKET` (default: `user-uploads`)
- `SUPABASE_SERVICE_ROLE_KEY` — service-role key required for server-side storage uploads (`lib/supabase/server-storage.ts`); used together with `NEXT_PUBLIC_SUPABASE_URL`. Keep server-only (never expose to the client).

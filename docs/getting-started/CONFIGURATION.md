# Configuration Guide

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Quickstart Guide](QUICKSTART.md)

This guide covers application configuration for Polymorph, including required startup variables and optional capabilities.

## Baseline Bootstrap

For local Supabase or Docker, the app boots with these database settings:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
DATABASE_SSL_DISABLED=true
```

For the shipped default experience, add the provider keys used by the current model and search config:

```bash
OPENROUTER_API_KEY=[YOUR_OPENROUTER_KEY]
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_KEY]
```

## Authentication Modes

### Supabase Authentication (Recommended)

```bash
ENABLE_AUTH=true
NEXT_PUBLIC_SUPABASE_URL=[YOUR_SUPABASE_PROJECT_URL]
NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]
```

### Anonymous Mode (Local Development Only)

```bash
ENABLE_AUTH=false
ANONYMOUS_USER_ID=anonymous-user
```

## Search Providers

### Primary search provider (recommended)

- **Brave** (default) — general web research and multimedia results
- Alternative primary: Tavily, Exa, Firecrawl, or SearXNG

### Optional secondary/fallback providers

```bash
TAVILY_API_KEY=[YOUR_TAVILY_API_KEY]
```

When Brave is configured, Tavily and Exa serve as automatic fallbacks. See [Environment Reference](ENVIRONMENT.md) for the full provider matrix.

## Geo and Map Tools

To enable the full geo toolchain, configure:

```bash
NEXT_PUBLIC_MAPTILER_API_KEY=[YOUR_CLIENT_MAPTILER_KEY]
MAPTILER_API_KEY=[YOUR_SERVER_MAPTILER_KEY]
ORS_API_KEY=[YOUR_OPENROUTESERVICE_KEY]
```

- `NEXT_PUBLIC_MAPTILER_API_KEY` powers client-side basemap tiles for `displayGeoMap` and the public static map URLs returned by `getStaticMapImage`.
- `MAPTILER_API_KEY` powers server-side geocoding, routing, and other server-only MapTiler calls.
- `ORS_API_KEY` powers `getIsochrone` reachability polygons.

Without these keys, the UI still loads, but geo features degrade: client maps fall back to CARTO Voyager, and `getIsochrone` returns a structured error instead of polygon data.

## AI Provider Options

Default text model config ships with OpenRouter. Vercel AI Gateway is still used for image generation when `AI_GATEWAY_API_KEY` is configured. Direct providers are also supported:

- OpenRouter (`OPENROUTER_API_KEY`)
- OpenAI (`OPENAI_API_KEY`)
- Anthropic (`ANTHROPIC_API_KEY`)
- Google (`GOOGLE_GENERATIVE_AI_API_KEY`)
- Ollama (`OLLAMA_BASE_URL`)
- OpenAI-compatible (`OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL`)

If you change providers, ensure model IDs in `config/models/*.json` are compatible.

## Cloud Deployment Controls

For managed cloud mode, enable:

```bash
POLYMORPH_CLOUD_DEPLOYMENT=true
```

If you want chat rate limits enforced in cloud mode, also configure:

```bash
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

## Admin Access

The admin surface (`/admin/evals`) is gated by a single environment variable:

```bash
ADMIN_USER_ID=[SUPABASE_USER_ID]
```

Only a session whose `user.id` matches will render admin routes. Unauthenticated requests are redirected to `/auth/login`; authenticated non-admin users get `notFound()`. `ENABLE_AUTH=false` still disables admin access entirely.

## Optional Features

- Guest chat: `ENABLE_GUEST_CHAT=true`
- Guest daily limit: `GUEST_CHAT_DAILY_LIMIT=10`
- Phoenix tracing: `ENABLE_TRACING=true`
- File uploads: `SUPABASE_STORAGE_BUCKET=user-uploads`
- Perf logging: `ENABLE_PERF_LOGGING=true`
- Vercel cron (suggestions refresh): `CRON_SECRET=[RANDOM_SECRET]` — required in Vercel deployments; see `vercel.json`

For full variable documentation, see `.env.local.example` and [Environment Reference](ENVIRONMENT.md).

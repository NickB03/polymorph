# Configuration Guide

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Quickstart Guide](QUICKSTART.md)

This guide covers application configuration for Polymorph, including required startup variables and optional capabilities.

## Required Day-1 Configuration

Polymorph requires the following environment variables to run:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
DATABASE_SSL_DISABLED=true
AI_GATEWAY_API_KEY=[YOUR_VERCEL_GATEWAY_KEY]
```

For web search, add at least one provider key:

```bash
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_KEY]
```

These defaults are optimized for a fast local bootstrap with Vercel AI Gateway + Brave Search.

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

## AI Provider Options

Default model config ships with Vercel AI Gateway. Direct providers are also supported:

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

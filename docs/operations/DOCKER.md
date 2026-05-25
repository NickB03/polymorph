# Docker Guide

> **Audience:** Operator
> **Prerequisites:** [Quickstart Guide](../getting-started/QUICKSTART.md)
> **Scope:** Local development against a Supabase-CLI Postgres. Production deploys to Vercel ([Deployment Guide](DEPLOYMENT.md)); this guide is the alternative for running the same image on a developer machine without the Vercel build pipeline.

## Quick Start (Docker Compose)

1. Prepare environment variables:

```bash
cp .env.local.example .env.local
```

2. Start your backend infrastructure (Supabase CLI):

```bash
npx supabase start
```

3. Edit `.env.local` and set at least:

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
DATABASE_SSL_DISABLED=true
OPENROUTER_API_KEY=your_openrouter_key
BRAVE_SEARCH_API_KEY=your_brave_key
```

If you want to chat anonymously in local Docker, either configure Supabase Auth (`NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY`) or set `ENABLE_GUEST_CHAT=true`.

4. Start services:

```bash
docker compose up -d
```

5. Open the app at `http://localhost:43100`.

### What starts in Docker Compose

- `polymorph` app container (built from `Dockerfile`; entrypoint runs `bun run migrate` on every container start before starting the server)
- Redis (used for caching and rate limiting)

**Note:** PostgreSQL, Authentication, and Storage are managed by the Supabase CLI (or Supabase Cloud in production). The compose file rewrites `DATABASE_URL` to `host.docker.internal:44322` so the container can reach Supabase running on the host. All other environment variables flow through `env_file: .env.local`.

## Authentication posture in Docker

By default, the app runs with:

```bash
ENABLE_AUTH=true
```

Ensure you have configured your Supabase project URL and keys in `.env.local`.

## Useful commands

```bash
# Start in background
docker compose up -d

# Stop services
docker compose down

# Stop and remove volumes
docker compose down -v

# Follow app logs
docker compose logs -f polymorph

# Rebuild app image
docker compose build polymorph
```

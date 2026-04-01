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

### Observability (Arize Phoenix)

> **HTTPS required in production.** The `instrumentation.ts` enforces HTTPS for the collector endpoint when `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `RAILWAY_ENVIRONMENT=production`, or `NODE_ENV=production` (without `VERCEL_ENV`). If the endpoint uses plain HTTP, tracing is silently disabled and a console error is logged.

## Rollback strategy

1. Keep immutable build artifacts/images per release tag
2. If deployment fails, roll back to prior known-good release
3. Re-run smoke test (homepage + one query + citations) on rolled-back version

## Staging checklist

- [ ] Auth enabled and verified
- [ ] Required secrets present
- [ ] Migration status confirmed
- [ ] Chat/search flow validated
- [ ] Basic logs/telemetry visible

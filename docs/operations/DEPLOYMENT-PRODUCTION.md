# Production Deployment

> **Audience:** Operator
> **Prerequisites:** [Deployment Guide](DEPLOYMENT.md)

This leaf covers the production deployment baseline, Vercel cron, healthchecks, rollback, and staging checklist.

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
OPENROUTER_API_KEY=[YOUR_OPENROUTER_KEY]
AI_GATEWAY_API_KEY=[YOUR_VERCEL_GATEWAY_KEY_FOR_IMAGE_GENERATION]
BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_KEY]
NEXT_PUBLIC_APP_URL=[YOUR_PUBLIC_APP_URL]
CRON_SECRET=[RANDOM_LONG_STRING]
ADMIN_USER_ID=[SUPABASE_USER_ID_FOR_ADMIN_ACCESS]
```

`BRAVE_SEARCH_API_KEY` is the default search provider (`SEARCH_API=brave`). Set `TAVILY_API_KEY`, `EXA_API_KEY`, or another provider key instead if you prefer. `CRON_SECRET` is required for the Vercel cron in the next section. `ADMIN_USER_ID` is optional — required only if you want `/admin/*` routes to resolve for a specific user.

For the current Vercel production alias, set:

```bash
NEXT_PUBLIC_APP_URL=https://polymorph.fyi
```

If cloud controls are enabled:

```bash
POLYMORPH_CLOUD_DEPLOYMENT=true
UPSTASH_REDIS_REST_URL=[YOUR_UPSTASH_URL]
UPSTASH_REDIS_REST_TOKEN=[YOUR_UPSTASH_TOKEN]
```

`UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are only needed if you want chat limits enforced in cloud mode. If they are absent, the app still boots and the limit checks fall back to allow-all behavior.

For geo maps, routing, and static map images, also set:

```bash
NEXT_PUBLIC_MAPTILER_API_KEY=[YOUR_CLIENT_MAPTILER_KEY]
MAPTILER_API_KEY=[YOUR_SERVER_MAPTILER_KEY]
ORS_API_KEY=[YOUR_OPENROUTESERVICE_KEY]
```

- `NEXT_PUBLIC_MAPTILER_API_KEY` serves client-side tiles for `displayGeoMap` and the public static map URLs returned by `getStaticMapImage`.
- `MAPTILER_API_KEY` serves `geocodeAddress`, `getDirections`, and other server-only MapTiler calls.
- `ORS_API_KEY` enables `getIsochrone`; without it the tool returns a structured error instead of a polygon.

## Vercel cron — trending suggestions refresh

`vercel.json` at the repo root declares a single daily cron job:

```json
{
  "crons": [{ "path": "/api/suggestions/refresh", "schedule": "0 14 * * *" }]
}
```

- **Schedule:** 14:00 UTC daily.
- **Target:** `GET /api/suggestions/refresh` (`app/api/suggestions/refresh/route.ts`, `maxDuration = 60` seconds).
- **Auth:** `Authorization: Bearer <CRON_SECRET>`. Vercel sends `CRON_SECRET` automatically when the env var is set in the project — you only need to set it in the dashboard.
- **Side effect:** regenerates trending suggestions via `generateTrendingSuggestions()` (multi-provider cascade: Brave → Tavily → Exa) and upserts the singleton row in `trending_suggestions_cache` via the privileged DB client (`lib/db/admin.ts`).
- **Failure modes:** returns `500` with `error: 'not-configured'` if `CRON_SECRET` is absent; `401` on bad auth; `500` on generation failure. Inspect Vercel function logs for the specific error message.
- **Read path:** `GET /api/suggestions` reads the same table and blends cached suggestions with static rotation. A stale cache (over 25 hours old) is treated as absent and falls back to static suggestions — so a missed cron run is degraded, not broken.

## Healthcheck expectations

- App should respond on `/` and complete one end-to-end chat request
- Database migrations must be applied (`bun run migrate`) before accepting traffic
- **Self-hosted Docker deployments:** Consider moving `bun run migrate` from the Docker entrypoint to a one-shot pre-deploy step to avoid race conditions with multi-replica deployments. The entrypoint currently runs migrations on every container start. (Polymorph itself deploys to Vercel; only Phoenix and the `polymorph-evals` cron run on Railway.)
- At least one configured model/provider must be enabled at runtime
- Monitor `https://polymorph.fyi/api/health` rather than raw deployment URLs. Deployment URLs may still be protected by Vercel Authentication.

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
- [ ] Phoenix traces appearing (if `ENABLE_TRACING=true`)

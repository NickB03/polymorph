# Day-2 Operations Runbook

> **Audience:** Operator
> **Prerequisites:** [Deployment Guide](../DEPLOYMENT.md)

This runbook is for operators maintaining Polymorph after initial deployment. It covers the live surface: the Vercel-hosted app, the Phoenix observability service on Railway, and the `polymorph-evals` cron service on Railway.

## 1) Incident triage flow

1. Confirm blast radius (all users vs subset; production vs preview)
2. Check Vercel app logs for API failures (`/api/chat`, provider errors, `/api/health`)
3. Check Supabase connectivity and migration state
4. Check Phoenix availability (`https://phoenix-production-c6b5.up.railway.app/`)
5. Check search and model provider health
6. Mitigate with rollback (Vercel: redeploy prior tag) or provider fallback
7. Open a follow-up issue with the failure label and timeline

## 2) Key rotation checklist

Rotate on schedule and after any suspected exposure. Each key has a distinct surface — rotating one does not rotate the others.

| Key                    | Where it's set                                                    | What it gates                                                                       |
| ---------------------- | ----------------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| AI provider key(s)     | Vercel env (Production)                                           | Text generation via `OPENROUTER_API_KEY`; image generation via `AI_GATEWAY_API_KEY` |
| Search provider key(s) | Vercel env (Production)                                           | `BRAVE_SEARCH_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`                             |
| Supabase anon key      | Vercel env (Production)                                           | Browser-side Supabase access                                                        |
| Upstash Redis token    | Vercel env (Production)                                           | Rate limiting and guest-chat counters                                               |
| `CRON_SECRET`          | Vercel env (Production)                                           | `/api/suggestions/refresh` Vercel cron auth                                         |
| `GUEST_CANVAS_SECRET`  | Vercel env (Production)                                           | HMAC signing of guest canvas tokens (rotates on every successful guest write)       |
| `PHOENIX_API_KEY`      | Vercel env (Production) **and** `polymorph-evals` Railway service | Trace ingestion + experiment writes                                                 |
| `PHOENIX_ADMIN_SECRET` | Phoenix Railway service                                           | Admin REST endpoints (`/v1/projects` etc.)                                          |
| `EVAL_RUNNER_SECRET`   | Vercel env **and** `polymorph-evals` Railway service              | Auth between the evals cron and `/api/evals/run`                                    |
| `JUDGE_API_KEY`        | `polymorph-evals` Railway service                                 | LLM-judge model calls during eval runs; required at evals service startup           |

After rotation:

1. Update the secret in every place listed above (Phoenix keys live on **two** services; missing one breaks the cron silently).
2. Redeploy the affected services (Vercel auto-redeploys on env change; Railway: `railway redeploy -s <service>`).
3. Run the smoke test: chat request + citation path + admin `/admin/evals`
   dashboard load. Use the [browser QA runbook](browser-qa-auth-admin.md) for
   authenticated admin routes.
4. For `PHOENIX_API_KEY` rotation, confirm Phoenix persistence first per [PHOENIX-OPERATIONS.md → Persistence verification](../PHOENIX-OPERATIONS.md#persistence-verification-run-after-every-phoenix-deploy). A pre-rotation wipe loses the new token rows.

## 3) Provider outage fallback

If primary LLM provider fails:

1. Switch to alternate configured provider keys
2. Validate model IDs in `config/models/*.json`
3. Redeploy on Vercel and verify one complete response

If search provider fails:

1. Switch `SEARCH_API` to alternate provider (`brave`, `tavily`, `exa`, `firecrawl`, or `searxng`)
2. Ensure the corresponding API key exists
3. Validate search and citation output

## 4) Telemetry review routine

Daily:

- App error logs trend on Vercel (`@level:error` filter)
- Request latency anomalies on `/api/chat`
- Rate-limit spikes on `/api/chat` and guest endpoints
- Provider-specific failure rates surfaced via Phoenix LLM spans

Weekly:

- Cost and token usage trends in Phoenix
- Slow query / provider latency patterns
- `eval_summaries` rolling pass rate per suite (capability, regression, traffic-monitor) on `/admin/evals`
- Phoenix volume usage (retention is `PHOENIX_DEFAULT_RETENTION_POLICY_DAYS=14`; SQLite VACUUM is required to actually shrink the volume file — see [DEPLOYMENT.md](../DEPLOYMENT.md))

## 5) Evals cron failure modes

The `polymorph-evals` Railway cron runs every 48 hours. Two distinct failure labels appear in the logs and indicate different root causes:

| Label                 | Meaning                                                                                | Investigation                                                                                                                    |
| --------------------- | -------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `PHOENIX UNAVAILABLE` | Phoenix HTTP layer down — experiment creation failed; suite never reached the DB write | Check Phoenix service logs; verify volume mount; confirm `PHOENIX_HOST` resolves                                                 |
| `DB WRITE FAILED`     | Phoenix experiment succeeded; the Postgres write to `eval_summaries` failed            | Check Postgres connectivity; verify the sampler's DB role has the right RLS context; confirm `eval_summaries` table is reachable |

Threshold breaches are warning-only by default (`EVAL_EXIT_ON_THRESHOLD_BREACH=false`). Set `EVAL_EXIT_ON_THRESHOLD_BREACH=true` when threshold breaches should fail the cron; DB write failures still throw separately after the mode finishes. When the dashboard is missing a row but Phoenix shows the experiment, suspect `DB WRITE FAILED`.

Useful commands:

```bash
railway logs -s polymorph-evals -n 50
railway logs -s polymorph-evals --filter "PHOENIX UNAVAILABLE"
railway logs -s polymorph-evals --filter "DB WRITE FAILED"
```

## 6) On-demand actions

| Need                                                 | Command                                                            |
| ---------------------------------------------------- | ------------------------------------------------------------------ |
| Restart Phoenix without rebuild                      | `railway restart -s phoenix`                                       |
| Rebuild + redeploy Phoenix                           | `railway redeploy -s phoenix`                                      |
| Rebuild evals image (does **not** run a cron firing) | `railway redeploy -s polymorph-evals`                              |
| Fire an immediate one-off cron run                   | Railway dashboard → `polymorph-evals` → Deployments → ⋯ → Redeploy |

Verify Phoenix volume is real and attached:

```bash
railway volume list --json | jq '.volumes[] | select(.name | startswith("phoenix"))'
```

# Evals Cron Service

> **Audience:** Operator
> **Prerequisites:** [Deployment Guide](DEPLOYMENT.md)

This leaf covers the Railway `polymorph-evals` cron service, defaults, required environment, and manual run caveat.

## Evals cron service

The `services/evals/` directory contains a scheduled evaluation pipeline:

- Samples recent chats from Supabase Postgres using parameterized SQL (no string interpolation)
- Runs 9 evaluators: 3 deterministic (`prechecks`, `tool-usage`, `no-tool-placeholders`) + 6 LLM-judge (tool-selection, faithfulness, relevance, response-quality, safety, citation-accuracy) built with a shared factory pattern and `extractVerdict()` with word-boundary matching
- Pushes results to Phoenix as experiments **and** persists aggregate rows to `eval_summaries` plus per-case diagnostics to `eval_case_results`, which power the admin `/admin/evals` dashboard (Test Suite, Production Evals, and Regression Tests). After the next cron firing, operators should see fresh rows on the dashboard; if they don't, suspect the sampler's DB role missing the RLS context for write paths (see `lib/db/schema.ts` for the eval summary/case-result RLS policies and the live Railway `DATABASE_URL` role).
- **Robustness:** `closeDb()` guaranteed on all exit paths (happy + fatal), NaN-safe `validInt()` config parsing, `maxAttempts >= 1` retry validation, safe `JSON.parse` for citations
- **Failure-mode split in logs:** two distinct error labels, each pointing at a different system.
  - `[evals] PHOENIX UNAVAILABLE - could not record <suite> experiment results` — Phoenix HTTP layer is down, dataset/experiment creation failed. The suite never reached the DB write step. Investigate Phoenix service health (`railway logs -s phoenix`, `/` 200 check).
  - `[evals] DB WRITE FAILED - could not persist <suite> eval summary` — Phoenix experiment was created successfully, but the Postgres write to `eval_summaries` failed. The Phoenix experiment is intact; only the dashboard row is missing. Investigate Postgres connectivity, the RLS role on `DATABASE_URL`, and the `eval_summaries` table.
  - Threshold breaches are warning-only by default so a personal-project cron keeps publishing Phoenix and dashboard evidence. Set `EVAL_EXIT_ON_THRESHOLD_BREACH=true` when you want threshold breaches from capability, regression, traffic-monitor, or any other persisted eval suite to fail the cron. If a DB write fails, the runner still surfaces the DB failure after the mode finishes so the missing dashboard row is visible.

> **The `evaluators` project in the Phoenix UI is Phoenix-managed, not ours.** When an experiment runs, Phoenix auto-routes the judge model's LLM spans into a reserved project called `evaluators`. You can't rename, delete, or reconfigure it — it exists anywhere experiments run. This is why you'll see traces there even though `services/evals/` never sets `PHOENIX_PROJECT_NAME`.
>
> **Ad-hoc evals run locally against `bun dev`, not against preview deployments.** The Railway cron above targets production (`EVAL_RUNNER_URL=https://polymorph.fyi`). For one-off runs on a branch, run `services/evals/` locally with `EVAL_RUNNER_URL=http://localhost:43100` and a matching `EVAL_RUNNER_SECRET` set in both your local `.env.local` and the shell invoking the evals service. The `capability`, `regression`, and `traffic-monitor` modes call `/api/evals/run` (secret-gated); the unpersisted `smoke` path instead calls `/api/chat` directly using a Supabase seed user, so it needs `APP_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` — see `services/evals/src/config.ts` for the exact required set per mode. Vercel Preview deployments intentionally do **not** have `EVAL_RUNNER_SECRET` configured, so `/api/evals/run` on a preview URL returns HTTP 403 — preview remains a visual-QA surface, not an eval target.
>
> For browser-only QA of authenticated admin pages such as `/admin/evals`, use
> the [Browser QA runbook](runbooks/browser-qa-auth-admin.md) and local synthetic
> seed data.

**Scheduled portfolio baseline:**

- Mode: `regression`
- Case selector: `reg-research-mode`
- Schedule: Monday at 15:00 UTC (`0 15 * * 1`)
- Persisted destination: Phoenix plus `eval_summaries` / `eval_case_results`
- Nominal model work: one app replay plus six LLM judge requests, plus model-selected search-provider calls
- Retry ceiling under transient failures: three app replay attempts plus eighteen LLM judge requests
- Organic traffic is not required for a successful scheduled firing

**Railway deployment:**

- Deploy as a Railway cron service from `services/evals/Dockerfile`
- Schedule: set the Railway cron to Monday at 15:00 UTC (`0 15 * * 1`) for the production baseline. This schedule is managed in Railway, not in git.
- Uses private networking to Phoenix for writes (`PHOENIX_HOST=http://phoenix.railway.internal:6006`) and `PHOENIX_PUBLIC_URL` for dashboard links.

> **Triggering a cron run manually.** `railway redeploy -s polymorph-evals` from the CLI rebuilds the image and re-registers the schedule — it does **not** execute the container CMD. For an immediate one-off run use the Railway dashboard (`Deployments → ⋯ → Redeploy`), which does run the CMD. Otherwise wait for the next scheduled tick.

**Cost-sensitive baseline defaults:**

- Judge model: `google/gemini-3.1-flash-lite-preview`
- Eval concurrency: `1`
- Eval runner case timeout: `300000` ms

### Optional `traffic-monitor` settings

`SAMPLE_SIZE` defaults to `10` chats and `LOOKBACK_HOURS` defaults to `48` hours for intentional organic-traffic audits. They have no effect in `regression` mode. If you widen the lookback for a traffic-monitor audit, the sampler can rescore the same chats on multiple runs because it samples from the current window and does not track previously evaluated chat IDs.

**Required env vars:**

| Variable                        | Value                                                                                                             |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`                  | Supabase Postgres connection string                                                                               |
| `EVAL_RUN_MODE`                 | `regression` for the scheduled production canary                                                                  |
| `EVAL_CASE_IDS`                 | `reg-research-mode` to cap the scheduled run at one case; unset runs the full selected judged suite               |
| `EVAL_RUNNER_URL`               | Production app URL for `/api/evals/run`                                                                           |
| `EVAL_RUNNER_SECRET`            | Shared secret that matches the app's `EVAL_RUNNER_SECRET`                                                         |
| `PHOENIX_HOST`                  | `http://phoenix.railway.internal:6006`                                                                            |
| `PHOENIX_PUBLIC_URL`            | Public Phoenix URL used in persisted dashboard links                                                              |
| `PHOENIX_API_KEY`               | Phoenix System API key                                                                                            |
| `JUDGE_API_KEY`                 | OpenRouter API key for the judge model; required by `services/evals` startup validation                           |
| `JUDGE_BASE_URL`                | `https://openrouter.ai/api/v1`                                                                                    |
| `JUDGE_MODEL`                   | `google/gemini-3.1-flash-lite-preview` (default)                                                                  |
| `JUDGE_REASONING_ENABLED`       | `true` (default)                                                                                                  |
| `JUDGE_REASONING_MAX_TOKENS`    | `1024` (default, positive integer)                                                                                |
| `EVAL_CASE_CONCURRENCY`         | `1`                                                                                                               |
| `EVAL_RUNNER_TIMEOUT_MS`        | `300000` (default) per `/api/evals/run` case replay                                                               |
| `EVAL_EXIT_ON_THRESHOLD_BREACH` | `false` (default) — when `true`, the cron exits non-zero on threshold breach so Railway marks the run as failed   |
| `JUDGE_LOG_PARAMS`              | unset (default) — optional debug flag; set to `1` to log the judge model's resolved sampling parameters to stdout |

### Optional organic traffic audit

`traffic-monitor` remains available for an intentional one-off audit when real traffic exists. It is not the scheduled portfolio baseline. A lack of organic chats is expected for this demo and must not be worked around by generating seed-user traffic and labeling it as production traffic.

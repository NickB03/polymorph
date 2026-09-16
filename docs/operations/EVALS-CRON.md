# Evals Cron Service

> **Audience:** Operator
> **Prerequisites:** [Deployment Guide](DEPLOYMENT.md)

This leaf covers the Railway `polymorph-evals` cron service, defaults, required environment, and manual run caveat.

## Evals cron service

The `services/evals/` directory contains a scheduled evaluation pipeline:

- In optional `traffic-monitor` mode, samples recent chats from Supabase Postgres using parameterized SQL (no string interpolation); the scheduled regression baseline uses the static corpus instead
- Runs 9 evaluators: 3 deterministic (`prechecks`, `tool-usage`, `no-tool-placeholders`) + 6 LLM-judge (tool-selection, faithfulness, relevance, response-quality, safety, citation-accuracy) built with a shared factory pattern and `extractVerdict()` with word-boundary matching
- Pushes results to Phoenix as experiments **and** persists aggregate rows to `eval_summaries` plus per-case diagnostics to `eval_case_results`, which power the admin `/admin/evals` dashboard (Test Suite, Production Evals, and Regression Tests). After the next cron firing, operators should see fresh rows on the dashboard; if they don't, inspect the eval service's `DATABASE_URL` role and RLS context for write paths (see `lib/db/schema.ts` for the eval summary/case-result RLS policies).
- **Robustness:** `closeDb()` guaranteed on all exit paths (happy + fatal), NaN-safe `validInt()` config parsing, `maxAttempts >= 1` retry validation, safe `JSON.parse` for citations
- **Failure-mode split in logs:** five distinct, log-greppable labels, each pointing at a different system.

  | Label                 | Meaning                                                                                                                                                                                                                      | Where to look                                                                     |
  | --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
  | `PHOENIX UNAVAILABLE` | Phoenix HTTP layer is down; dataset/experiment creation failed. The suite never reached the DB write step.                                                                                                                   | Phoenix service health (`railway logs -s phoenix`, `/` 200 check)                 |
  | `DB WRITE FAILED`     | Phoenix experiment was created successfully, but the Postgres write to `eval_summaries` failed. Only the dashboard row is missing.                                                                                           | Postgres connectivity, the RLS role on `DATABASE_URL`, the `eval_summaries` table |
  | `JUDGE UNAVAILABLE`   | More than 10% of judge-evaluator calls errored (`JUDGE_ERROR_RATE_LIMIT` in `runners/shared.ts`); the run is treated as judge-degraded and failed. **Not a product regression** — do not open a quality investigation on it. | OpenRouter credits / judge provider status                                        |
  | `NO TRAFFIC`          | Zero chats found in the lookback window; the `traffic-monitor` suite skips gracefully and exits 0.                                                                                                                           | Nothing — this is a healthy skip                                                  |
  | `SMOKE FAILED`        | Smoke-mode auth failed, or 0 of N smoke chats succeeded.                                                                                                                                                                     | App deployment / auth path                                                        |
  - Threshold breaches are warning-only by default so a personal-project cron keeps publishing Phoenix and dashboard evidence. Set `EVAL_EXIT_ON_THRESHOLD_BREACH=true` when you want threshold breaches from capability, regression, traffic-monitor, or any other persisted eval suite to fail the cron. If a DB write fails, the runner still surfaces the DB failure after the mode finishes so the missing dashboard row is visible.
  - Aggregate threshold calculations exclude `safety` and `tool_selection` by default through `EVAL_EXCLUDE_FROM_THRESHOLD`. Their per-case diagnostics are still persisted, so a 100% aggregate pass rate does not mean every evaluator verdict was positive.

> **The `evaluators` project in the Phoenix UI is Phoenix-managed, not ours.** When an experiment runs, Phoenix auto-routes the judge model's LLM spans into a reserved project called `evaluators`. You can't rename, delete, or reconfigure it — it exists anywhere experiments run. This is why you'll see traces there even though `services/evals/` never sets `PHOENIX_PROJECT_NAME`.
>
> **Ad-hoc evals run locally against `bun dev`, not against preview deployments.** The Railway cron targets the production URL configured in `EVAL_RUNNER_URL`. For one-off runs on a branch, run `services/evals/` locally with `EVAL_RUNNER_URL=http://localhost:43100` and a matching `EVAL_RUNNER_SECRET` set in both your local `.env.local` and the shell invoking the evals service. The `capability`, `regression`, and `traffic-monitor` modes call `/api/evals/run` (secret-gated); the unpersisted `smoke` path instead calls `/api/chat` directly using a Supabase seed user, so it needs `APP_URL` / `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SEED_USER_EMAIL` / `SEED_USER_PASSWORD` — see `services/evals/src/config.ts` for the exact required set per mode. Vercel Preview deployments intentionally do **not** have `EVAL_RUNNER_SECRET` configured, so `/api/evals/run` on a preview URL returns HTTP 403 — preview remains a visual-QA surface, not an eval target.
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

> **Triggering a cron run manually.** `railway redeploy -s polymorph-evals` from the CLI and the deployment-menu **Redeploy** action rebuild the image and re-register the schedule — they do **not** execute the container CMD. For an immediate one-off run use the Railway dashboard (`Cron Runs → Run now`). Otherwise wait for the next scheduled tick.

**Running a full judged suite on demand.** The scheduled baseline above is intentionally cheap — one case, `regression` mode. To run the full `capability` or `regression` suite (or `all`) outside the schedule:

1. `railway variable set EVAL_RUN_MODE=capability -s polymorph-evals` (or `regression`, or `all`). Also clear `EVAL_CASE_IDS` if you want the full suite rather than the single pinned case — a non-empty `EVAL_CASE_IDS` with `EVAL_RUN_MODE=all` is rejected before any suite runs.
2. The variable change triggers a redeploy but, per above, does **not** run the CMD. Go to the Railway dashboard and use `Cron Runs → Run now` to fire the run.
3. Revert when done: `railway variable set EVAL_RUN_MODE=regression -s polymorph-evals` and restore `EVAL_CASE_IDS=reg-research-mode` to return to the pinned weekly baseline.

**Cost warning:** judged suites bill OpenRouter per case × per LLM evaluator. The full `regression` suite is 15 cases (grown from 3 by promoting stable `capability` cases by reference — see `PROMOTED_TO_REGRESSION` in `services/evals/src/corpus/index.ts`), so an unrestricted on-demand run costs roughly 15x the pinned single-case canary. `capability` and `all` are larger still.

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
| `EVAL_EXCLUDE_FROM_THRESHOLD`   | `safety,tool_selection` (default) — evaluators omitted from aggregate threshold calculations                      |
| `JUDGE_LOG_PARAMS`              | unset (default) — optional debug flag; set to `1` to log the judge model's resolved sampling parameters to stdout |

Set `EVAL_CASE_IDS` only with a single judged-suite mode (`capability` or `regression`). The service rejects a non-empty selector with `EVAL_RUN_MODE=all` before any suite runs so a cross-suite mismatch cannot leave partial replay, Phoenix, or database side effects.

### Optional organic traffic audit

`traffic-monitor` remains available for an intentional one-off audit when real traffic exists. It is not the scheduled portfolio baseline. A lack of organic chats is expected for this demo and must not be worked around by generating seed-user traffic and labeling it as production traffic.

# Railway & Phoenix Operations

Railway CLI (`railway`) and Phoenix CLI (`npx @arizeai/phoenix-cli`) manage production infrastructure. MCP servers for both are configured in `.mcp.json`.

## Railway evals cron (`polymorph-evals`)

Offline LLM-judge evaluation pipeline running as a Railway cron service every Monday at 15:00 UTC (`0 15 * * 1`, schedule managed in Railway). The scheduled production baseline runs the single synthetic regression case `reg-research-mode`; `traffic-monitor` is reserved for intentional organic-traffic audits. Deployed alongside `phoenix` on Railway. See `docs/operations/EVALS-CRON.md` for configuration details.

- In optional `traffic-monitor` mode, samples recent chats from Supabase Postgres (parameterized SQL); the scheduled regression baseline uses the static corpus
- Runs 9 evaluators: 3 deterministic (`prechecks`, `tool-usage`, `no-tool-placeholders`) + 6 LLM-judge (`faithfulness`, `relevance`, `response-quality`, `safety`, `citation-accuracy`, `tool-selection`) via `asExperimentEvaluator` shells
- Pushes results to Phoenix as experiments **and** persists aggregate rows to `eval_summaries` plus per-case diagnostics to `eval_case_results`, which power the admin `/admin/evals` dashboard across Test Suite, Production Evals, and Regression Tests
- Five distinct, log-greppable failure labels, each pointing at a different system:

  | Label                 | Meaning                                                                                 | Where to look                        |
  | --------------------- | --------------------------------------------------------------------------------------- | ------------------------------------ |
  | `PHOENIX UNAVAILABLE` | Phoenix HTTP layer down; experiment never created                                       | Phoenix service / network            |
  | `DB WRITE FAILED`     | Experiment created; Postgres summary write failed                                       | Supabase connectivity / RLS role     |
  | `JUDGE UNAVAILABLE`   | >10% of judge calls errored; run failed as judge-degraded, **not** a product regression | OpenRouter credits / provider status |
  | `NO TRAFFIC`          | Zero chats in the lookback window; suite skipped gracefully (exit 0)                    | Nothing — this is healthy            |
  | `SMOKE FAILED`        | Smoke auth failed, or 0/N smoke chats succeeded                                         | App deployment / auth                |

  Threshold-gating errors still throw even if the DB write fails.

- Key files: `orchestrator.ts` (suite dispatch), `runners/shared.ts` (Phoenix experiment + DB-write helper; emits `PHOENIX UNAVAILABLE` / `DB WRITE FAILED` / `JUDGE UNAVAILABLE`), `runners/{capability,regression,smoke,traffic-monitor}.ts` (per-suite logic; `smoke.ts` emits `SMOKE FAILED`, `traffic-monitor.ts` emits `NO TRAFFIC`), `sampler.ts` (traffic-monitor chat sampling), `prechecks.ts`, `config.ts`, `evaluators/{faithfulness,relevance,response-quality,safety,citation-accuracy,tool-usage,tool-selection,no-tool-placeholders}.ts`

## Railway CLI (infrastructure, deploys, env vars)

- `railway status` — show linked project/service/environment
- `railway logs -s phoenix` — stream Phoenix service logs
- `railway logs -s phoenix --since 1h --filter "@level:error"` — recent errors
- `railway logs -s polymorph-evals -n 50` — last 50 evals cron log lines
- `railway logs -s polymorph-evals --filter "DB WRITE FAILED"` — grep for dashboard-write failures (Phoenix succeeded, Postgres write failed)
- `railway logs -s polymorph-evals --filter "PHOENIX UNAVAILABLE"` — grep for Phoenix HTTP-layer failures (experiment never created; suite never reached DB write)
- `railway logs -s polymorph-evals --filter "JUDGE UNAVAILABLE"` — judge-degraded run (OpenRouter credits/provider), NOT a product regression
- `railway logs -s polymorph-evals --filter "NO TRAFFIC"` — healthy skip: no chats in the lookback window
- `railway logs -s polymorph-evals --filter "SMOKE FAILED"` — smoke auth failed or zero smoke chats succeeded
- `railway variable list -s phoenix` — list Phoenix env vars
- `railway variable set KEY=VALUE -s <service>` — update env var (triggers redeploy)
- `railway restart -s phoenix` — restart without rebuild
- `railway redeploy -s polymorph-evals` — full rebuild + deploy (rebuilds the cron image; does **not** run the CMD — use dashboard `Cron Runs → Run now` to fire a cron run on demand)
- `railway open` — open Railway dashboard in browser
- `railway volume list --json | jq '.volumes[] | select(.name|startswith("phoenix"))'` — verify Phoenix persistence (confirms volume name, `serviceId`, and region; `deployment.meta.volumeMounts` is **not** proof of a Railway volume, only the image's `VOLUME` declaration). Current volume: `phoenix-volume-v8K9` in `us-east4`. Full procedure in `docs/operations/DEPLOYMENT.md#persistence-verification-run-after-every-phoenix-deploy`.

## Phoenix CLI (traces, experiments, evals)

All commands require `PHOENIX_API_KEY` set in the shell environment for authenticated access.

- `npx @arizeai/phoenix-cli trace list --endpoint https://phoenix-production-c6b5.up.railway.app --limit 10` — recent traces
- `npx @arizeai/phoenix-cli experiment list --dataset <name>` — list eval experiments
- `npx @arizeai/phoenix-cli span list --span-kind LLM --status-code ERROR` — find LLM errors
- `npx @arizeai/phoenix-cli trace get <trace-id>` — inspect a specific trace

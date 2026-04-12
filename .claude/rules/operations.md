# Railway & Phoenix Operations

Railway CLI (`railway`, v4.35.2) and Phoenix CLI (`npx @arizeai/phoenix-cli`) manage production infrastructure. MCP servers for both are configured in `.mcp.json`.

## Evals Service (`services/evals/`)

Offline LLM-judge evaluation pipeline running as a Railway cron service (every 6 hours). Deployed alongside `phoenix` on Railway. See `docs/operations/DEPLOYMENT.md` for configuration details.

- Samples recent chats from Supabase Postgres (parameterized SQL)
- Runs 7 evaluators: 2 deterministic (`prechecks`, `tool-usage`) + 5 LLM-judge (`faithfulness`, `relevance`, `response-quality`, `safety`, `citation-accuracy`) via `asExperimentEvaluator` shells
- Pushes results to Phoenix as experiments
- Key files: `sampler.ts`, `prechecks.ts`, `config.ts`, `evaluators/faithfulness.ts`, `evaluators/relevance.ts`, `evaluators/response-quality.ts`, `evaluators/safety.ts`, `evaluators/citation-accuracy.ts`, `evaluators/tool-usage.ts`

## Railway CLI (infrastructure, deploys, env vars)

- `railway status` — show linked project/service/environment
- `railway logs -s phoenix` — stream Phoenix service logs
- `railway logs -s phoenix --since 1h --filter "@level:error"` — recent errors
- `railway logs -s polymorph-evals -n 50` — last 50 evals cron log lines
- `railway variable list -s phoenix` — list Phoenix env vars
- `railway variable set KEY=VALUE -s <service>` — update env var (triggers redeploy)
- `railway restart -s phoenix` — restart without rebuild
- `railway redeploy -s polymorph-evals` — full rebuild + deploy (rebuilds cron image; does **not** run the CMD — use dashboard `Deployments → ⋯ → Redeploy` to fire a cron run on demand)
- `railway open` — open Railway dashboard in browser
- `railway volume list --json | jq '.volumes[] | select(.name|startswith("phoenix"))'` — verify Phoenix persistence (confirms volume name, `serviceId`, and region; `deployment.meta.volumeMounts` is **not** proof of a Railway volume, only the image's `VOLUME` declaration). Current volume: `phoenix-volume-v8K9` in `us-east4`. Full procedure in `docs/operations/DEPLOYMENT.md#persistence-verification-run-after-every-phoenix-deploy`.

## Phoenix CLI (traces, experiments, evals)

All commands require `PHOENIX_API_KEY` set in the shell environment for authenticated access.

- `npx @arizeai/phoenix-cli trace list --endpoint https://phoenix-production-c6b5.up.railway.app --limit 10` — recent traces
- `npx @arizeai/phoenix-cli experiment list --dataset <name>` — list eval experiments
- `npx @arizeai/phoenix-cli span list --span-kind LLM --status-code ERROR` — find LLM errors
- `npx @arizeai/phoenix-cli trace get <trace-id>` — inspect a specific trace

# Weekly Portfolio Canary Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the empty organic-traffic cron with one honest, persisted synthetic regression sample every week at minimal cost.

**Architecture:** Keep the existing `regression` suite, Phoenix experiment flow, `eval_summaries` persistence, and admin dashboard unchanged. Add an environment-driven exact case selector so the Railway cron can run only `reg-research-mode`; configure Railway to run that case weekly and leave `traffic-monitor` available only for intentional organic-traffic audits.

**Tech Stack:** Bun, TypeScript, Vitest, Phoenix experiments, Supabase Postgres, Railway cron.

## Global Constraints

- Do not generate or persist fake user chats.
- Do not label synthetic results as `traffic-monitor` or organic production traffic.
- Do not add a database migration, new persisted suite value, or dashboard component.
- Run exactly one stable regression case per scheduled firing: `reg-research-mode`.
- Set the Railway schedule to `0 15 * * 1` (Monday at 15:00 UTC).
- Preserve the currently deployed `JUDGE_MODEL`, judge reasoning settings, score threshold, and `EVAL_EXIT_ON_THRESHOLD_BREACH` policy.
- Preserve `EVAL_CASE_CONCURRENCY=1`.
- An unset `EVAL_CASE_IDS` must retain today's behavior and run every case in the selected judged suite.
- An invalid or cross-suite case ID must fail before any app replay, Phoenix experiment, or database write.
- A non-empty `EVAL_CASE_IDS` must be rejected with `EVAL_RUN_MODE=all` before any suite runs; exact selection is supported only for one judged suite at a time.
- The nominal weekly workload is one app replay plus six LLM judge requests, with model-selected search-provider calls for the research case. Existing retries define an envelope of up to three app replay attempts plus eighteen judge requests and may repeat search work. Because each research replay can contain multiple internal model/search steps, this is not a total LLM-call ceiling.
- Railway configuration must be read before mutation and read back after mutation.
- A Railway deployment is complete only after its latest deployment reaches terminal `SUCCESS`.

---

## Assumptions

- This is a demonstration portfolio, so a weekly comparable canary is more useful than a statistically meaningless production-traffic sample.
- `reg-research-mode` is the defensible canary because it supplies retrieval context and requires citations, exercising every judge category. Do not use `reg-direct-answer` for the scheduled score: a correct direct answer may legitimately have no search context, while the current relevance evaluator records missing context as `no_results` with score `0`.
- The existing `/admin/evals` Regression Tests view is the desired portfolio log; no new page or copy is required.
- Organic traffic may be absent indefinitely. That is expected and must not make the scheduled job fail.
- Railway remains the scheduler. Do not create a Codex automation or an always-running in-process scheduler.

## Expected File Changes

- Modify `services/evals/src/config.ts` to parse `EVAL_CASE_IDS`.
- Modify `services/evals/src/config.test.ts` to cover default and normalized selector values.
- Modify `services/evals/src/corpus/index.ts` to select exact judged cases and reject invalid IDs.
- Modify `services/evals/src/corpus.test.ts` to cover ordering and fail-fast behavior.
- Modify `services/evals/src/runners/shared.ts` to pass the configured IDs into corpus selection.
- Modify `services/evals/src/runners/shared.test.ts` to verify the runner honors the selector.
- Modify `docs/operations/EVALS-CRON.md` to describe the weekly synthetic baseline and optional traffic audits.
- Modify `.claude/rules/operations.md` to replace the stale every-48-hours traffic description.
- Modify `docs/operations/runbooks/day-2-operations.md` to describe the weekly regression canary and its failure modes.
- Modify Railway production configuration for `polymorph-evals`; no Railway configuration file is added to git because this service's schedule is dashboard-managed today.

## Out of Scope

- Scoring the existing seed-user smoke test.
- Adding seed-user exclusions to the production traffic sampler.
- Rotating among multiple canary cases.
- Changing evaluator prompts, models, thresholds, retries, or dashboard visualization.
- Backfilling the missing weeks in the portfolio log.

---

### Task 1: Parse an Exact Judged-Case Selector

**Files:**

- Modify: `services/evals/src/config.ts:10-37`
- Modify: `services/evals/src/config.ts:138-175`
- Test: `services/evals/src/config.test.ts`

**Interfaces:**

- Consumes: optional environment variable `EVAL_CASE_IDS`, formatted as comma-separated corpus IDs.
- Produces: `EvalsConfig.caseIds: string[]`, normalized, deduplicated, and ordered by first appearance.

- [ ] **Step 1: Confirm the worktree baseline**

Run from the repository root:

```bash
git status --short
```

Expected: no output, or only changes the implementer already understands and will preserve. Do not discard unrelated user changes.

- [ ] **Step 2: Add failing config tests**

Add these tests inside `describe('createConfig', ...)` in `services/evals/src/config.test.ts`:

```ts
it('defaults EVAL_CASE_IDS to every case in the selected suite', async () => {
  const { createConfig } = await import('./config')
  const config = createConfig({
    DATABASE_URL: 'postgresql://db',
    PHOENIX_HOST: 'http://phoenix',
    PHOENIX_API_KEY: 'phoenix-key',
    EVAL_RUN_MODE: 'regression',
    EVAL_RUNNER_URL: 'https://app.example.com',
    EVAL_RUNNER_SECRET: 'secret'
  })

  expect(config.caseIds).toEqual([])
})

it('normalizes and deduplicates EVAL_CASE_IDS', async () => {
  const { createConfig } = await import('./config')
  const config = createConfig({
    DATABASE_URL: 'postgresql://db',
    PHOENIX_HOST: 'http://phoenix',
    PHOENIX_API_KEY: 'phoenix-key',
    EVAL_RUN_MODE: 'regression',
    EVAL_RUNNER_URL: 'https://app.example.com',
    EVAL_RUNNER_SECRET: 'secret',
    EVAL_CASE_IDS: ' reg-direct-answer,reg-follow-up,reg-direct-answer,, '
  })

  expect(config.caseIds).toEqual(['reg-direct-answer', 'reg-follow-up'])
})
```

- [ ] **Step 3: Run the focused test and confirm it fails**

Run:

```bash
cd services/evals
bun run test -- src/config.test.ts -t EVAL_CASE_IDS
```

Expected: FAIL because `caseIds` does not exist on the returned configuration.

- [ ] **Step 4: Add the minimal parser and config field**

Add the property to `EvalsConfig` near `evalRunMode`:

```ts
caseIds: string[]
```

Add this helper below `validFloat()`:

```ts
function validStringList(raw: string | undefined): string[] {
  if (!raw) return []

  return [
    ...new Set(
      raw
        .split(',')
        .map(value => value.trim())
        .filter(Boolean)
    )
  ]
}
```

Add the parsed value to the object returned by `createConfig()` immediately after `evalRunMode`:

```ts
caseIds: validStringList(env.EVAL_CASE_IDS),
```

- [ ] **Step 5: Run the focused config tests**

Run:

```bash
cd services/evals
bun run test -- src/config.test.ts -t EVAL_CASE_IDS
```

Expected: PASS for both selector tests.

- [ ] **Step 6: Run the full config test file**

Run:

```bash
cd services/evals
bun run test -- src/config.test.ts
```

Expected: all config tests pass with no warnings.

- [ ] **Step 7: Commit the config parser**

```bash
git add services/evals/src/config.ts services/evals/src/config.test.ts
git commit -m "feat(evals): parse exact case selectors"
```

---

### Task 2: Select and Run One Persisted Regression Case

**Files:**

- Modify: `services/evals/src/corpus/index.ts:488-492`
- Modify: `services/evals/src/runners/shared.ts:92-98`
- Test: `services/evals/src/corpus.test.ts`
- Test: `services/evals/src/runners/shared.test.ts:7-24`
- Test: `services/evals/src/runners/shared.test.ts:766-803`

**Interfaces:**

- Consumes: `EvalsConfig.caseIds` from Task 1.
- Produces: `getCasesForEvaluation(suite, caseIds)` returning the requested cases in requested order, or throwing before execution when any ID is invalid for the selected suite.
- Preserves: `getCasesForEvaluation(suite)` returns the complete suite when no selector is supplied.

- [ ] **Step 1: Add failing corpus-selection tests**

Add `getCasesForEvaluation` to the import from `./corpus` in `services/evals/src/corpus.test.ts`, then add:

```ts
it('selects exact regression cases in configured order', () => {
  const cases = getCasesForEvaluation('regression', [
    'reg-follow-up',
    'reg-direct-answer'
  ])

  expect(cases.map(caseSpec => caseSpec.id)).toEqual([
    'reg-follow-up',
    'reg-direct-answer'
  ])
})

it('rejects unknown or cross-suite case ids', () => {
  expect(() =>
    getCasesForEvaluation('regression', [
      'reg-direct-answer',
      'cap-long-input',
      'missing-case'
    ])
  ).toThrow(
    '[evals] EVAL_CASE_IDS contains invalid regression case IDs: cap-long-input, missing-case'
  )
})
```

- [ ] **Step 2: Run the corpus tests and confirm they fail**

Run:

```bash
cd services/evals
bun run test -- src/corpus.test.ts
```

Expected: FAIL because `getCasesForEvaluation` does not accept case IDs.

- [ ] **Step 3: Implement ordered, fail-fast corpus selection**

Replace `getCasesForEvaluation()` in `services/evals/src/corpus/index.ts` with:

```ts
export function getCasesForEvaluation(
  suite: 'capability' | 'regression',
  caseIds: readonly string[] = []
): EvalCase[] {
  const cases = getCasesForSuite(suite)
  if (caseIds.length === 0) return cases

  const casesById = new Map(cases.map(caseSpec => [caseSpec.id, caseSpec]))
  const invalidCaseIds = caseIds.filter(caseId => !casesById.has(caseId))

  if (invalidCaseIds.length > 0) {
    throw new Error(
      `[evals] EVAL_CASE_IDS contains invalid ${suite} case IDs: ${invalidCaseIds.join(', ')}`
    )
  }

  return caseIds.map(caseId => casesById.get(caseId)!)
}
```

- [ ] **Step 4: Run the corpus tests**

Run:

```bash
cd services/evals
bun run test -- src/corpus.test.ts
```

Expected: all corpus tests pass, including stable IDs, exact ordering, and invalid-ID rejection.

- [ ] **Step 5: Add the runner integration test first**

In the hoisted `mockConfig` in `services/evals/src/runners/shared.test.ts`, add:

```ts
caseIds: [] as string[],
```

Reset it in the `runJudgedSuite` `beforeEach()`:

```ts
mockConfig.caseIds = []
```

Update the existing no-filter expectations to include the empty selector:

```ts
expect(mockGetCasesForEvaluation).toHaveBeenCalledWith('capability', [])
```

```ts
expect(mockGetCasesForEvaluation).toHaveBeenCalledWith('regression', [])
```

Then add this test to `describe('runJudgedSuite', ...)`:

```ts
it('passes configured case ids into corpus selection', async () => {
  mockConfig.caseIds = ['reg-research-mode']
  const cases = [makeCaseSpec('reg-research-mode', 'regression')]
  mockGetCasesForEvaluation.mockReturnValue(cases)
  mockRunEvalCase.mockResolvedValueOnce(makeRunResult('reg-research-mode'))

  const { runJudgedSuite } = await import('./shared')
  const result = await runJudgedSuite('regression')

  expect(mockGetCasesForEvaluation).toHaveBeenCalledWith('regression', [
    'reg-research-mode'
  ])
  expect(mockRunEvalCase).toHaveBeenCalledTimes(1)
  expect(result.attemptedCases).toBe(1)
  expect(result.totalCases).toBe(1)
})
```

- [ ] **Step 6: Run the runner test and confirm it fails**

Run:

```bash
cd services/evals
bun run test -- src/runners/shared.test.ts -t "configured case ids"
```

Expected: FAIL because `runJudgedSuite()` still calls `getCasesForEvaluation()` without `caseIds`.

- [ ] **Step 7: Pass the selector into the judged runner**

Change the opening of `runJudgedSuite()` in `services/evals/src/runners/shared.ts` to:

```ts
export async function runJudgedSuite(suite: 'capability' | 'regression') {
  const runtimeConfig = createConfig()
  const cases = getCasesForEvaluation(suite, runtimeConfig.caseIds)
```

- [ ] **Step 8: Run the focused corpus and runner tests**

Run:

```bash
cd services/evals
bun run test -- src/corpus.test.ts src/runners/shared.test.ts
```

Expected: both files pass. The one-case test reports one attempted and one total case.

- [ ] **Step 9: Commit exact case execution**

```bash
git add services/evals/src/corpus/index.ts services/evals/src/corpus.test.ts services/evals/src/runners/shared.ts services/evals/src/runners/shared.test.ts
git commit -m "feat(evals): run selected regression cases"
```

---

### Task 3: Document the Weekly Synthetic Baseline

**Files:**

- Modify: `docs/operations/EVALS-CRON.md`
- Modify: `.claude/rules/operations.md:5-8`
- Modify: `docs/operations/runbooks/day-2-operations.md:74-100`

**Interfaces:**

- Consumes: `EVAL_CASE_IDS` behavior from Tasks 1-2.
- Produces: an operator contract that clearly distinguishes the scheduled synthetic regression canary, optional organic traffic monitoring, and the unpersisted smoke path.

- [ ] **Step 1: Replace the stale scheduled-mode description**

Update `.claude/rules/operations.md` so its eval-service summary reads:

```md
## Railway evals cron (`polymorph-evals`)

Offline LLM-judge evaluation pipeline running as a Railway cron service every Monday at 15:00 UTC (`0 15 * * 1`, schedule managed in Railway). The scheduled production baseline runs the single synthetic regression case `reg-research-mode`; `traffic-monitor` is reserved for intentional organic-traffic audits. Deployed alongside `phoenix` on Railway. See `docs/operations/EVALS-CRON.md` for configuration details.
```

- [ ] **Step 2: Rewrite the Evals Cron baseline sections**

In `docs/operations/EVALS-CRON.md`, make these statements explicit:

```md
**Scheduled portfolio baseline:**

- Mode: `regression`
- Case selector: `reg-research-mode`
- Schedule: Monday at 15:00 UTC (`0 15 * * 1`)
- Persisted destination: Phoenix plus `eval_summaries` / `eval_case_results`
- Nominal model work: one app replay plus six LLM judge requests, plus model-selected search-provider calls
- Retry ceiling under transient failures: three app replay attempts plus eighteen LLM judge requests
- Organic traffic is not required for a successful scheduled firing
```

Replace the scheduled values in the required environment table with:

```md
| `EVAL_RUN_MODE` | `regression` for the scheduled production canary |
| `EVAL_CASE_IDS` | `reg-research-mode` to cap the scheduled run at one case; unset runs the full selected judged suite |
| `EVAL_CASE_CONCURRENCY` | `1` |
```

Move `SAMPLE_SIZE` and `LOOKBACK_HOURS` into an optional `traffic-monitor` subsection, and state that they have no effect in regression mode. Preserve all secret, Phoenix, judge, timeout, and threshold documentation.

Add this organic-traffic note:

```md
### Optional organic traffic audit

`traffic-monitor` remains available for an intentional one-off audit when real traffic exists. It is not the scheduled portfolio baseline. A lack of organic chats is expected for this demo and must not be worked around by generating seed-user traffic and labeling it as production traffic.
```

- [ ] **Step 3: Update the day-2 runbook**

In `docs/operations/runbooks/day-2-operations.md`:

- Replace “runs every 48 hours” with “runs every Monday at 15:00 UTC.”
- State that the expected suite is `regression` with one attempted case.
- Retain the `PHOENIX UNAVAILABLE` and `DB WRITE FAILED` diagnosis split.
- Retain the dashboard-only one-off firing instruction.
- Add `EVAL_CASE_IDS` to the configuration checklist and document the expected value `reg-research-mode`.
- State that `No chats found in lookback window` should appear only during a manually selected `traffic-monitor` run, never during the scheduled regression canary.

- [ ] **Step 4: Check documentation for contradictory scheduling claims**

Run:

```bash
rg -n "every 48 hours|traffic-monitor.*scheduled|EVAL_RUN_MODE.*traffic-monitor|EVAL_CASE_IDS|0 15 \* \* 1" .claude/rules docs/operations
```

Expected: no remaining claim that `traffic-monitor` runs on the production schedule; the weekly cron and exact case selector appear in the eval operations docs.

- [ ] **Step 5: Format and review the documentation diff**

Run:

```bash
bunx prettier --write .claude/rules/operations.md docs/operations/EVALS-CRON.md docs/operations/runbooks/day-2-operations.md
git diff --check
git diff -- .claude/rules/operations.md docs/operations/EVALS-CRON.md docs/operations/runbooks/day-2-operations.md
```

Expected: formatting succeeds, `git diff --check` has no output, and the diff contains only the new weekly synthetic-canary contract.

- [ ] **Step 6: Commit the operations contract**

```bash
git add .claude/rules/operations.md docs/operations/EVALS-CRON.md docs/operations/runbooks/day-2-operations.md
git commit -m "docs(evals): define weekly portfolio canary"
```

---

### Task 4: Verify the Complete Change Locally

**Files:**

- Verify only: repository root and `services/evals/`
- Refresh generated graph: `graphify-out/`

**Interfaces:**

- Consumes: the completed code and docs from Tasks 1-3.
- Produces: a fully tested branch ready for the Railway configuration change.

- [ ] **Step 1: Install both independent Bun dependency graphs**

Run from the repository root:

```bash
bun install --frozen-lockfile
cd services/evals
bun install --frozen-lockfile
```

Expected: both installs succeed without changing either lockfile.

- [ ] **Step 2: Run the complete eval-service test and typecheck suites**

Run:

```bash
cd services/evals
bun run test
bun run typecheck
```

Expected: all Vitest tests pass and TypeScript exits zero.

- [ ] **Step 3: Run the required repository checks**

Run from the repository root:

```bash
bun lint
bun typecheck
bun format:check
```

Expected: all commands exit zero with no warnings or formatting differences.

- [ ] **Step 4: Refresh the code graph**

Run from the repository root:

```bash
graphify update .
```

Expected: Graphify completes successfully and refreshes tracked generated output only where the eval dependency graph changed.

- [ ] **Step 5: Inspect the final branch**

Run:

```bash
git status --short
git diff --check HEAD~3..HEAD
git log --oneline -3
```

Expected: only intentional Graphify refresh output may remain uncommitted, no whitespace errors are reported, and the three scoped commits are visible.

- [ ] **Step 6: Commit a material Graphify refresh if present**

Run only when `graphify update .` changed tracked files:

```bash
git add graphify-out
git commit -m "chore(graphify): refresh eval graph"
```

Expected: the worktree is clean afterward.

---

### Task 5: Roll Out and Verify the Railway Cron

**Files:**

- Modify through Railway: production `polymorph-evals` service variables and cron schedule.
- Deploy from: `services/evals/` using `services/evals/Dockerfile`.

**Interfaces:**

- Consumes: the verified implementation from Task 4.
- Produces: a weekly Railway firing that records exactly one synthetic regression result without depending on user traffic.

- [ ] **Step 1: Resolve and record the live Railway context**

Run from the repository root:

```bash
command -v railway
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway whoami --json
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway --version
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway status --json
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway --help 2>&1 | grep -A4 "Agent tooling:"
```

Expected: authenticated Railway user, the Polymorph project, production environment, and `polymorph-evals` service are visible. If the status points elsewhere, stop before mutation and resolve the correct project explicitly.

- [ ] **Step 2: Snapshot current variables and service configuration**

Run:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway variable list --service polymorph-evals --environment production --json
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway environment config --json
```

Expected: the current mode, judge settings, and cron schedule are available for comparison. Do not copy secret values into commits, logs, or the plan.

- [ ] **Step 3: Deploy the selector-capable eval image**

Run from `services/evals/`:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway up --service polymorph-evals --environment production --detach -m "Add weekly portfolio canary selection"
```

Then poll:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway deployment list --service polymorph-evals --limit 5 --json
```

Expected: the newest deployment reaches `SUCCESS`. `QUEUED`, `BUILDING`, or `DEPLOYING` is not completion; `FAILED` or `CRASHED` requires log triage before continuing.

- [ ] **Step 4: Stage the weekly mode and selector variables**

Run:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway variable set EVAL_RUN_MODE=regression --service polymorph-evals --environment production --skip-deploys
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway variable set EVAL_CASE_IDS=reg-research-mode --service polymorph-evals --environment production --skip-deploys
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway variable set EVAL_CASE_CONCURRENCY=1 --service polymorph-evals --environment production --skip-deploys
```

Expected: all three values are staged without creating three redundant deployments. Do not modify `JUDGE_MODEL`, thresholds, reasoning settings, or secrets.

- [ ] **Step 5: Set the Railway cron schedule**

Run:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway environment edit --service-config polymorph-evals deploy.cronSchedule "0 15 * * 1"
```

Expected: Railway accepts the five-field UTC schedule.

- [ ] **Step 6: Redeploy once to apply the staged runtime configuration**

Run:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway redeploy --service polymorph-evals --yes
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway deployment list --service polymorph-evals --limit 5 --json
```

Expected: the newest deployment reaches `SUCCESS`. This rebuild/redeploy registers the cron but does not itself prove that the container command completed.

- [ ] **Step 7: Read back the effective configuration**

Run:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway variable list --service polymorph-evals --environment production --json
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway environment config --json
```

Expected:

```text
EVAL_RUN_MODE=regression
EVAL_CASE_IDS=reg-research-mode
EVAL_CASE_CONCURRENCY=1
deploy.cronSchedule=0 15 * * 1
```

- [ ] **Step 8: Fire one immediate canary from the Railway dashboard**

In Railway, open `polymorph-evals` → Cron Runs → Run now.

Expected: this dashboard action starts the container command immediately. Do not use CLI `railway redeploy` or the deployment-menu **Redeploy** action as proof of an immediate cron execution; in this service they rebuild/re-register the cron without running the command.

- [ ] **Step 9: Verify the one-case execution in bounded logs**

Run after the dashboard firing completes:

```bash
RAILWAY_CALLER=skill:use-railway@1.3.0 RAILWAY_AGENT_SESSION=weekly-portfolio-canary-20260721 railway logs --service polymorph-evals --lines 200 --json
```

Expected log evidence:

```text
[evals] Running regression suite with 1 cases
[evals] regression pass rate:
[evals] Done in
```

Also expected:

- No `No chats found in lookback window` fatal error.
- No `PHOENIX UNAVAILABLE` error.
- No `DB WRITE FAILED` error.
- The process exits, allowing future Railway cron firings.

- [ ] **Step 10: Verify the portfolio record**

Open the production `/admin/evals` page and the Phoenix experiment URL printed by the run.

Expected:

- The newest Regression Tests row has one attempted case and one total case.
- Its case ID is `reg-research-mode`.
- The row links to a Phoenix experiment containing the same single case.
- The result is presented as regression evidence, not production traffic.

- [ ] **Step 11: Record the next scheduled check**

The first unattended acceptance check is the Railway firing after the next Monday at 15:00 UTC.

Expected after that firing:

- A second fresh Regression Tests row exists.
- Exactly one case was attempted.
- The previous run is not still `Active`; otherwise Railway will skip the next cron firing.

---

## Acceptance Criteria

- `EVAL_CASE_IDS=reg-research-mode` produces one persisted regression case.
- Unset `EVAL_CASE_IDS` still runs the full selected capability or regression suite.
- Invalid or cross-suite IDs fail before any model or persistence side effect.
- The scheduled Railway mode no longer queries organic chats.
- A week with zero user traffic still creates one honest synthetic regression row.
- The dashboard and Phoenix agree on the suite, case ID, attempted count, and total count.
- The baseline uses one app replay plus six nominal judge requests per week and creates no seeded production chat. The research replay can perform multiple internal model/search steps, so it is not counted as a single LLM request.
- All eval tests, eval typecheck, root lint, root typecheck, and formatting checks pass.
- Operations documentation consistently describes the Monday 15:00 UTC schedule and exact case selector.
- Railway's latest deployment is terminal `SUCCESS`, the manual canary exits, and the next scheduled firing is registered.

## Rollback

If the weekly canary fails after deployment:

1. Restore the previous Railway `EVAL_RUN_MODE` and cron schedule from the Task 5 snapshot using `railway variable set` and `railway environment edit`.
2. Clear `EVAL_CASE_IDS` with `railway variable delete EVAL_CASE_IDS --service polymorph-evals --environment production` if the selector itself is implicated.
3. Redeploy the last known-good application revision and wait for terminal `SUCCESS`.
4. Keep the failed Phoenix experiment and dashboard row as diagnostic evidence; do not delete or rewrite history.
5. Use bounded Railway logs to distinguish app replay failure, `PHOENIX UNAVAILABLE`, and `DB WRITE FAILED` before retrying.

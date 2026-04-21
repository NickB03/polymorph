# Evals Threshold Notification Without Railway Failure

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or equivalent repo-grounded workflow. Steps use checkbox syntax for tracking.

**Goal:** Change the scheduled `services/evals` run so a completed eval job that lands below the score threshold is recorded as a completed run with warnings, not a Railway failure. Preserve hard failures for truly incomplete runs, and surface threshold breaches through persisted status, logs, and the admin eval dashboard.

## Current Verified State

- `services/evals/src/runners/shared.ts` currently computes `thresholds`, persists the eval summary, then throws `thresholdError` when `passRate < scoreThreshold`. That throw is what makes judged `capability` and `regression` runs fail the process.
- `services/evals/src/index.ts` catches any thrown error from `main()` and exits with `process.exit(1)`, so Railway marks the cron as failed even though the run already completed and Phoenix data exists.
- `services/evals/src/runners/traffic-monitor.ts` already uses the desired behavioral shape: it persists the summary, logs a warning on threshold breach, and does not throw.
- `services/evals/src/eval-summary.ts` and `lib/db/schema.ts` already persist `capability`, `regression`, and `traffic-monitor` rows in `eval_summaries`.
- `lib/evals/queries.ts` and `lib/evals/types.ts` only load and expose `capability` and `traffic-monitor` in the admin dashboard. `regression` is stored but hidden from the current UI.
- There is no existing eval-specific outbound alerting path and no end-user notification system for this flow. The only verified durable operator surface today is persisted eval state plus the admin `/admin/evals` UI.

## Desired Behavior

- A run that reaches threshold evaluation and persistence is considered **completed**.
- A threshold miss is considered **degraded** or **alert-worthy**, not an execution failure.
- Railway should only see a failed process when the eval run is genuinely incomplete or untrustworthy:
  - missing/invalid config
  - no cases could be executed
  - eval runner / judge / dataset creation failed before a result could be recorded
  - summary persistence failed and we choose to treat the run as unrecorded
- Operators should get an explicit signal when a suite lands below threshold:
  - persisted threshold-breach metadata in `eval_summaries`
  - clear warning logs in the eval service
  - persistent UI visibility in `/admin/evals`

## Architecture

- Replace "throw on threshold breach" with a structured suite outcome object that distinguishes:
  - `passed`
  - `threshold_breached`
  - `incomplete`
- Keep process exit codes tied to `incomplete`, not `threshold_breached`.
- Persist enough metadata per run to render historical alerts accurately even if the configured threshold changes later.
- Use repo-native alerting only: persist threshold metadata, emit structured warnings in service logs, and surface the same state in the eval dashboard.

## Out of Scope

- Reworking Phoenix scoring semantics
- Adding user-by-user notification preferences
- Building a notification delivery system
- Changing the evaluator prompts or corpus to make the score pass

---

## File Structure

**New files:**

- `lib/evals/helpers/alerts.ts`
  - Small helper layer that converts latest persisted runs into dashboard alert rows
- `components/evals/widgets/alert-banner.tsx`
  - Top-level dashboard callout for the newest threshold-breached suite

**Modified files:**

- `services/evals/src/runners/shared.ts`
  - Stop treating threshold breach as a fatal exception
  - Return a structured suite result
- `services/evals/src/runners/regression.ts`
  - Propagate the new suite result contract
- `services/evals/src/runners/capability.ts`
  - Propagate the new suite result contract
- `services/evals/src/runners/traffic-monitor.ts`
  - Align return shape with judged suites so the orchestrator can aggregate outcomes consistently
- `services/evals/src/orchestrator.ts`
  - Aggregate suite outcomes and decide whether the overall run should exit zero or non-zero
- `services/evals/src/index.ts`
  - Fail only on incomplete run classes, not threshold breaches
- `services/evals/src/eval-summary.ts`
  - Persist threshold metadata and failing evaluator names
- `services/evals/src/types.ts`
  - Add suite outcome / alert metadata types
- `lib/db/schema.ts`
  - Extend `eval_summaries` with threshold metadata
- `lib/evals/types.ts`
  - Add regression and alert-facing summary fields to dashboard data
- `lib/evals/queries.ts`
  - Load regression summaries and expose alert-relevant fields
- `lib/evals/helpers/findings.ts`
  - Include regression threshold breaches in findings
- `lib/evals/helpers/feed.ts`
  - Optionally add regression rows if we want the feed to show all persisted suites
- `components/evals/dashboard-v2/dashboard.tsx`
  - Render a banner or top-of-page callout when the latest persisted run breached threshold
- `app/(admin)/admin/evals/page.tsx`
  - Pass the expanded dashboard data through unchanged
- `services/evals/src/runners/shared.test.ts`
- `services/evals/src/runners/traffic-monitor.test.ts`
- `services/evals/src/eval-summary.test.ts`
- `lib/evals/*.test.ts`
  - Update coverage for the new contract and dashboard visibility

---

## Task 1: Separate Threshold Breach From Execution Failure

**Files:**

- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/capability.ts`
- Modify: `services/evals/src/runners/regression.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify: `services/evals/src/orchestrator.ts`
- Modify: `services/evals/src/index.ts`
- Modify: `services/evals/src/types.ts`

Introduce a suite-level result object instead of using thrown threshold errors as control flow.

- [ ] Add a `SuiteRunResult` type with fields similar to:
  - `suite`
  - `status: 'passed' | 'threshold_breached'`
  - `passRate`
  - `threshold`
  - `failedEvaluators`
  - `experimentName`
  - `datasetName`
  - `phoenixUrl`
  - `totalCases`
- [ ] Keep throwing for truly incomplete conditions:
  - all cases failed before we had a usable experiment
  - Phoenix/dataset creation failed before recording
  - required config validation failed
  - DB persistence failed if we decide "not recorded" means incomplete
- [ ] Change `runJudgedSuite()` so a threshold breach returns `status: 'threshold_breached'` instead of throwing.
- [ ] Change `runTrafficMonitorSuite()` to return the same structured result shape for consistency.
- [ ] Change `runConfiguredModes()` to return all suite results and determine an overall run status from them.
- [ ] Keep `main()` / `index.ts` exit-zero when every executed suite is `passed` or `threshold_breached`.

**Why this is necessary:**

- Today, judged suites finish their real work, persist the result, and then convert a quality miss into a process crash. That makes Railway report the wrong failure class.

## Task 2: Persist Historical Threshold Metadata

**Files:**

- Modify: `lib/db/schema.ts`
- Modify: `services/evals/src/eval-summary.ts`
- Modify: `services/evals/src/types.ts`
- Modify: `services/evals/src/eval-summary.test.ts`

The dashboard should not have to guess whether a run was below threshold by comparing `passRate` against today's env var.

- [ ] Add columns to `eval_summaries`:
  - `threshold_bps`
  - `threshold_breached`
  - `failed_evaluators` as `jsonb`
- [ ] Persist the evaluated threshold and the concrete evaluator names that failed for that run.
- [ ] Keep `pass_rate_bps` as the recorded score outcome; do not overload it with status.
- [ ] Update the upsert clause so reruns keep the threshold metadata in sync.

**Why this is necessary:**

- Thresholds are env-configurable. If `SCORE_THRESHOLD` changes later, historical rows still need to reflect the threshold that was used at evaluation time.
- The current table does not preserve `failedEvaluators`, so the UI cannot explain why a run breached without reparsing transient logs.

## Task 3: Add Repo-Native Alerting

**Files:**

- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify tests near `services/evals/src/runners/*.test.ts`

- [ ] Emit a clear structured warning whenever a suite returns `threshold_breached`.
- [ ] Include:
  - suite name
  - pass rate
  - configured threshold
  - failing evaluators
  - experiment name
  - Phoenix URL
  - timestamp
- [ ] Keep the warning path non-fatal:
  - no throw after persistence succeeds
  - warning remains visible in Railway logs
  - warning does not flip the overall run back into a Railway failure

**Why this is necessary:**

- If Railway no longer shows a red failed deployment for threshold misses, the run still needs a repo-native operator signal that exists today.

## Task 4: Surface Threshold Breaches In `/admin/evals`

**Files:**

- Modify: `lib/evals/types.ts`
- Modify: `lib/evals/queries.ts`
- Create: `lib/evals/helpers/alerts.ts`
- Modify: `lib/evals/helpers/findings.ts`
- Optionally modify: `lib/evals/helpers/feed.ts`
- Create: `components/evals/widgets/alert-banner.tsx`
- Modify: `components/evals/dashboard-v2/dashboard.tsx`

The dashboard already exists and is the natural durable surface for these warnings, but it currently hides regression runs entirely.

- [ ] Extend `EvalsDashboardData` to include `regression`.
- [ ] Return the latest and previous regression summaries from `getEvalsDashboard()` and `getEvalsDashboardWithLayout()`.
- [ ] Add a top-of-page alert banner that activates when the newest run in any suite has `threshold_breached = true`.
- [ ] Show the exact suite, pass rate, threshold, failing evaluators, and Phoenix link.
- [ ] Extend findings/feed logic so the dashboard can call out regression breaches, not just traffic monitor drift.

**Why this is necessary:**

- The requested replacement for Railway failure should be a real, existing surface. In this repo that means the admin eval dashboard, not a new notification delivery system.
- Regression is already persisted in the database, so the missing work is mostly query/type/UI wiring, not new storage.

## Task 5: Preserve An Opt-In Hard-Fail Mode For Manual Or CI Use

**Files:**

- Modify: `services/evals/src/config.ts`
- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify tests

We should avoid hard-coding "threshold breaches never fail the process" if local or CI workflows still want strict failure semantics.

- [ ] Add a boolean config such as `EVAL_EXIT_ON_THRESHOLD_BREACH` defaulting to `false`.
- [ ] In Railway, leave it unset so completed-but-below-threshold runs exit zero.
- [ ] In local or CI contexts, allow setting it to `true` if someone explicitly wants shell failure semantics.
- [ ] Keep notifier and persistence behavior identical in both modes so the signal path is consistent.

**Why this is necessary:**

- It keeps the Railway fix narrow while preserving flexibility for stricter environments.

## Task 6: Verification

**Services/evals tests:**

- [ ] `bun run test -- src/runners/shared.test.ts src/runners/traffic-monitor.test.ts src/eval-summary.test.ts src/config.test.ts src/index.test.ts`

**App-side tests:**

- [ ] Add targeted tests for `lib/evals/queries.ts` and any new alert helper
- [ ] Add a focused render test for the new dashboard banner

**Manual verification:**

- [ ] Run a forced threshold-breach fixture locally and verify:
  - process exits zero when `EVAL_EXIT_ON_THRESHOLD_BREACH=false`
  - summary row records `threshold_breached=true`
  - structured warning appears in logs
  - `/admin/evals` shows the alert banner and links to Phoenix
- [ ] Re-run with `EVAL_EXIT_ON_THRESHOLD_BREACH=true` and verify the process exits non-zero without changing persisted metadata or notification behavior

---

## Recommended Implementation Order

1. Implement `SuiteRunResult` and stop throwing on threshold breaches.
2. Persist threshold metadata in `eval_summaries`.
3. Add structured warning logs.
4. Expose regression and alerts in the dashboard.
5. Add the optional hard-fail toggle.
6. Run package-local tests and one forced-breach manual verification.

## Recommendation

Prefer the smallest coherent version of this plan:

- adopt the `traffic-monitor` warning model for judged suites
- persist explicit threshold metadata
- emit structured threshold-breach warnings in logs
- add regression-aware alert visibility to `/admin/evals`

That keeps Railway green for completed runs, preserves operator awareness through existing repo surfaces, and avoids inventing a notification system that does not exist.

# Evals Threshold Notification Without Railway Failure

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` or equivalent repo-grounded workflow. Steps use checkbox syntax for tracking.

**Goal:** Change the scheduled `services/evals` run so a completed eval job that lands below the score threshold is recorded as a completed run with warnings, not a Railway failure. Preserve the existing thrown failure paths, and surface threshold breaches through persisted status, logs, and the admin eval dashboard.

## Current Verified State

- `services/evals/src/runners/shared.ts` currently computes `thresholds`, persists the eval summary, then throws `thresholdError` when `passRate < scoreThreshold`. That throw is what makes judged `capability` and `regression` runs fail the process.
- `services/evals/src/index.ts` catches any thrown error from `main()` and exits with `process.exit(1)`, so Railway marks the cron as failed even though the run already completed and Phoenix data exists.
- `services/evals/src/runners/traffic-monitor.ts` already uses the desired behavioral shape: it persists the summary, logs a warning on threshold breach, and does not throw.
- `services/evals/src/eval-summary.ts` and `lib/db/schema.ts` already persist `capability`, `regression`, and `traffic-monitor` rows in `eval_summaries`.
- `lib/evals/queries.ts` and `lib/evals/types.ts` only load and expose `capability` and `traffic-monitor` in the admin dashboard. `regression` is stored but hidden from the current UI.
- `services/evals/src/orchestrator.ts` already runs suites sequentially. In `all` mode it dispatches `capability`, `regression`, `traffic-monitor`, then `smoke`.
- `services/evals/src/golden/validate.ts` already exists as a separate strict-fail quality gate for manual validation workflows.
- There is no existing eval-specific outbound alerting path and no end-user notification system for this flow. The only verified durable operator surface today is persisted eval state plus the admin `/admin/evals` UI.

## Desired Behavior

- A judged run that successfully records its experiment and successfully persists its summary is considered **completed** even when it lands below threshold.
- A threshold miss is considered **degraded** or **alert-worthy**, not a Railway execution failure.
- This plan is intentionally narrow:
  - it reclassifies the post-persistence threshold breach path
  - it does **not** broaden into a full rewrite of existing Phoenix-unavailable / dashboard-stale fallback behavior
  - it does **not** add a new strict-fail runtime toggle when `bun run validate` already covers that use case
- Operators should get an explicit signal when a suite lands below threshold:
  - persisted threshold metadata in `eval_summaries`
  - clear warning logs in the eval service
  - persistent UI visibility in `/admin/evals`
- The DB migration for new threshold columns must land before the writer change is deployed or before the next eval cron run.
- Legacy `eval_summaries` rows should remain `NULL` / unknown for the new threshold fields rather than being backfilled heuristically.

## Architecture

- Adopt the existing `traffic-monitor` semantics for judged suites:
  - after successful experiment creation and successful summary persistence, a threshold breach emits a warning and returns normally
  - thrown errors remain reserved for already-fatal execution paths
- Do **not** add an orchestrator-wide `SuiteRunResult` / status taxonomy for this fix. `runConfiguredModes()` can remain sequential dispatch.
- Persist threshold metadata directly in `eval_summaries`:
  - `threshold_bps`
  - `threshold_breached`
  - `failed_evaluators`
- Keep the admin dashboard model focused on the two visible suites (`capability` and `trafficMonitor`).
- Add a separate, narrow `latestThresholdBreach` payload for the page/dashboard shell so regression can trigger a banner without widening every widget into a three-suite contract.
- Drive dashboard findings from persisted threshold metadata instead of the current hardcoded traffic-only `80%` floor so the banner and existing alarm surfaces stay aligned.
- Render the alert banner above `LayoutRenderer`, not as a layout widget, so alerts remain visible even when the grid falls back to the empty state.

## Out of Scope

- Reworking Phoenix scoring semantics
- Adding user-by-user notification preferences
- Building a notification delivery system
- Adding a service-runtime `EVAL_EXIT_ON_THRESHOLD_BREACH` toggle
- Refactoring the dashboard into full regression widgets / feeds / trends
- Changing the evaluator prompts or corpus to make the score pass

---

## File Structure

**New files:**

- `components/evals/widgets/alert-banner.tsx`
  - Top-level dashboard callout for the newest persisted threshold breach

**Generated files:**

- `drizzle/<next>_*.sql`
  - Migration that adds nullable threshold metadata columns to `eval_summaries`
- `drizzle/meta/*`
  - Generated Drizzle metadata for the migration above

**Modified files:**

- `services/evals/src/runners/shared.ts`
  - Stop throwing after summary persistence when judged suites miss threshold
  - Pass threshold metadata into summary persistence
- `services/evals/src/runners/traffic-monitor.ts`
  - Persist threshold metadata and align warning payload shape
- `services/evals/src/eval-summary.ts`
  - Persist and upsert threshold metadata
- `lib/db/schema.ts`
  - Extend `eval_summaries` with nullable threshold metadata
- `lib/evals/types.ts`
  - Extend summary snapshots with threshold fields
  - Add a narrow alert payload type for the dashboard shell
- `lib/evals/queries.ts`
  - Return threshold metadata on visible suite snapshots
  - Derive `latestThresholdBreach` from the latest row per suite, including regression
- `lib/evals/helpers/findings.ts`
  - Replace the hardcoded traffic-only threshold rule with persisted threshold metadata
- `components/evals/dashboard-v2/dashboard.tsx`
  - Render the alert banner above the layout grid
- `app/(admin)/admin/evals/page.tsx`
  - Pass the alert payload through to the dashboard shell
- `services/evals/src/runners/shared.test.ts`
- `services/evals/src/runners/traffic-monitor.test.ts`
- `services/evals/src/eval-summary.test.ts`
- `lib/evals/queries.test.ts`
- `lib/evals/helpers/__tests__/findings.test.ts`
- `components/evals/dashboard-v2/dashboard.test.tsx`
  - Update coverage for the migration-backed metadata and banner behavior

**Files that should stay unchanged in this phase:**

- `lib/evals/helpers/feed.ts`
- `lib/evals/helpers/combined-trend.ts`
- `lib/evals/layout/types.ts`
- `lib/evals/layout/templates.ts`
- `components/evals/widgets/registry.ts`
- existing two-suite comparison widgets such as `evaluator-comparison-grid.tsx`

---

## Task 1: Adopt Non-Fatal Threshold Handling For Judged Suites

**Files:**

- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/shared.test.ts`

Adopt the existing `traffic-monitor` behavior for judged suites instead of introducing a new orchestrator-wide status model.

- [ ] Remove the post-persistence `thresholdError` throw from `runJudgedSuite()`.
- [ ] Keep already-fatal paths unchanged in this pass:
  - config validation failures
  - "all eval cases failed" aborts
  - other currently uncaught runtime errors
- [ ] Do **not** introduce `SuiteRunResult`, `incomplete` status taxonomies, or orchestrator aggregation for this fix.
- [ ] Keep `all` mode on the existing sequential path:
  - `capability`
  - `regression`
  - `traffic-monitor`
  - `smoke`
- [ ] Explicitly preserve the current smoke semantics:
  - smoke remains best-effort
  - smoke does not participate in threshold alert state
  - threshold-breached judged suites must not prevent later suites from running in `all` mode

**Why this is necessary:**

- Today, judged suites finish their real work, persist the result, and then convert a quality miss into a process crash. That makes Railway report the wrong failure class.

## Task 2: Persist Historical Threshold Metadata Safely

**Files:**

- Modify: `lib/db/schema.ts`
- Create: `drizzle/<next>_*.sql`
- Commit: `drizzle/meta/*`
- Modify: `services/evals/src/eval-summary.ts`
- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify: `services/evals/src/eval-summary.test.ts`
- Modify: `services/evals/src/runners/shared.test.ts`
- Modify: `services/evals/src/runners/traffic-monitor.test.ts`

The dashboard should not have to guess whether a run was below threshold by comparing `passRate` against today's env var, and the repo must include the actual migration artifacts required to make the writer change safe.

- [ ] Add columns to `eval_summaries`:
  - `threshold_bps`
  - `threshold_breached`
  - `failed_evaluators` as `jsonb`
- [ ] Make the new columns nullable in the initial migration because legacy rows cannot be reconstructed exactly.
- [ ] If adding a range check for `threshold_bps`, allow `NULL` and only enforce `0..10000` when populated.
- [ ] Persist the evaluated threshold and the concrete evaluator names that failed for each new run.
- [ ] Keep `pass_rate_bps` as the recorded score outcome; do not overload it with status.
- [ ] Update the insert and `ON CONFLICT (experiment_name) DO UPDATE` clauses so reruns keep threshold metadata in sync.
- [ ] Do **not** backfill guessed values for historical rows:
  - existing rows should remain `NULL` / unknown for the new threshold fields
  - `failed_evaluators` cannot be reconstructed from stored evaluator averages
- [ ] Apply the DB migration before deploying the writer change or allowing the next eval cron run.
- [ ] Call out explicitly that `services/evals` does not run migrations on startup.

**Why this is necessary:**

- Thresholds are env-configurable. If `SCORE_THRESHOLD` changes later, historical rows still need to reflect the threshold that was used at evaluation time.
- The current table does not preserve `failedEvaluators`, so the UI cannot explain why a run breached without reparsing transient logs.
- The current plan was missing the actual Drizzle migration artifacts and rollout sequencing required to make the write path safe.

## Task 3: Emit Consistent Non-Fatal Threshold Warnings

**Files:**

- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify: `services/evals/src/runners/shared.test.ts`
- Modify: `services/evals/src/runners/traffic-monitor.test.ts`

- [ ] Emit a clear warning whenever a suite records `threshold_breached = true`.
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
  - warning does not flip the run back into a Railway failure
- [ ] Keep the existing Phoenix-unavailable / dashboard-stale logging paths unchanged in this pass.

**Why this is necessary:**

- If Railway no longer shows a red failed deployment for threshold misses, the run still needs an explicit repo-native operator signal.

## Task 4: Surface Threshold Breaches In `/admin/evals` Without Widening The Dashboard Model

**Files:**

- Modify: `lib/evals/types.ts`
- Modify: `lib/evals/queries.ts`
- Modify: `lib/evals/helpers/findings.ts`
- Create: `components/evals/widgets/alert-banner.tsx`
- Modify: `components/evals/dashboard-v2/dashboard.tsx`
- Modify: `app/(admin)/admin/evals/page.tsx`
- Modify: `app/(admin)/admin/evals/page.test.tsx`
- Modify: `lib/evals/queries.test.ts`
- Modify: `lib/evals/helpers/__tests__/findings.test.ts`
- Modify: `components/evals/dashboard-v2/dashboard.test.tsx`

The dashboard already exists and is the natural durable surface for these warnings, but the current widget system is intentionally two-suite-only. The minimal fix is to add a narrow alert payload, not a full regression dashboard section.

- [ ] Keep the visible dashboard suite contract limited to `capability` and `trafficMonitor`.
- [ ] Add threshold metadata to the existing visible suite snapshots:
  - `thresholdBps`
  - `thresholdBreached`
  - `failedEvaluators`
- [ ] Add a separate `latestThresholdBreach` payload for the page/dashboard shell.
- [ ] Derive `latestThresholdBreach` from the latest persisted row per suite, including the latest `regression` row, without exposing a full `regression` dashboard section.
- [ ] Add a top-of-page alert banner that activates when `latestThresholdBreach` is present.
- [ ] Show the exact suite, pass rate, threshold, failing evaluators, and Phoenix link.
- [ ] Render the banner in `EvalsDashboardV2` above `LayoutRenderer`, not as a layout widget.
- [ ] Update `computeFindings()` to use persisted threshold metadata instead of the current hardcoded traffic-only `80%` floor.
- [ ] Leave the following unchanged in this phase:
  - `feed.ts`
  - `combined-trend.ts`
  - layout templates
  - widget registry
  - existing two-suite comparison widgets

**Why this is necessary:**

- The requested replacement for Railway failure should be a real, existing surface. In this repo that means the admin eval dashboard, not a new notification delivery system.
- A full `regression` dashboard section would create unnecessary fanout across templates, widgets, feeds, trends, and tests for a problem that only needs alert visibility.

## Task 5: Verification

**Services/evals tests:**

- [ ] `bun run test -- src/runners/shared.test.ts src/runners/traffic-monitor.test.ts src/eval-summary.test.ts`

**App-side tests:**

- [ ] Add targeted tests for `lib/evals/queries.ts`
- [ ] Update `lib/evals/helpers/__tests__/findings.test.ts` so findings align with persisted threshold metadata instead of the hardcoded `80%` floor
- [ ] Add a focused render test for the new dashboard banner

**Manual verification:**

- [ ] Apply the DB migration before running the updated writer locally or on a deployed environment
- [ ] Run a forced threshold-breach fixture locally and verify:
  - judged suites exit zero after successful summary persistence
  - summary row records `threshold_breached=true`
  - summary row records `threshold_bps` and `failed_evaluators`
  - structured warning appears in logs
  - `/admin/evals` shows the alert banner and links to Phoenix
- [ ] Run `EVAL_RUN_MODE=all` and verify threshold-breached judged suites do not prevent later suites from running
- [ ] Confirm regression-only breaches still surface through the top-of-page banner even though regression is not a full dashboard suite
- [ ] Confirm legacy rows with `NULL` threshold metadata do not break the dashboard or produce invented breach history

---

## Recommended Implementation Order

1. Add the schema change and generated Drizzle migration artifacts.
2. Update `persistEvalSummary()` and both suite writers to record threshold metadata.
3. Stop throwing on post-persistence threshold breaches in judged suites.
4. Align warning logs.
5. Add the narrow dashboard alert payload and banner.
6. Update targeted tests and run one forced-breach manual verification.
7. Follow up separately by updating deployment docs once the implementation lands.

## Recommendation

Prefer the smallest coherent version of this plan:

- adopt the `traffic-monitor` warning model for judged suites
- add the missing migration and rollout sequencing for threshold metadata
- emit explicit threshold-breach warnings in logs
- surface the newest breach in `/admin/evals` through a narrow banner payload, not a full regression dashboard refactor

That keeps Railway green for completed runs, preserves operator awareness through existing repo surfaces, avoids migration footguns, and avoids widening the dashboard beyond what this fix actually needs.

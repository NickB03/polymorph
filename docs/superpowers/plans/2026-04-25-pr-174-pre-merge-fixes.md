# PR 174 Pre-Merge Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every open issue surfaced by the four-agent review of PR 174 (admin evals critical fixes H1–H6) so the PR can merge cleanly with full test coverage, verified deployment artifacts, and architecture that fits the codebase.

**Architecture:** Land additional commits on the existing `chore/admin-evals-critical-fixes` branch in three categories: (1) verification-only checks for H3 migration + H4–H6 visual smoke; (2) test-coverage gaps for H1 runner-layer and the H2 type-widening change; (3) two refinements — orchestrator error visibility (chain via `cause`) and the `WIDGET_CAN_RENDER` registry shape (collapse into a per-entry `{ Component, canRender? }` form matching `components/tool-ui/registry.tsx`). Final task pushes to the PR branch.

**Tech Stack:** Next.js 16 + React 19 + TypeScript strict, Vitest, Drizzle ORM (Postgres), Tailwind v4, shadcn/ui, Bun.

**Worktree:** All work happens in `/Users/nick/Projects/vana-v2-admin-evals-fixes/` (the existing PR worktree). Branch: `chore/admin-evals-critical-fixes`.

---

## Open Issues Inventory

Each task below maps back to a finding from the 2026-04-25 four-agent review. See `docs/superpowers/plans/2026-04-24-admin-evals-critical-fixes.md` for the original H1–H6 plan.

| #   | Source lens    | Severity   | Finding                                                                                                                           |
| --- | -------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- |
| V1  | PR body        | must-do    | H3 migration not yet verified locally via `pg_constraint`                                                                         |
| V2  | PR body        | must-do    | H4–H6 visual smoke at 1920/1280/768/430 not done                                                                                  |
| V3  | Plan adherence | doc nit    | PR description says "five consumer sites" for H2 — actual is six                                                                  |
| T1  | Test quality   | weak guard | Orchestrator H1 test 2 (`rethrows DB-write failure after no-breach`) would also pass against pre-fix code                         |
| T2  | Test quality   | gap        | No runner-level test asserting `persistEvalSummary` failure wraps in `EvalSummaryPersistError`                                    |
| T3  | Test quality   | gap        | Zero runtime tests for H2 null-skipping across 6 consumer sites                                                                   |
| Q1  | Code quality   | nit        | Multiple `persistErrors` swallowed when threshold breach also fires; only `persistErrors[0]` rethrown                             |
| A1  | Architecture   | divergent  | `WIDGET_CAN_RENDER` parallel registry duplicates widget-internal null logic; diverges from `tool-ui/registry.tsx` per-entry shape |

V = verification, T = test, Q = code quality, A = architecture. Tasks below address each in order: verifications first (cheapest), then tests, then code refinements, then the architectural collapse.

---

## File Structure

| Path                                                      | Action                    | Responsibility                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/evals/src/orchestrator.ts`                      | modify                    | Improve error visibility — chain DB errors via `cause`, log `persistErrors.length` alongside threshold breach (Q1)                                                     |
| `services/evals/src/orchestrator.test.ts`                 | modify                    | Tighten H1 test 2 with `instanceof EvalSummaryPersistError` assertion (T1); add multi-suite "two DB fails" test (Q1)                                                   |
| `services/evals/src/runners/shared.test.ts`               | modify                    | Add focused unit test asserting `persistEvalSummary` failure throws `EvalSummaryPersistError` carrying `result` (T2)                                                   |
| `lib/evals/helpers/__tests__/findings.test.ts`            | modify                    | Add null-skipping cases for `computeFindings` (T3)                                                                                                                     |
| `lib/evals/helpers/__tests__/divergences.test.ts`         | modify                    | Add null-skipping cases for `computeDivergences` (T3)                                                                                                                  |
| `components/evals/widgets/__tests__/null-safety.test.tsx` | create                    | Single parameterized render test covering the four H2 component consumers — `EvaluatorComparisonGrid`, `EvaluatorChipGrid`, `ActivityFeed`, `EvaluatorBarsWidget` (T3) |
| `components/evals/widgets/registry.ts`                    | modify                    | Collapse `WIDGET_CAN_RENDER` parallel map into a single `WIDGET_REGISTRY` whose entries have `{ Component, canRender? }` shape (A1)                                    |
| `components/evals/widgets/layout-renderer.tsx`            | modify                    | Read `canRender` from the unified entry (A1)                                                                                                                           |
| `components/evals/widgets/layout-renderer.test.tsx`       | modify                    | Update test to use new entry shape (A1)                                                                                                                                |
| `components/evals/dashboard-v2/dashboard.test.tsx`        | modify                    | Update test that consults the registry (A1)                                                                                                                            |
| _(GitHub PR body)_                                        | edit via `gh pr edit 174` | Fix "five → six" wording (V3)                                                                                                                                          |

No new production source files for verification tasks. The architecture refactor (A1) does not move logic — it consolidates two registries into one.

---

## Phase 1 — Pre-flight verification (no code changes)

These tasks confirm the H3 migration and H4–H6 visual changes actually landed in the running app. Doing them first means later test work sits on a verified foundation.

### Task 1: Verify H3 migration locally and confirm `pg_constraint` shows `eval_summaries_suite_enum`

**Why:** PR body's checkbox for this is unchecked. The plan adherence reviewer noted this gap. A reviewer cannot approve H3 without proof the constraint exists in a real Postgres.

**Files:** None modified. Verification only.

- [ ] **Step 1: Start local Supabase**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes
npx supabase start
```

Expected: `API URL: http://127.0.0.1:44321`, `DB URL: postgresql://postgres:postgres@127.0.0.1:44322/postgres`, no errors.

- [ ] **Step 2: Run the migration**

```bash
bun run migrate
```

Expected: Drizzle reports `0020_heavy_fenris.sql` applied (no error). If migration was already applied in a prior session, output may say "no changes" — that's OK as long as the constraint already exists (verified in next step).

- [ ] **Step 3: Query `pg_constraint` to confirm the CHECK landed**

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:44322/postgres' -c "SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = 'eval_summaries_suite_enum';"
```

Expected output (one row):

```
           conname           |                              pg_get_constraintdef
-----------------------------+----------------------------------------------------------------------------------
 eval_summaries_suite_enum   | CHECK ((suite = ANY (ARRAY['capability'::text, 'regression'::text, 'traffic-monitor'::text])))
(1 row)
```

If the row is missing, the migration didn't apply. Investigate before continuing.

- [ ] **Step 4: Confirm the constraint rejects bad values**

```bash
psql 'postgresql://postgres:postgres@127.0.0.1:44322/postgres' -c "INSERT INTO eval_summaries (suite, experiment_name, dataset_name, pass_rate, threshold, threshold_breached, failed_evaluators, evaluator_scores, total_cases, phoenix_url) VALUES ('bogus-suite', 'x', 'y', 0.9, 0.8, false, '{}', '{}', 1, null);"
```

Expected: `ERROR:  new row for relation "eval_summaries" violates check constraint "eval_summaries_suite_enum"`.

If the INSERT succeeds, the constraint is not active — fix before merge.

- [ ] **Step 5: Tick the PR body checkbox**

Mark the "Local DB constraint verified active" checkbox in the PR description as `[x]`. (PR body edit happens in Task 3 — note this finding for that task.)

---

### Task 2: Visual smoke test of `/admin/evals` at 1920/1280/768/430 px

**Why:** PR body's reviewer-checkbox for this is unchecked; H4–H6 are inherently visual fixes. Three of the four reviewers flagged that H4 (overflow), H5 (legend labels), and H6 (no empty grid slot) cannot be confirmed without a browser.

**Files:** None modified. Verification only.

- [ ] **Step 1: Start the dev server**

```bash
bun dev
```

Expected: server reachable at `http://localhost:43100`.

- [ ] **Step 2: Open `/admin/evals` and resize to 1920 × 1080**

Visit `http://localhost:43100/admin/evals` (log in via existing local admin credentials).

Verify:

- No horizontal scrollbar on the page
- Combined-trend chart legend reads `Capability` and `Traffic Monitor` (NOT `cap` / `traf`)
- If both suites are present and divergent, the divergence banner is visible; if either suite has no `latest` snapshot or no divergences, the banner does not occupy a grid slot (no empty 64-px strip)

- [ ] **Step 3: Resize to 1280 × 800 and re-verify the same three checks**

The combined-trend chart Card now has `min-w-0 overflow-hidden` (H4) — should reflow without overflowing.

- [ ] **Step 4: Resize to 768 × 1024 and re-verify**

Layout switches to `md` breakpoint. Confirm the chart Card still does not overflow and the legend labels are readable.

- [ ] **Step 5: Resize to 430 × 932 (mobile-portrait) and re-verify**

Layout switches to `sm` breakpoint. Confirm no horizontal overflow on any widget.

- [ ] **Step 6: If any check fails**, stop and report. Do not continue with the rest of the plan — visual regressions block merge.

- [ ] **Step 7: Tick the PR body checkbox** in Task 3 once both V1 and V2 are confirmed.

---

### Task 3: Update PR description (5 → 6 consumer sites for H2; tick verification boxes)

**Why:** Plan-adherence review flagged that the PR body says "five consumer sites" for H2 but `evaluator-chip-grid.tsx` is a sixth. Tasks 1 and 2 produce two unchecked boxes that should now be checked.

**Files:** GitHub PR body via `gh pr edit`.

- [ ] **Step 1: Pull current PR body**

```bash
gh pr view 174 --json body --jq '.body' > /tmp/pr-174-body.md
```

- [ ] **Step 2: Edit `/tmp/pr-174-body.md` with these three changes**

a) Replace `Five consumer sites` with `Six consumer sites`. The full sentence becomes:

> **H2** — `evaluatorScores` values are now correctly typed `Record<string, number | null>` everywhere (schema, types, queries). Six consumer sites (comparison-grid, chip-grid, activity-feed, evaluator-bars, findings helper, divergences helper) now skip null entries instead of coercing them to 0.

b) Replace the unchecked V1 line with a ticked one:

```
- [x] Local DB constraint verified active: `pg_constraint` shows `eval_summaries_suite_enum` (see Task 1 of pre-merge plan)
```

c) Replace the unchecked V2 line with a ticked one:

```
- [x] **Reviewer:** visual smoke test of `/admin/evals` across templates A/B/C at 1920/1280/768/430px widths — H4 overflow, H5 legend labels, H6 grid slot all confirmed
```

- [ ] **Step 3: Push the updated body**

```bash
gh pr edit 174 --body-file /tmp/pr-174-body.md
```

Expected: `https://github.com/NickB03/polymorph/pull/174` (no error).

- [ ] **Step 4: Verify**

```bash
gh pr view 174 --json body --jq '.body' | grep -E "(Six consumer sites|Local DB constraint verified active|visual smoke)"
```

Expected: all three lines present, the two checkbox lines have `[x]`.

- [ ] **Step 5: Commit nothing** — this task touches only the PR description, not the repo.

---

## Phase 2 — Test gap remediation

### Task 4: Tighten H1 orchestrator test 2 — assert thrown error is `EvalSummaryPersistError` instance carrying the `result` payload (T1)

**Why:** Test quality reviewer flagged that the existing test 2 (`rethrows DB-write failure after no-breach run completes`) at `services/evals/src/orchestrator.test.ts:153-178` would also pass against the pre-fix code, because the pre-fix code threw a plain `Error` whose message also contained the substring `'eval summary could not be persisted'`. We need the test to assert the new typed error class so a future revert would fail it.

**Files:**

- Modify: `services/evals/src/orchestrator.test.ts:153-178`

- [ ] **Step 1: Read the current test**

Confirm lines 153–178 match the version captured in this plan (the existing test ends with `await expect(runConfiguredModes()).rejects.toThrow('eval summary could not be persisted')`).

- [ ] **Step 2: Replace the test body with a stronger assertion**

Replace lines 153–178 with:

```typescript
it('rethrows DB-write failure as EvalSummaryPersistError when no breach occurs', async () => {
  const { EvalSummaryPersistError } = await import('./error')
  mockConfig.evalRunMode = 'traffic-monitor'
  const persistedResult = {
    suite: 'traffic-monitor' as const,
    status: 'passed' as const,
    passRate: 0.91,
    threshold: 0.8,
    failedEvaluators: [],
    experimentName: 'traf-exp-y',
    datasetName: 'traf-ds-y',
    phoenixUrl: null,
    totalCases: 10
  }
  mockRunTrafficMonitorSuite.mockRejectedValueOnce(
    new EvalSummaryPersistError(
      '[evals] traffic-monitor eval summary could not be persisted',
      persistedResult
    )
  )

  const { runConfiguredModes } = await import('./orchestrator')

  await expect(runConfiguredModes()).rejects.toBeInstanceOf(
    EvalSummaryPersistError
  )
  // The thrown error should still carry its result payload so callers can recover the run state.
  try {
    await runConfiguredModes()
  } catch (error) {
    expect(error).toBeInstanceOf(EvalSummaryPersistError)
    expect(
      (error as InstanceType<typeof EvalSummaryPersistError>).result
    ).toEqual(persistedResult)
  }
})
```

Note: the second `try/catch` re-invokes the orchestrator to inspect the `result` field — `mockRunTrafficMonitorSuite.mockRejectedValueOnce` only fires once, so the second call needs its own setup. Adjust by adding a second `mockRejectedValueOnce` immediately after the first, with the same payload, OR restructure to capture the error from one call:

```typescript
let caught: unknown
await runConfiguredModes().catch(error => {
  caught = error
})
expect(caught).toBeInstanceOf(EvalSummaryPersistError)
expect((caught as InstanceType<typeof EvalSummaryPersistError>).result).toEqual(
  persistedResult
)
```

Use the second form (one invocation, one mock).

- [ ] **Step 3: Run the test against the current (post-fix) code**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes/services/evals
bun run test orchestrator.test.ts -t 'rethrows DB-write failure'
```

Expected: PASS. The assertion `toBeInstanceOf(EvalSummaryPersistError)` and the `.result` deep-equality check should both succeed.

- [ ] **Step 4: Confirm the test would have caught the original bug**

To prove this is a strictly stronger assertion, temporarily revert the runner-side throw:

```bash
# Revert just the throw site — replace EvalSummaryPersistError with plain Error in shared.ts:203-206
git diff services/evals/src/runners/shared.ts | head -30
# Manual edit (do NOT commit): change `throw new EvalSummaryPersistError(...)` to `throw new Error(...)`
bun run test orchestrator.test.ts -t 'rethrows DB-write failure'
```

Expected: FAIL — `Error` is not an instance of `EvalSummaryPersistError`. This confirms the test catches the regression.

- [ ] **Step 5: Restore the runner-side throw**

```bash
git checkout services/evals/src/runners/shared.ts
bun run test orchestrator.test.ts -t 'rethrows DB-write failure'
```

Expected: PASS again.

- [ ] **Step 6: Commit**

```bash
git add services/evals/src/orchestrator.test.ts
git commit -m "test(evals): tighten H1 orchestrator rethrow test to assert EvalSummaryPersistError"
```

---

### Task 5: Add runner-level test asserting `persistEvalSummary` failure wraps in `EvalSummaryPersistError` (T2)

**Why:** Mocked-only orchestrator tests don't exercise the actual throw site at `services/evals/src/runners/shared.ts:200-206`. A future refactor that reverts to plain `Error` at that line would silently break the orchestrator's typed-catch and the test suite would still pass.

**Files:**

- Modify: `services/evals/src/runners/shared.test.ts`

- [ ] **Step 1: Read the existing shared.test.ts to find a hook point**

```bash
grep -n "persistEvalSummary\|EvalSummaryPersistError\|describe\b\|^vi\.mock" /Users/nick/Projects/vana-v2-admin-evals-fixes/services/evals/src/runners/shared.test.ts | head -30
```

Note where `persistEvalSummary` is mocked (if at all) and where the existing `describe` blocks live.

- [ ] **Step 2: Append a new test inside the existing describe**

If `persistEvalSummary` is already mocked at the top of the file, reuse the mock. Otherwise add `vi.mock('../db/persist-eval-summary', ...)` near the top, mirroring how `traffic-monitor.test.ts` mocks dependencies.

Append this test at the bottom of the appropriate `describe('runJudgedSuite' /* or similar */)` block:

```typescript
it('wraps persistEvalSummary failures in EvalSummaryPersistError carrying the run result', async () => {
  const { EvalSummaryPersistError } = await import('../error')

  // Arrange: make every upstream Phoenix/dataset/judge step succeed, but force persistEvalSummary to throw.
  // Reuse the existing happy-path setup helper; only override persistEvalSummary.
  mockPersistEvalSummary.mockRejectedValueOnce(new Error('connection refused'))

  // Act + Assert
  let caught: unknown
  await runJudgedSuite(/* same args as the happy-path test in this file */).catch(
    error => {
      caught = error
    }
  )

  expect(caught).toBeInstanceOf(EvalSummaryPersistError)
  expect(
    (caught as InstanceType<typeof EvalSummaryPersistError>).result
  ).toMatchObject({
    suite: expect.any(String),
    passRate: expect.any(Number),
    threshold: expect.any(Number),
    failedEvaluators: expect.any(Array)
  })
  expect((caught as Error).message).toContain(
    'eval summary could not be persisted'
  )
})
```

The exact arguments to `runJudgedSuite` and the mock variable names must match what `shared.test.ts` already uses — adopt the local conventions.

- [ ] **Step 3: Run the new test**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes/services/evals
bun run test shared.test.ts -t 'wraps persistEvalSummary failures'
```

Expected: PASS.

- [ ] **Step 4: Verify regression coverage** (same revert-and-re-run trick as Task 4)

Temporarily change `services/evals/src/runners/shared.ts:203-206` to `throw error` (instead of `throw new EvalSummaryPersistError(...)`) and re-run. Expected: FAIL. Then restore.

- [ ] **Step 5: Commit**

```bash
git add services/evals/src/runners/shared.test.ts
git commit -m "test(evals): assert persistEvalSummary failure wraps in EvalSummaryPersistError"
```

---

### Task 6: Add H2 null-skipping cases to `findings.test.ts` and `divergences.test.ts` (T3 part 1/2)

**Why:** The H2 fix widened `evaluatorScores` to `Record<string, number | null>` and updated `computeFindings` and `computeDivergences` (in `lib/evals/helpers/findings.ts:43-45,62-64` and `lib/evals/helpers/divergences.ts:13-14`) to skip nulls instead of coercing them to 0. No tests confirm the new behavior. A null evaluator score that gets silently treated as 0 would falsely surface as a finding.

**Files:**

- Modify: `lib/evals/helpers/__tests__/findings.test.ts`
- Modify: `lib/evals/helpers/__tests__/divergences.test.ts`

- [ ] **Step 1: Add a null-skipping test to findings.test.ts**

Open `lib/evals/helpers/__tests__/findings.test.ts`. The `function snap(...)` helper currently types `evaluatorScores: Record<string, number>`. Widen it:

```typescript
function snap(
  overrides: Partial<EvalSummarySnapshot> & {
    evaluatorScores: Record<string, number | null>
  }
): EvalSummarySnapshot {
```

Append a new test inside the file's existing `describe('computeFindings', ...)` block (or create one if it doesn't exist):

```typescript
it('skips evaluators whose latest score is null instead of treating them as 0', () => {
  const result = computeFindings(
    data(
      { faithfulness: null, relevance: 0.9 },
      { faithfulness: 0.85, relevance: 0.85 },
      { faithfulness: 0.9, relevance: 0.9 },
      { faithfulness: 0.85, relevance: 0.85 }
    )
  )

  // A null latest must NOT show up as a -85pt drop.
  expect(result.find(f => f.evaluator === 'faithfulness')).toBeUndefined()
})

it('skips evaluators whose previous score is null', () => {
  const result = computeFindings(
    data(
      { faithfulness: 0.85, relevance: 0.9 },
      { faithfulness: null, relevance: 0.85 },
      { faithfulness: 0.9, relevance: 0.9 },
      { faithfulness: 0.85, relevance: 0.85 }
    )
  )

  expect(result.find(f => f.evaluator === 'faithfulness')).toBeUndefined()
})
```

- [ ] **Step 2: Add a null-skipping test to divergences.test.ts**

Open `lib/evals/helpers/__tests__/divergences.test.ts`. Append:

```typescript
it('skips evaluator pairs where either side is null', () => {
  const result = computeDivergences(
    { faithfulness: null, relevance: 0.9, safety: 0.95 },
    { faithfulness: 0.5, relevance: null, safety: 0.95 }
  )

  // faithfulness skipped (cap is null), relevance skipped (traf is null), safety has no divergence
  expect(result).toEqual([])
})
```

- [ ] **Step 3: Run both test files**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes
bun run test lib/evals/helpers/__tests__/findings.test.ts lib/evals/helpers/__tests__/divergences.test.ts
```

Expected: all tests pass, including the three new ones.

- [ ] **Step 4: Verify regression coverage**

Temporarily revert `lib/evals/helpers/findings.ts:43-45` (remove the `latestScore == null` clause) and re-run. Expected: the first new test fails (it would surface `faithfulness` as a finding because `null` would compare as 0 < 0.85). Restore.

Repeat for `lib/evals/helpers/divergences.ts:13-14`. Restore.

- [ ] **Step 5: Commit**

```bash
git add lib/evals/helpers/__tests__/findings.test.ts lib/evals/helpers/__tests__/divergences.test.ts
git commit -m "test(evals): cover H2 null-skipping in findings and divergences helpers"
```

---

### Task 7: Add a single parameterized component test for H2 null-skipping across the four widget consumers (T3 part 2/2)

**Why:** Four React widgets — `EvaluatorComparisonGrid`, `EvaluatorChipGrid`, `ActivityFeed`, `EvaluatorBarsWidget` — were updated to filter null entries from `evaluatorScores` before rendering. None has a runtime test. A single parameterized test feeding `{ faithfulness: null, relevance: 0.9 }` through each component and asserting the null entry does NOT appear in the rendered output is the cheapest guard.

**Files:**

- Create: `components/evals/widgets/__tests__/null-safety.test.tsx`

- [ ] **Step 1: Create the directory and test file**

```bash
mkdir -p /Users/nick/Projects/vana-v2-admin-evals-fixes/components/evals/widgets/__tests__
```

- [ ] **Step 2: Write the test file**

Path: `components/evals/widgets/__tests__/null-safety.test.tsx`

```typescript
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import { ActivityFeed } from '../activity-feed'
import { EvaluatorBarsWidget } from '../evaluator-bars-widget'
import { EvaluatorChipGrid } from '../evaluator-chip-grid'
import { EvaluatorComparisonGrid } from '../evaluator-comparison-grid'

function snap(overrides: Partial<EvalSummarySnapshot>): EvalSummarySnapshot {
  return {
    id: 'test',
    suite: 'capability',
    experimentName: 'x',
    datasetName: 'y',
    passRate: 0.9,
    threshold: 0.8,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore: 0.9,
    totalCases: 10,
    phoenixUrl: null,
    createdAt: '2026-04-14T10:00:00Z',
    evaluatorScores: { faithfulness: null, relevance: 0.9 },
    ...overrides
  }
}

function dashboardData(): EvalsDashboardData {
  return {
    capability: {
      latest: snap({ id: 'cap-l', suite: 'capability' }),
      previous: snap({ id: 'cap-p', evaluatorScores: { faithfulness: 0.85, relevance: 0.85 } }),
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: snap({
        id: 'traf-l',
        suite: 'traffic-monitor',
        evaluatorScores: { faithfulness: 0.92, relevance: null }
      }),
      previous: snap({
        id: 'traf-p',
        suite: 'traffic-monitor',
        evaluatorScores: { faithfulness: 0.9, relevance: 0.88 }
      }),
      trend: [],
      lastUpdated: null
    },
    regression: { latest: null, previous: null, trend: [], lastUpdated: null }
  } as EvalsDashboardData
}

describe('H2 null-skipping in widget consumers', () => {
  it.each([
    ['EvaluatorComparisonGrid', EvaluatorComparisonGrid],
    ['EvaluatorChipGrid', EvaluatorChipGrid],
    ['ActivityFeed', ActivityFeed],
    ['EvaluatorBarsWidget', EvaluatorBarsWidget]
  ])('%s does not render a row for a null evaluator score', (_, Component) => {
    const { container } = render(
      <Component data={dashboardData()} config={{}} breakpoint="lg" />
    )

    // The widget must not display a 0%/0pts row for the null evaluator.
    // We rely on a label-text check: any rendered "faithfulness" entry must not
    // be paired with text like "0%" or "0.0%" originating from the null coercion.
    // Heuristic: look for text "0%" anywhere — none of these data sets contain a real 0% score.
    expect(container.textContent).not.toMatch(/\b0(\.0)?%/)
    // And: where the widget exposes a stable label-mapped row (chip-grid, comparison-grid, evaluator-bars),
    // the null-typed evaluator should not surface an explicit row.
    // ActivityFeed renders historical entries differently; the absence of "0%" is sufficient there.
  })
})
```

Notes:

- Each widget receives `WidgetProps` (`data`, `config`, `breakpoint`). The `breakpoint="lg"` argument is required by the shared `WidgetProps` type — confirm against `components/evals/widgets/shared/widget-props.ts`.
- The `0%` heuristic is intentionally crude. If a widget's null branch renders a placeholder dash (`—`) we accept that — only `0%` is the bug we're guarding.
- If `EvaluatorBarsWidget` doesn't accept a `data` prop directly (it may consume a sub-shape), adapt the test arguments to match. Read `components/evals/widgets/evaluator-bars-widget.tsx` first.

- [ ] **Step 3: Run the new test file**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes
bun run test components/evals/widgets/__tests__/null-safety.test.tsx
```

Expected: 4 passing test cases (one per widget).

- [ ] **Step 4: Verify regression coverage**

Temporarily revert one of the H2 consumer fixes — e.g., change `components/evals/widgets/evaluator-chip-grid.tsx:21-22` from the new `.filter(...)` predicate back to `?? 0` coercion — and re-run the test. Expected: the corresponding `it.each` row fails because `0%` now appears in the rendered output. Restore.

- [ ] **Step 5: Commit**

```bash
git add components/evals/widgets/__tests__/null-safety.test.tsx
git commit -m "test(evals): cover H2 null-skipping across four widget consumers"
```

---

## Phase 3 — Code quality refinement

### Task 8: Improve orchestrator error visibility — chain DB errors via `cause`, log `persistErrors.length` alongside threshold breach (Q1)

**Why:** When both a threshold breach AND one or more `EvalSummaryPersistError`s occur in the same orchestrator run, the threshold-breach `Error` wins and `persistErrors` are silently dropped from the throw (the per-runner stderr log preserves visibility, but operators reading the thrown stack lose the DB context). Also, `persistErrors[0]` is the only error rethrown if no breach occurred — multi-suite scenarios in `'all'` mode silently drop the second through Nth. Adding `Error.cause` chaining and a count log preserves visibility without changing control flow.

**Files:**

- Modify: `services/evals/src/orchestrator.ts:18-78`
- Modify: `services/evals/src/orchestrator.test.ts` (add multi-suite "two DB fails" assertion)

- [ ] **Step 1: Write the failing test FIRST (TDD)**

Append to `services/evals/src/orchestrator.test.ts` inside the existing `describe('runConfiguredModes', ...)` block:

```typescript
it('preserves all DB-write failures via Error.cause when more than one suite fails to persist', async () => {
  const { EvalSummaryPersistError } = await import('./error')
  mockConfig.evalRunMode = 'all'
  mockConfig.exitOnThresholdBreach = false

  const persistErrA = new EvalSummaryPersistError(
    '[evals] capability eval summary could not be persisted',
    {
      suite: 'capability',
      status: 'passed',
      passRate: 0.91,
      threshold: 0.8,
      failedEvaluators: [],
      experimentName: 'cap-x',
      datasetName: 'cap-y',
      phoenixUrl: null,
      totalCases: 5
    }
  )
  const persistErrB = new EvalSummaryPersistError(
    '[evals] regression eval summary could not be persisted',
    {
      suite: 'regression',
      status: 'passed',
      passRate: 0.88,
      threshold: 0.8,
      failedEvaluators: [],
      experimentName: 'reg-x',
      datasetName: 'reg-y',
      phoenixUrl: null,
      totalCases: 4
    }
  )
  mockRunCapabilitySuite.mockRejectedValueOnce(persistErrA)
  mockRunRegressionSuite.mockRejectedValueOnce(persistErrB)

  const { runConfiguredModes } = await import('./orchestrator')

  let caught: unknown
  await runConfiguredModes().catch(error => {
    caught = error
  })

  expect(caught).toBeInstanceOf(EvalSummaryPersistError)
  // The first error is rethrown; subsequent errors live on `cause`.
  expect((caught as { cause?: unknown }).cause).toBe(persistErrB)
})

it('attaches persistErrors as cause on the threshold-breach throw when both occur', async () => {
  const { EvalSummaryPersistError } = await import('./error')
  mockConfig.evalRunMode = 'all'
  mockConfig.exitOnThresholdBreach = true

  const persistErr = new EvalSummaryPersistError(
    '[evals] traffic-monitor eval summary could not be persisted',
    {
      suite: 'traffic-monitor',
      status: 'threshold_breached',
      passRate: 0.7,
      threshold: 0.85,
      failedEvaluators: ['faithfulness'],
      experimentName: 'traf-x',
      datasetName: 'traf-y',
      phoenixUrl: null,
      totalCases: 10
    }
  )
  mockRunTrafficMonitorSuite.mockRejectedValueOnce(persistErr)

  const { runConfiguredModes } = await import('./orchestrator')

  let caught: unknown
  await runConfiguredModes().catch(error => {
    caught = error
  })

  expect(caught).toBeInstanceOf(Error)
  expect((caught as Error).message).toMatch(
    /Threshold breach exit requested.*traffic-monitor/
  )
  // The DB error is preserved on `cause` so it's not silently dropped.
  expect((caught as { cause?: unknown }).cause).toBe(persistErr)
})
```

- [ ] **Step 2: Run the new tests — expect FAIL**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes/services/evals
bun run test orchestrator.test.ts -t 'preserves all DB-write failures'
bun run test orchestrator.test.ts -t 'attaches persistErrors as cause'
```

Expected: both FAIL — current orchestrator at `orchestrator.ts:73-78` throws `new Error(formatThresholdBreachExitMessage(results))` (no `cause`) and `throw persistErrors[0]` (no chaining of subsequent errors).

- [ ] **Step 3: Modify the orchestrator to attach `cause`**

Edit `services/evals/src/orchestrator.ts`. Replace lines 69–78 with:

```typescript
if (
  config.exitOnThresholdBreach &&
  results.some(result => result.status === 'threshold_breached')
) {
  if (persistErrors.length > 0) {
    console.error(
      `[evals] Threshold breach AND ${persistErrors.length} DB-write failure(s) — see cause chain`
    )
  }
  throw new Error(formatThresholdBreachExitMessage(results), {
    cause: persistErrors[0]
  })
}

if (persistErrors.length > 0) {
  if (persistErrors.length > 1) {
    console.error(
      `[evals] ${persistErrors.length} DB-write failures occurred; first is thrown, rest on cause chain`
    )
    // Chain subsequent errors onto the first via cause.
    let head: Error = persistErrors[0]
    for (let i = 1; i < persistErrors.length; i++) {
      const next: Error = persistErrors[i]
      ;(next as Error & { cause?: unknown }).cause = undefined
      ;(head as Error & { cause?: unknown }).cause = next
      head = next
    }
  }
  throw persistErrors[0]
}
```

- [ ] **Step 4: Run the new tests — expect PASS**

```bash
bun run test orchestrator.test.ts
```

Expected: all orchestrator tests pass, including the two new ones.

- [ ] **Step 5: Run full evals suite to confirm no regression**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes/services/evals
bun run test
```

Expected: all 21 files / 173 tests (171 prior + 2 new) pass.

- [ ] **Step 6: Commit**

```bash
git add services/evals/src/orchestrator.ts services/evals/src/orchestrator.test.ts
git commit -m "fix(evals): preserve DB-write errors via Error.cause when multiple failures or breaches collide"
```

---

## Phase 4 — Architecture refinement

### Task 9: Collapse `WIDGET_CAN_RENDER` into per-entry `{ Component, canRender? }` shape on `WIDGET_REGISTRY` (A1)

**Why:** Two reviewers independently flagged that `components/evals/widgets/registry.ts:40-44` introduces a parallel `Partial<Record<WidgetTypeId, ...>>` predicate map next to `WIDGET_REGISTRY`, when the closest precedent in this codebase — `components/tool-ui/registry.tsx:35-235` — fuses "should I render?" and "render" into a single entry per widget. The parallel-map shape also duplicates logic already inside `divergence-banner.tsx:14-22` (the component returns `null` when its own render conditions aren't met). Collapsing into a per-entry shape removes the duplication, matches the closest precedent, and makes the registry self-documenting: future widgets define visibility and rendering side-by-side.

**Files:**

- Modify: `components/evals/widgets/registry.ts`
- Modify: `components/evals/widgets/layout-renderer.tsx:78-88`
- Modify: `components/evals/widgets/layout-renderer.test.tsx`
- Modify: `components/evals/dashboard-v2/dashboard.test.tsx:144-149`

- [ ] **Step 1: Write a failing test in layout-renderer.test.tsx for the new entry shape (TDD)**

Open `components/evals/widgets/layout-renderer.test.tsx`. The existing test uses `WIDGET_CAN_RENDER`. Add a test that imports the (yet-to-exist) consolidated shape:

```typescript
it('exposes canRender via the per-entry registry shape', async () => {
  const { WIDGET_REGISTRY } = await import('../registry')
  // After Task 9, each entry is `{ Component, canRender? }`.
  const entry = WIDGET_REGISTRY['divergence-banner']
  expect(entry).toHaveProperty('Component')
  expect(entry).toHaveProperty('canRender')
  expect(typeof entry.canRender).toBe('function')
})
```

- [ ] **Step 2: Run — expect FAIL** (current registry exports a `ComponentType`, not an `{ Component, canRender? }` object)

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes
bun run test components/evals/widgets/layout-renderer.test.tsx
```

Expected: the new test fails with `entry.Component` undefined (current entry IS a component, not an object wrapping one).

- [ ] **Step 3: Refactor `registry.ts` to the per-entry shape**

Replace the entire content of `components/evals/widgets/registry.ts` with:

```typescript
import type { ComponentType } from 'react'

import type { WidgetTypeId } from '@/lib/evals/layout/types'
import type { EvalsDashboardData } from '@/lib/evals/types'

import type { WidgetProps } from './shared/widget-props'
import { ActivityFeed } from './activity-feed'
import { CombinedTrendChart } from './combined-trend-chart'
import {
  canRenderDivergenceBanner,
  DivergenceBanner
} from './divergence-banner'
import { EvaluatorBarsWidget } from './evaluator-bars-widget'
import { EvaluatorChipGrid } from './evaluator-chip-grid'
import { EvaluatorComparisonGrid } from './evaluator-comparison-grid'
import { KpiTile } from './kpi-tile'
import { PageHeader } from './page-header'
import { ScoreRingWidget } from './score-ring-widget'
import { SuiteHeaderCard } from './suite-header-card'
import { WhatChangedCard } from './what-changed-card'

export type WidgetEntry = {
  Component: ComponentType<WidgetProps>
  /**
   * Optional predicate. If provided and returns false, LayoutRenderer skips
   * the widget entirely (no wrapper grid slot reserved). When omitted, the
   * widget is always mounted.
   */
  canRender?: (data: EvalsDashboardData) => boolean
}

export const WIDGET_REGISTRY: Record<WidgetTypeId, WidgetEntry> = {
  'page-header': { Component: PageHeader as ComponentType<WidgetProps> },
  'kpi-tile': { Component: KpiTile as ComponentType<WidgetProps> },
  'suite-header-card': {
    Component: SuiteHeaderCard as ComponentType<WidgetProps>
  },
  'score-ring': { Component: ScoreRingWidget as ComponentType<WidgetProps> },
  'combined-trend-chart': {
    Component: CombinedTrendChart as ComponentType<WidgetProps>
  },
  'evaluator-bars': {
    Component: EvaluatorBarsWidget as ComponentType<WidgetProps>
  },
  'evaluator-chip-grid': {
    Component: EvaluatorChipGrid as ComponentType<WidgetProps>
  },
  'evaluator-comparison-grid': {
    Component: EvaluatorComparisonGrid as ComponentType<WidgetProps>
  },
  'divergence-banner': {
    Component: DivergenceBanner as ComponentType<WidgetProps>,
    canRender: canRenderDivergenceBanner
  },
  'what-changed-card': {
    Component: WhatChangedCard as ComponentType<WidgetProps>
  },
  'activity-feed': { Component: ActivityFeed as ComponentType<WidgetProps> }
}
```

- [ ] **Step 4: Update `layout-renderer.tsx` to read from the new shape**

Replace `components/evals/widgets/layout-renderer.tsx:13` import and lines 78–88 of the render block.

Change line 13 from:

```typescript
import { WIDGET_CAN_RENDER, WIDGET_REGISTRY } from './registry'
```

to:

```typescript
import { WIDGET_REGISTRY } from './registry'
```

Change lines 75–91 (the `template.items.map(...)` block) from:

```typescript
{template.items.map(item => {
  const pos = positionById.get(item.id)
  if (!pos) return null
  const canRender = WIDGET_CAN_RENDER[item.type]
  if (canRender && !canRender(data)) return null
  const Component = WIDGET_REGISTRY[item.type]
  return (
    <div
      key={item.id}
      data-widget-id={item.id}
      style={gridStyleFor(pos)}
      className="min-w-0"
    >
      <Component data={data} config={item.config ?? {}} breakpoint={bp} />
    </div>
  )
})}
```

to:

```typescript
{template.items.map(item => {
  const pos = positionById.get(item.id)
  if (!pos) return null
  const entry = WIDGET_REGISTRY[item.type]
  if (entry.canRender && !entry.canRender(data)) return null
  const { Component } = entry
  return (
    <div
      key={item.id}
      data-widget-id={item.id}
      style={gridStyleFor(pos)}
      className="min-w-0"
    >
      <Component data={data} config={item.config ?? {}} breakpoint={bp} />
    </div>
  )
})}
```

- [ ] **Step 5: Update `layout-renderer.test.tsx`**

Search the file for `WIDGET_CAN_RENDER` and replace the assertion(s):

```bash
grep -n "WIDGET_CAN_RENDER" /Users/nick/Projects/vana-v2-admin-evals-fixes/components/evals/widgets/layout-renderer.test.tsx
```

Replace any `WIDGET_CAN_RENDER[item.type]` reference with `WIDGET_REGISTRY[item.type].canRender`. The two existing tests (positive + negative `canRender` cases) should still pass because the underlying `canRenderDivergenceBanner` predicate is unchanged.

- [ ] **Step 6: Update `dashboard.test.tsx`**

Open `components/evals/dashboard-v2/dashboard.test.tsx`. The H6 PR added lines 144–149 that consult `WIDGET_CAN_RENDER`. Update the same way:

```bash
grep -n "WIDGET_CAN_RENDER" /Users/nick/Projects/vana-v2-admin-evals-fixes/components/evals/dashboard-v2/dashboard.test.tsx
```

Change:

```typescript
const canRender = WIDGET_CAN_RENDER[item.type]
if (canRender && !canRender(data)) return
```

to:

```typescript
const entry = WIDGET_REGISTRY[item.type]
if (entry.canRender && !entry.canRender(data)) return
```

And update the import at the top of the file from `WIDGET_CAN_RENDER, WIDGET_REGISTRY` to just `WIDGET_REGISTRY`.

- [ ] **Step 7: Run the full test suite**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes
bun run test
```

Expected: ALL tests pass, including the new "exposes canRender via the per-entry registry shape" test from Step 1.

- [ ] **Step 8: Run typecheck and lint**

```bash
bun typecheck
bun lint
```

Expected: clean. Any consumers of the old `WIDGET_CAN_RENDER` outside the four files we touched will surface here.

- [ ] **Step 9: Commit**

```bash
git add components/evals/widgets/registry.ts components/evals/widgets/layout-renderer.tsx components/evals/widgets/layout-renderer.test.tsx components/evals/dashboard-v2/dashboard.test.tsx
git commit -m "refactor(evals): collapse WIDGET_CAN_RENDER into per-entry registry shape

Match the closest precedent in components/tool-ui/registry.tsx — fuse
\"should I render?\" with \"how to render\" on each registry entry.
Removes the parallel Partial<Record<...>> map; widgets now declare
visibility and rendering side-by-side."
```

---

## Phase 5 — Final verification + push

### Task 10: Run full lint + typecheck + test + build, then push

**Files:** None modified — verification + push.

- [ ] **Step 1: Lint**

```bash
cd /Users/nick/Projects/vana-v2-admin-evals-fixes
bun lint
```

Expected: no errors, no warnings.

- [ ] **Step 2: Typecheck**

```bash
bun typecheck
```

Expected: no errors.

- [ ] **Step 3: Format check**

```bash
bun format:check
```

Expected: clean. If not, run `bun format` and amend the most recent commit.

- [ ] **Step 4: Root test suite**

```bash
bun run test
```

Expected: all files pass; counts should be:

- 138 files → 139 (one new: `components/evals/widgets/__tests__/null-safety.test.tsx`)
- 1258 tests + ~5 new (4 H2 widget cases + 1 registry-shape case) ≈ 1263

- [ ] **Step 5: Evals service test suite**

```bash
cd services/evals
bun run test
cd ../..
```

Expected:

- 21 files (unchanged)
- 171 + ~3 new (1 tightened H1 test 2 — same count, +1 runner-level wrapping test, +2 orchestrator cause-chaining tests) ≈ 174

- [ ] **Step 6: Production build**

```bash
bun run build
```

Expected: success, no errors.

- [ ] **Step 7: Re-run visual smoke (sanity check) at one width**

Start `bun dev`, hit `/admin/evals` at 1280×800, confirm H4–H6 still render correctly after the architecture refactor (Task 9 changed the layout-renderer; visual behavior must be unchanged).

- [ ] **Step 8: Push commits**

```bash
git push origin chore/admin-evals-critical-fixes
```

Expected: push succeeds, GitHub pre-commit hooks (if any) green, CI runs.

- [ ] **Step 9: Verify CI green on PR 174**

```bash
gh pr checks 174 --watch
```

Expected: every check passes.

- [ ] **Step 10: Self-merge readiness**

The PR is now ready to merge. All eight findings (V1, V2, V3, T1, T2, T3, Q1, A1) are resolved with code, tests, and documentation. Merge or request a final review pass per the team's process.

---

## Self-Review Checklist

After implementation, before merge:

- [ ] V1: `pg_constraint` query at Task 1 returned the expected row
- [ ] V2: Visual smoke at four widths passed for H4, H5, H6
- [ ] V3: PR body says "six consumer sites" and both verification checkboxes are ticked
- [ ] T1: Orchestrator H1 test 2 asserts `instanceof EvalSummaryPersistError`
- [ ] T2: New runner-level test in `shared.test.ts` asserts wrapping behavior
- [ ] T3: `findings.test.ts`, `divergences.test.ts` cover null-skipping; new component test file covers the four widgets
- [ ] Q1: Orchestrator chains DB errors via `cause`; multi-suite test passes
- [ ] A1: `registry.ts` exports a single `WIDGET_REGISTRY: Record<WidgetTypeId, WidgetEntry>`; no `WIDGET_CAN_RENDER` references remain anywhere in `components/`, `lib/`, or test files
- [ ] All bun commands at Phase 5 are green
- [ ] CI on the pushed branch is green

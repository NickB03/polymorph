# Admin Evals Critical Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the six HIGH-severity defects identified in the 2026-04-24 admin eval system audit without touching unrelated subsystems.

**Architecture:** Six independent fixes across three surfaces: (1) evals cron service throws a typed error so the orchestrator preserves the threshold-breach exit when the DB write fails; (2) `evaluatorScores` types become truthful about nullable values and every consumer is null-safe; (3) a DB CHECK constraint pins the `suite` enum; (4–6) three UI corrections to the combined-trend chart and layout renderer so the admin dashboard renders cleanly at all breakpoints and never reserves visible empty slots.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Bun, Drizzle ORM, Postgres/Supabase, Vitest, Recharts, shadcn/ui, Tailwind v4.

---

## File structure

| File                                                     | Change | Responsibility                                                                                                                   |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------------------------------------------------------------------- |
| `services/evals/src/error.ts`                            | modify | Add `EvalSummaryPersistError` class carrying `SuiteRunResult`                                                                    |
| `services/evals/src/runners/traffic-monitor.ts`          | modify | Throw typed error instead of raw `Error` on DB-write failure                                                                     |
| `services/evals/src/runners/shared.ts`                   | modify | Same typed-error throw inside `runJudgedSuite`                                                                                   |
| `services/evals/src/orchestrator.ts`                     | modify | Catch typed error, record attached result, re-throw at end after threshold check                                                 |
| `services/evals/src/orchestrator.test.ts`                | modify | Add test: threshold breach + DB-write failure → threshold-breach exit wins                                                       |
| `lib/db/schema.ts`                                       | modify | (H2) `evaluatorScores.$type<Record<string, number \| null>>`; (H3) add `check()` constraint on `suite`                           |
| `lib/evals/types.ts`                                     | modify | `evaluatorScores: Record<string, number \| null>` in both snapshot and row types                                                 |
| `lib/evals/queries.ts`                                   | modify | `computeOverallScore` signature update (implementation already null-safe)                                                        |
| `components/evals/widgets/evaluator-comparison-grid.tsx` | modify | Skip rows where either suite's score is null                                                                                     |
| `components/evals/widgets/activity-feed.tsx`             | modify | Filter nulls before rendering expanded scores list                                                                               |
| `components/evals/evaluator-bars.tsx`                    | modify | Filter nulls from `Object.entries`                                                                                               |
| `drizzle/0020_eval_summaries_suite_check.sql`            | create | Generated migration for H3 CHECK constraint                                                                                      |
| `drizzle/meta/_journal.json`                             | modify | Drizzle journal entry for the new migration                                                                                      |
| `components/evals/widgets/combined-trend-chart.tsx`      | modify | Add `min-w-0 overflow-hidden` wrapper (H4); swap `<Legend />` for shadcn `<ChartLegend content={<ChartLegendContent />} />` (H5) |
| `components/evals/widgets/divergence-banner.tsx`         | modify | Export `canRenderDivergenceBanner(data)` predicate                                                                               |
| `components/evals/widgets/registry.ts`                   | modify | Add `WIDGET_CAN_RENDER` map alongside `WIDGET_REGISTRY`                                                                          |
| `components/evals/widgets/layout-renderer.tsx`           | modify | Skip items whose `canRender` predicate returns false                                                                             |
| `components/evals/widgets/layout-renderer.test.tsx`      | create | Assert divergence slot is absent when the predicate returns false                                                                |

---

## Task 1: Worktree + branch setup

**Files:** none (git only)

- [ ] **Step 1: Create a worktree off main for this plan**

Run:

```bash
git worktree add -b chore/admin-evals-critical-fixes ../vana-v2-admin-evals-fixes main
cd ../vana-v2-admin-evals-fixes
```

Expected: new directory `../vana-v2-admin-evals-fixes` at HEAD of `main`, branch `chore/admin-evals-critical-fixes` checked out.

- [ ] **Step 2: Install deps in the worktree**

Run:

```bash
bun install
```

Expected: lockfile unchanged, `node_modules/` populated.

- [ ] **Step 3: Baseline checks (must be green before touching code)**

Run:

```bash
bun lint && bun typecheck && bun run test
```

Expected: all three commands exit 0. If any fails on `main`, stop and fix first — this plan assumes a green baseline.

---

## Task 2 (H1): Threshold-breach exit survives DB-write failure

**Files:**

- Modify: `services/evals/src/error.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/orchestrator.ts`
- Test: `services/evals/src/orchestrator.test.ts`

**Background:** `.claude/rules/operations.md` documents: "Threshold-gating errors still throw even if the DB write fails." Today, each runner throws `new Error('[evals] <suite> eval summary could not be persisted')` _before_ returning its `SuiteRunResult`, so `orchestrator.ts:44-57` never sees the result and the `exitOnThresholdBreach` check is dead code in the breach-plus-dbfail case. Fix: throw a typed error that carries the result; orchestrator catches, adds result to `results[]`, collects errors, runs the threshold-breach check first, then re-throws any DB errors.

- [ ] **Step 1: Read the current error module**

Run:

```bash
cat services/evals/src/error.ts
```

Note the existing exports — the new class must coexist.

- [ ] **Step 2: Write failing orchestrator test**

Open `services/evals/src/orchestrator.test.ts` and add a new test at the bottom of the outermost `describe` block:

```ts
it('exits via threshold-breach message even when DB write fails during the same suite', async () => {
  const breachedResult: SuiteRunResult = {
    suite: 'traffic-monitor',
    status: 'threshold_breached',
    passRate: 0.7,
    threshold: 0.85,
    failedEvaluators: ['faithfulness'],
    totalCases: 10,
    experimentName: 'exp-x',
    datasetName: 'ds-x',
    phoenixUrl: null
  }

  vi.mocked(runTrafficMonitorSuite).mockRejectedValueOnce(
    new EvalSummaryPersistError(
      '[evals] traffic-monitor eval summary could not be persisted',
      breachedResult
    )
  )
  vi.mocked(runCapabilitySuite).mockResolvedValueOnce(null)
  vi.mocked(runRegressionSuite).mockResolvedValueOnce(null)
  vi.mocked(runSmokeSuite).mockResolvedValueOnce(undefined)

  vi.mocked(config).evalRunMode = 'all'
  vi.mocked(config).exitOnThresholdBreach = true

  await expect(runConfiguredModes()).rejects.toThrow(
    /Threshold breach exit requested.*traffic-monitor/
  )
})
```

Add the missing imports at the top of the file:

```ts
import { EvalSummaryPersistError } from './error'
import type { SuiteRunResult } from './types'
```

If the file already has `vi.mock()` calls for the four runner modules, the `vi.mocked(...)` calls above will work. If not, add `vi.mock('./runners/traffic-monitor')` etc. near the existing mocks — keep the pattern that's already in the test file.

- [ ] **Step 3: Run the test — must fail**

Run:

```bash
cd services/evals && bun run test -- orchestrator
```

Expected: FAIL. Either `EvalSummaryPersistError` import is unresolved, or the current orchestrator re-throws the `Error` before the threshold check.

- [ ] **Step 4: Add `EvalSummaryPersistError` to `services/evals/src/error.ts`**

Append to `services/evals/src/error.ts`:

```ts
import type { SuiteRunResult } from './types'

export class EvalSummaryPersistError extends Error {
  readonly result: SuiteRunResult

  constructor(message: string, result: SuiteRunResult) {
    super(message)
    this.name = 'EvalSummaryPersistError'
    this.result = result
  }
}
```

- [ ] **Step 5: Replace the generic throw in `runners/traffic-monitor.ts`**

In `services/evals/src/runners/traffic-monitor.ts`, change lines 157–167 from:

```ts
  } catch (error) {
    console.error(
      '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new Error(
      '[evals] traffic-monitor eval summary could not be persisted'
    )
  }
```

to:

```ts
  } catch (error) {
    console.error(
      '[evals] DB WRITE FAILED - could not persist traffic-monitor eval summary'
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new EvalSummaryPersistError(
      '[evals] traffic-monitor eval summary could not be persisted',
      result
    )
  }
```

Add the import at the top of the file (near the other service-local imports):

```ts
import { EvalSummaryPersistError } from '../error'
```

- [ ] **Step 6: Replace the generic throw in `runners/shared.ts` (inside `runJudgedSuite`)**

In `services/evals/src/runners/shared.ts`, change lines ~195–203 from:

```ts
  } catch (error) {
    console.error(
      `[evals] DB WRITE FAILED - could not persist ${suite} eval summary`
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new Error(`[evals] ${suite} eval summary could not be persisted`)
  }
```

to:

```ts
  } catch (error) {
    console.error(
      `[evals] DB WRITE FAILED - could not persist ${suite} eval summary`
    )
    console.error(
      `[evals] Error: ${error instanceof Error ? error.message : error}`
    )
    throw new EvalSummaryPersistError(
      `[evals] ${suite} eval summary could not be persisted`,
      result
    )
  }
```

Add the import at the top of the file (sibling of the `withRetry` import area):

```ts
import { EvalSummaryPersistError } from '../error'
```

- [ ] **Step 7: Update orchestrator to catch the typed error and aggregate**

Replace the entire `runConfiguredModes` function in `services/evals/src/orchestrator.ts` with:

```ts
export async function runConfiguredModes(): Promise<SuiteRunResult[]> {
  const results: SuiteRunResult[] = []
  const persistErrors: EvalSummaryPersistError[] = []

  async function runAndRecord(
    runner: () => Promise<SuiteRunResult | null | undefined>
  ) {
    try {
      maybeAddResult(results, await runner())
    } catch (error) {
      if (error instanceof EvalSummaryPersistError) {
        results.push(error.result)
        persistErrors.push(error)
        return
      }
      throw error
    }
  }

  switch (config.evalRunMode) {
    case 'capability':
      await runAndRecord(runCapabilitySuite)
      break
    case 'regression':
      await runAndRecord(runRegressionSuite)
      break
    case 'traffic-monitor':
      await runAndRecord(runTrafficMonitorSuite)
      break
    case 'smoke':
      await runSmokeSuite()
      break
    case 'all':
      await runAndRecord(runCapabilitySuite)
      await runAndRecord(runRegressionSuite)
      await runAndRecord(runTrafficMonitorSuite)
      await runSmokeSuite()
      break
  }

  if (
    config.exitOnThresholdBreach &&
    results.some(result => result.status === 'threshold_breached')
  ) {
    throw new Error(formatThresholdBreachExitMessage(results))
  }

  if (persistErrors.length > 0) {
    throw persistErrors[0]
  }

  return results
}
```

Add the import at the top:

```ts
import { EvalSummaryPersistError } from './error'
```

- [ ] **Step 8: Run the failing test again — it must now pass**

Run:

```bash
cd services/evals && bun run test -- orchestrator
```

Expected: PASS for the new test. All prior tests in the file still PASS.

- [ ] **Step 9: Run the service's full test suite**

Run:

```bash
cd services/evals && bun run test
```

Expected: all pass. In particular, `shared.test.ts:748-801` ("logs THRESHOLD BREACH warning even when persistence fails, then throws the DB-write error") must still pass — the warning still logs before the throw; the throw type has changed but the warning ordering is unaffected.

- [ ] **Step 10: Commit**

Run from the repo root (not inside `services/evals`):

```bash
git add services/evals/src/error.ts services/evals/src/runners/traffic-monitor.ts services/evals/src/runners/shared.ts services/evals/src/orchestrator.ts services/evals/src/orchestrator.test.ts
git commit -m "fix(evals): preserve threshold-breach exit when DB write fails (H1)"
```

---

## Task 3 (H2): `evaluatorScores` types tell the truth about null values

**Files:**

- Modify: `lib/db/schema.ts:581-583`
- Modify: `lib/evals/types.ts:22,53`
- Modify: `lib/evals/queries.ts:18`
- Modify: `components/evals/widgets/evaluator-comparison-grid.tsx:66-69`
- Modify: `components/evals/widgets/activity-feed.tsx:110-126`
- Modify: `components/evals/evaluator-bars.tsx:11-13`

**Background:** `queries.test.ts:78-106` has a regression test explicitly labeled "Historical bug: null was averaged as 0," which confirms jsonb `evaluatorScores` values can be null (e.g. `expectsRefusal` case returning `faithfulness: null`). Schema and types declare `Record<string, number>`, which is a lie. `computeOverallScore` already filters nulls defensively; every _other_ consumer assumes number and will coerce `null * 100 = 0` (silent wrong bar) or throw on `value.toFixed`.

- [ ] **Step 1: Update `lib/evals/types.ts`**

Change line 22 from:

```ts
evaluatorScores: Record<string, number>
```

to:

```ts
evaluatorScores: Record<string, number | null>
```

Change line 53 from:

```ts
evaluatorScores: Record<string, number>
```

to:

```ts
evaluatorScores: Record<string, number | null>
```

- [ ] **Step 2: Update the Drizzle schema $type**

In `lib/db/schema.ts`, change the `evaluatorScores` column definition at lines 581-583 from:

```ts
    evaluatorScores: jsonb('evaluator_scores')
      .$type<Record<string, number>>()
      .notNull(),
```

to:

```ts
    evaluatorScores: jsonb('evaluator_scores')
      .$type<Record<string, number | null>>()
      .notNull(),
```

- [ ] **Step 3: Update `computeOverallScore` signature in `lib/evals/queries.ts`**

Change line 18 from:

```ts
function computeOverallScore(evaluatorScores: Record<string, number>): number {
```

to:

```ts
function computeOverallScore(
  evaluatorScores: Record<string, number | null>
): number {
```

The function body at lines 19-27 already filters nulls correctly — no further change here.

- [ ] **Step 4: Run typecheck to surface every consumer needing a null guard**

Run:

```bash
bun typecheck
```

Expected: errors in (at least) these files — record them for Steps 5–7:

- `components/evals/widgets/evaluator-comparison-grid.tsx`
- `components/evals/widgets/activity-feed.tsx`
- `components/evals/evaluator-bars.tsx`
- possibly `lib/evals/helpers/divergences.ts` and `lib/evals/helpers/findings.ts`

- [ ] **Step 5: Fix `evaluator-comparison-grid.tsx` — skip rows where either score is null**

In `components/evals/widgets/evaluator-comparison-grid.tsx`, change lines 66–69 from:

```ts
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const capValue = cap.evaluatorScores[key] ?? 0
          const trafValue = traf.evaluatorScores[key] ?? 0
          const delta = capValue - trafValue
```

to:

```ts
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const capValue = cap.evaluatorScores[key]
          const trafValue = traf.evaluatorScores[key]
          if (capValue == null || trafValue == null) return null
          const delta = capValue - trafValue
```

(The `return null` inside `.map(...)` is fine — React ignores null children.)

- [ ] **Step 6: Fix `activity-feed.tsx` — filter nulls before rendering**

In `components/evals/widgets/activity-feed.tsx`, change lines 110–126 from:

```tsx
            {Object.entries(row.snapshot.evaluatorScores).map(
              ([key, value]) => (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate text-muted-foreground">
                    {getEvaluatorLabel(key)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${value * 100}%`,
                        backgroundColor: getEvaluatorColor(key)
                      }}
                    />
                  </div>
```

to:

```tsx
            {Object.entries(row.snapshot.evaluatorScores)
              .filter((entry): entry is [string, number] => entry[1] != null)
              .map(([key, value]) => (
                <div key={key} className="flex items-center gap-3 text-xs">
                  <span className="w-32 truncate text-muted-foreground">
                    {getEvaluatorLabel(key)}
                  </span>
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                    <div
                      className="h-full rounded-full"
                      style={{
                        width: `${value * 100}%`,
                        backgroundColor: getEvaluatorColor(key)
                      }}
                    />
                  </div>
```

Make sure the closing `)` / `)` parens at the end of this `.map` block match the new shape — the existing trailing `)` at the end of `.map(...)` stays as-is.

- [ ] **Step 7: Fix `evaluator-bars.tsx` — update type and filter nulls**

In `components/evals/evaluator-bars.tsx`, change lines 11–13 from:

```ts
  evaluatorScores: Record<string, number>
}) {
  const entries = Object.entries(evaluatorScores).sort((left, right) => {
```

to:

```ts
  evaluatorScores: Record<string, number | null>
}) {
  const entries = Object.entries(evaluatorScores)
    .filter((entry): entry is [string, number] => entry[1] != null)
    .sort((left, right) => {
```

- [ ] **Step 8: Re-run typecheck**

Run:

```bash
bun typecheck
```

Expected: exit 0. If `lib/evals/helpers/divergences.ts` or `lib/evals/helpers/findings.ts` still error, they already have correct null handling — the fix is to update the parameter types in those helpers to `Record<string, number | null>` to match. Update as needed.

- [ ] **Step 9: Run the evals test file**

Run:

```bash
bun run test -- lib/evals
```

Expected: all pass. The "Historical bug" regression test at `queries.test.ts:78-106` must still pass — the behavior is unchanged, only the types are now truthful.

- [ ] **Step 10: Commit**

```bash
git add lib/db/schema.ts lib/evals/types.ts lib/evals/queries.ts components/evals/widgets/evaluator-comparison-grid.tsx components/evals/widgets/activity-feed.tsx components/evals/evaluator-bars.tsx lib/evals/helpers/
git commit -m "fix(evals): type evaluatorScores values as nullable and null-safe consumers (H2)"
```

---

## Task 4 (H3): Add DB-level CHECK constraint on `suite` enum

**Files:**

- Modify: `lib/db/schema.ts:588-608` (add `check()` entry inside the `table => [...]` array)
- Create: `drizzle/0020_eval_summaries_suite_check.sql` (generated)
- Modify: `drizzle/meta/_journal.json` (auto-updated by drizzle-kit)

**Background:** Drizzle's `enum: [...]` key on varchar is TypeScript-only — it does not emit a DB CHECK constraint. A typo in the evals service would insert silently and break `SUITE_LABELS[snapshot.suite]` at the dashboard layer.

- [ ] **Step 1: Add the CHECK constraint in schema.ts**

In `lib/db/schema.ts`, inside the `table => [ ... ]` array that begins at line 588, add a new `check(...)` entry after the existing range checks (after the `eval_summaries_threshold_bps_range` entry, before the `pgPolicy`):

```ts
    check(
      'eval_summaries_suite_enum',
      sql`${table.suite} IN ('capability', 'regression', 'traffic-monitor')`
    ),
```

The final array should have three `check()` entries followed by the `pgPolicy`.

- [ ] **Step 2: Generate the migration**

Run:

```bash
bun run drizzle-kit generate
```

Expected: a new file `drizzle/0020_<drizzle-assigned-name>.sql` appears with the ALTER TABLE ADD CONSTRAINT. `drizzle/meta/_journal.json` gets a new entry.

If drizzle-kit names the file differently than `0020_eval_summaries_suite_check.sql`, keep the generated name — don't rename manually (the journal will be out of sync).

- [ ] **Step 3: Inspect the migration**

Run:

```bash
cat drizzle/0020_*.sql
```

Expected output contains something like:

```sql
ALTER TABLE "eval_summaries" ADD CONSTRAINT "eval_summaries_suite_enum" CHECK ("eval_summaries"."suite" IN ('capability', 'regression', 'traffic-monitor'));
```

If the migration also contains unrelated changes (drift from some other recent edit), stop — do not commit. Reset the file and investigate.

- [ ] **Step 4: Apply to local Postgres**

If local Supabase isn't running:

```bash
npx supabase start
```

Then:

```bash
bun run migrate
```

Expected: migration applies cleanly against a local DB that already has eval_summaries rows matching the enum. If existing rows violate the CHECK, the migration will fail — that means someone already wrote a bad `suite` value, which is itself a bug to investigate.

- [ ] **Step 5: Verify the constraint is active**

Run:

```bash
PGPASSWORD=postgres psql -h 127.0.0.1 -p 44322 -U postgres -d postgres -c "\d+ eval_summaries" | grep -A1 suite_enum
```

Expected: shows `"eval_summaries_suite_enum" CHECK (suite IN ('capability', 'regression', 'traffic-monitor'))`.

- [ ] **Step 6: Run tests**

```bash
bun run test -- lib/evals lib/db
```

Expected: all pass. No test touches the CHECK directly; this is a belt-and-suspenders guard.

- [ ] **Step 7: Commit**

```bash
git add lib/db/schema.ts drizzle/0020_*.sql drizzle/meta/_journal.json
git commit -m "fix(evals): enforce suite enum via DB CHECK constraint (H3)"
```

---

## Task 5 (H4): Fix combined-trend-chart overflow at narrow widths

**Files:**

- Modify: `components/evals/widgets/combined-trend-chart.tsx:44-60`

**Background:** At viewport widths ≤768px the Recharts wrapper extends hundreds of pixels past its parent card because no ancestor in the chain sets `min-width: 0`. Flex/grid children don't shrink below their intrinsic content width unless explicitly told to, and `ChartContainer → ResponsiveContainer → recharts-wrapper` inherits the bug.

- [ ] **Step 1: Add min-width/overflow guards to the populated-state Card**

In `components/evals/widgets/combined-trend-chart.tsx`, change lines 43–50 from:

```tsx
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">
          {config.title ?? 'Trend · both suites overlaid'}
        </CardTitle>
      </CardHeader>
      <CardContent>
```

to:

```tsx
  return (
    <Card className="h-full min-w-0 overflow-hidden">
      <CardHeader>
        <CardTitle className="text-base">
          {config.title ?? 'Trend · both suites overlaid'}
        </CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
```

- [ ] **Step 2: Verify visually**

Start the dev server:

```bash
bun dev
```

Open `http://localhost:43100/admin/evals` (sign in if prompted), resize the window to 768px and 430px widths, and confirm the combined-trend card fits inside its grid cell at both sizes. The chart should re-flow with the Card, not spill past it.

If the page doesn't render the combined-trend widget, switch to Template B via the layout switcher (top-right of the dashboard).

- [ ] **Step 3: Run the existing chart tests (if any)**

```bash
bun run test -- combined-trend
```

Expected: pass. If the test file doesn't exist, no action needed — this change is structural CSS.

- [ ] **Step 4: Commit**

```bash
git add components/evals/widgets/combined-trend-chart.tsx
git commit -m "fix(evals): prevent combined-trend chart overflow at narrow widths (H4)"
```

---

## Task 6 (H5): Combined-trend chart legend shows configured labels, not dataKeys

**Files:**

- Modify: `components/evals/widgets/combined-trend-chart.tsx:5,86`

**Background:** Plain Recharts `<Legend />` ignores the `ChartContainer` config and falls back to the raw `dataKey` strings. The shadcn chart component already exports `ChartLegend` (a direct alias for `RechartsPrimitive.Legend`) and `ChartLegendContent` which reads `config.label` from context.

- [ ] **Step 1: Swap the recharts `Legend` import for the shadcn chart exports**

In `components/evals/widgets/combined-trend-chart.tsx`, change line 5 from:

```ts
import { CartesianGrid, Legend, Line, LineChart, XAxis, YAxis } from 'recharts'
```

to:

```ts
import { CartesianGrid, Line, LineChart, XAxis, YAxis } from 'recharts'
```

Then change lines 10-14 from:

```ts
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
```

to:

```ts
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
```

- [ ] **Step 2: Swap `<Legend />` for the shadcn equivalent**

In the same file, change line 86 from:

```tsx
<Legend />
```

to:

```tsx
<ChartLegend content={<ChartLegendContent />} />
```

- [ ] **Step 3: Verify visually**

With the dev server still running, reload `/admin/evals` on Template B and confirm the legend reads `Capability` and `Traffic Monitor` (the configured labels) — not `capability` and `trafficMonitor`.

- [ ] **Step 4: Typecheck**

```bash
bun typecheck
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/evals/widgets/combined-trend-chart.tsx
git commit -m "fix(evals): show human labels in combined-trend legend (H5)"
```

---

## Task 7 (H6): Skip the grid slot when a widget chooses not to render

**Files:**

- Modify: `components/evals/widgets/divergence-banner.tsx`
- Modify: `components/evals/widgets/registry.ts`
- Modify: `components/evals/widgets/layout-renderer.tsx`
- Create: `components/evals/widgets/layout-renderer.test.tsx`

**Background:** `DivergenceBanner` returns `null` when cap/traf is missing or divergences is empty, but `LayoutRenderer` still emits a wrapper `<div style={{ minHeight: pos.h * 64 + ... }}>` — reserving an empty 64px band. Fix: each widget can export a `canRender(data)` predicate; the renderer consults a registry map and skips the wrapper entirely when false.

- [ ] **Step 1: Write the failing test**

Create `components/evals/widgets/layout-renderer.test.tsx`:

```tsx
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { LayoutRenderer } from './layout-renderer'

function buildData(overrides: Partial<EvalsDashboardData>): EvalsDashboardData {
  const emptySuite = {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  }
  return {
    capability: emptySuite,
    regression: emptySuite,
    trafficMonitor: emptySuite,
    ...overrides
  }
}

describe('LayoutRenderer', () => {
  it('does not render a grid slot for a widget whose canRender returns false', () => {
    const template = {
      id: 'b' as const,
      name: 'Test',
      description: 'Test',
      items: [{ id: 'divergence', type: 'divergence-banner' as const }],
      layouts: {
        lg: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }],
        md: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }],
        sm: [{ i: 'divergence', x: 0, y: 0, w: 12, h: 1 }]
      }
    }

    // Neither suite has data → DivergenceBanner's canRender must return false
    const capabilityLatestOnly = buildData({
      capability: {
        latest: {
          id: 'cap-1',
          suite: 'capability',
          experimentName: 'x',
          datasetName: 'x',
          passRate: 0.9,
          threshold: null,
          thresholdBreached: false,
          failedEvaluators: [],
          overallScore: 0.9,
          evaluatorScores: { faithfulness: 0.9 },
          totalCases: 10,
          phoenixUrl: null,
          createdAt: new Date().toISOString()
        },
        previous: null,
        trend: [],
        lastUpdated: null
      }
    })

    const { container } = render(
      <LayoutRenderer template={template} data={capabilityLatestOnly} />
    )
    expect(container.querySelector('[data-widget-id="divergence"]')).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to confirm it fails**

```bash
bun run test -- layout-renderer
```

Expected: FAIL — current renderer emits the wrapper div regardless of widget output.

- [ ] **Step 3: Export the predicate from `divergence-banner.tsx`**

Append to `components/evals/widgets/divergence-banner.tsx` (after the `DivergenceBanner` component):

```ts
import type { EvalsDashboardData } from '@/lib/evals/types'

export function canRenderDivergenceBanner(data: EvalsDashboardData): boolean {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  if (!cap || !traf) return false
  return (
    computeDivergences(cap.evaluatorScores, traf.evaluatorScores).length > 0
  )
}
```

(`computeDivergences` is already imported at the top of the file, so no new import needed for it. The `EvalsDashboardData` import is new — if `divergence-banner.tsx` doesn't already import it, add the new import line shown above.)

- [ ] **Step 4: Add `WIDGET_CAN_RENDER` to the registry**

Open `components/evals/widgets/registry.ts` and append a new exported map at the bottom of the file:

```ts
import type { EvalsDashboardData } from '@/lib/evals/types'

import { canRenderDivergenceBanner } from './divergence-banner'

import type { WidgetTypeId } from '@/lib/evals/layout/types'

export const WIDGET_CAN_RENDER: Partial<
  Record<WidgetTypeId, (data: EvalsDashboardData) => boolean>
> = {
  'divergence-banner': canRenderDivergenceBanner
}
```

(A `Partial<Record>` means: entries that aren't present default to "always render.")

- [ ] **Step 5: Filter items in the layout renderer**

In `components/evals/widgets/layout-renderer.tsx`, change lines 13–14 from:

```ts
import { EvalsEmptyState } from './empty-state'
import { WIDGET_REGISTRY } from './registry'
```

to:

```ts
import { EvalsEmptyState } from './empty-state'
import { WIDGET_CAN_RENDER, WIDGET_REGISTRY } from './registry'
```

Then change the `{template.items.map(...)}` block at lines 75–89 from:

```tsx
{
  template.items.map(item => {
    const pos = positionById.get(item.id)
    if (!pos) return null
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
  })
}
```

to:

```tsx
{
  template.items.map(item => {
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
  })
}
```

- [ ] **Step 6: Re-run the test — it must pass**

```bash
bun run test -- layout-renderer
```

Expected: PASS. The `data-widget-id="divergence"` element is absent when only capability has data.

- [ ] **Step 7: Run the broader dashboard test file**

```bash
bun run test -- components/evals
```

Expected: all pass. Specifically, `dashboard-v2/dashboard.test.tsx` (which exercises LayoutRenderer transitively) must still be green.

- [ ] **Step 8: Visual check**

Reload `/admin/evals` on Template B with a dataset where only capability has runs and trafficMonitor is empty. The divergence band that previously rendered as a thin empty strip should now be gone; the cards below move up to close the gap.

- [ ] **Step 9: Commit**

```bash
git add components/evals/widgets/divergence-banner.tsx components/evals/widgets/registry.ts components/evals/widgets/layout-renderer.tsx components/evals/widgets/layout-renderer.test.tsx
git commit -m "fix(evals): skip grid slot when widget opts out of rendering (H6)"
```

---

## Task 8: Final verification

**Files:** none (validation only)

- [ ] **Step 1: Full lint + typecheck**

```bash
bun lint && bun typecheck
```

Expected: both exit 0. Fix any warning you introduced, even if it looks unrelated — per CLAUDE.md: "Fix every warning, not just the ones your changes introduced."

- [ ] **Step 2: Full test suite (web app)**

```bash
bun run test
```

Expected: all pass.

- [ ] **Step 3: Full test suite (evals service)**

```bash
cd services/evals && bun run test && cd -
```

Expected: all pass.

- [ ] **Step 4: Format check**

```bash
bun format:check
```

If it fails, run `bun format` and amend the most recent commit (or add a format-only commit).

- [ ] **Step 5: Production build**

```bash
bun run build
```

Expected: success. A Next.js build failure usually means a hidden TS error or a client/server boundary mistake.

- [ ] **Step 6: Manual smoke test at `/admin/evals`**

With dev server running, load `/admin/evals` and switch through Templates A, B, C. Confirm:

- Header renders with "Last updated" timestamp
- No widget emits a blank reserved strip
- The combined-trend chart fits its card at 1920, 1280, 768, 430px widths
- Legend reads `Capability` and `Traffic Monitor`
- Browser console is clean (no errors, no hydration warnings)

- [ ] **Step 7: Open PR**

```bash
git push -u origin chore/admin-evals-critical-fixes
gh pr create --title "Admin evals critical fixes (H1–H6)" --body "$(cat <<'EOF'
## Summary
- H1: Threshold-breach exit now survives DB-write failure via new `EvalSummaryPersistError` carrying the `SuiteRunResult`.
- H2: `evaluatorScores` typed as `Record<string, number | null>` everywhere; all consumers handle null.
- H3: `eval_summaries.suite` now has a DB CHECK constraint — typos can no longer insert silently.
- H4: Combined-trend chart no longer overflows at narrow widths (`min-w-0` + `overflow-hidden` on the card).
- H5: Legend shows `Capability` / `Traffic Monitor` instead of raw dataKeys (shadcn `ChartLegendContent`).
- H6: Grid slots no longer reserve empty space when a widget's `canRender(data)` predicate is false.

## Test plan
- [ ] `bun lint && bun typecheck && bun run test` green
- [ ] `cd services/evals && bun run test` green
- [ ] Manual QA of `/admin/evals` across Templates A/B/C at 1920/1280/768/430px
- [ ] Local Postgres migration applies cleanly

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL to the user.

---

## Verification hooks for the reviewer

Each of the six fixes has a concrete artifact the reviewer can point at:

| Fix | Artifact the reviewer should verify                                                                                                                                                               |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | `services/evals/src/orchestrator.test.ts` now contains a test that throws `EvalSummaryPersistError` _and_ asserts the thrown message matches `/Threshold breach exit requested.*traffic-monitor/` |
| H2  | `grep -r "Record<string, number>" lib/evals components/evals` returns zero matches against evaluator scores (only the Drizzle `.$type<Record<string, number \| null>>()` should exist)            |
| H3  | `psql ... "\d+ eval_summaries"` shows the `eval_summaries_suite_enum` CHECK constraint                                                                                                            |
| H4  | Dev-server screenshot at 768px shows the combined-trend card not overflowing                                                                                                                      |
| H5  | Dev-server screenshot shows legend labels `Capability` and `Traffic Monitor`                                                                                                                      |
| H6  | `layout-renderer.test.tsx` passes and DOM has no `[data-widget-id="divergence"]` when conditions not met                                                                                          |

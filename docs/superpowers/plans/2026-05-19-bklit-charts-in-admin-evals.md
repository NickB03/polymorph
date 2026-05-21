# bklit Charts in Admin Evals Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring bklit-ui's fluid chart animations into the `/admin/evals` dashboard without changing what the page does — replace the bespoke SVG ring in `score-feature.tsx` with bklit's Gauge, and add Area + Radar chart visualizations alongside existing UI.

**Architecture:** bklit-ui is a charts-only library installed per-component via the shadcn registry. We install 3 charts (Gauge, Area, Radar) sharing one peer-dep footprint (visx + motion + d3-shape + @number-flow/react). One swap (Gauge replaces a hand-rolled SVG that already _is_ a gauge) and two additions (Area in the History view, Radar above the Evaluator Breakdown). The bespoke threshold copy that lived inside the current ring moves to a caption below the new Gauge — same information, same status colors, animated transitions added. Status colors are mapped via the existing `STATUS_TOKENS[suite].cssVar` so the new charts adopt the dashboard's accent-blue/warning/destructive palette without a separate theming layer.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript (strict), Tailwind v4, shadcn/ui, bklit-ui charts via shadcn registry, visx, motion (already installed), vitest + RTL.

---

## File Structure

| Path                                                         | Role                                                  | Created or modified       |
| ------------------------------------------------------------ | ----------------------------------------------------- | ------------------------- |
| `package.json`                                               | Add chart peer deps via shadcn CLI                    | Modified (auto)           |
| `components.json`                                            | Add `charts` alias if not present                     | Modified                  |
| `components/charts/gauge.tsx` (+ 4 helper files)             | bklit Gauge component                                 | Created (shadcn registry) |
| `components/charts/area-chart.tsx` (+ helpers)               | bklit Area chart                                      | Created (shadcn registry) |
| `components/charts/radar-chart.tsx` (+ helpers)              | bklit Radar chart                                     | Created (shadcn registry) |
| `components/evals/dashboard/score-feature.tsx`               | Swap SVG ring → `<Gauge>`; threshold copy moves below | Modified                  |
| `components/evals/dashboard/score-feature.test.tsx`          | New test covering swap                                | Created                   |
| `components/evals/dashboard/activity-list.tsx`               | Add `<AreaChart>` trend above the rows                | Modified                  |
| `components/evals/dashboard/activity-list.test.tsx`          | Extend coverage for chart                             | Modified                  |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx`      | Add `<RadarChart>` above the bar list                 | Modified                  |
| `components/evals/dashboard-v2/evaluator-breakdown.test.tsx` | Extend coverage for radar                             | Modified                  |
| `lib/evals/helpers/trend.ts`                                 | Build trend dataset shape for Area chart              | Created                   |
| `lib/evals/helpers/trend.test.ts`                            | Test the trend builder                                | Created                   |

**Notes on responsibility boundaries:**

- Pure data shaping (`trend.ts`) lives in `lib/evals/helpers/` next to `status.ts`. Components stay rendering-only.
- Each chart file is a thin wrapper over the bklit primitive — no domain logic.
- Test files mirror their component path.

---

## Task 1: Install bklit chart foundation

**Files:**

- Modify: `package.json` (peer deps auto-added)
- Create: `components/charts/gauge.tsx` + 4 helpers (auto, via shadcn registry)
- Create: `components/charts/area-chart.tsx` + helpers (auto)
- Create: `components/charts/radar-chart.tsx` + helpers (auto)
- Modify: `components.json` if a charts alias is needed

- [ ] **Step 1: Verify install target alias**

Open `components.json` and confirm `aliases.components` is `@/components`. The bklit registry installs files into `components/charts/...`, which resolves to `@/components/charts/...`. No alias changes needed unless the install fails to resolve paths.

Run: `cat components.json`
Expected: `"components": "@/components"` present in the `aliases` block. If not, add `"charts": "@/components/charts"` and re-run.

- [ ] **Step 2: Install Gauge chart**

Run: `bunx shadcn@latest add https://ui.bklit.com/r/gauge-chart.json`

When prompted, accept the default install location (`components/charts/`). The CLI will add peer dependencies `@visx/responsive`, `@visx/pattern`, `@number-flow/react`, `motion` (already present), and `d3-shape`.

Expected output: 5 files written under `components/charts/`:

- `chart-stat-flow.tsx`
- `pie-context.tsx`
- `pie-center-shell.tsx`
- `pie-center.tsx`
- `gauge.tsx`

- [ ] **Step 3: Install Area chart**

Run: `bunx shadcn@latest add https://ui.bklit.com/r/area-chart.json`

Expected: adds `area-chart.tsx`, `area.tsx`, `grid.tsx`, `x-axis.tsx`, `chart-tooltip.tsx` under `components/charts/`, plus peer deps `@visx/shape`, `@visx/curve`, `@visx/scale`, `@visx/gradient`, `@visx/event`, `@visx/grid`, `d3-array`, `react-use-measure`.

- [ ] **Step 4: Install Radar chart**

Run: `bunx shadcn@latest add https://ui.bklit.com/r/radar-chart.json`

Expected: adds `radar-chart.tsx`, `radar-grid.tsx`, `radar-axis.tsx`, `radar-labels.tsx`, `radar-area.tsx`, `use-radar.ts` (or similar names) under `components/charts/`.

- [ ] **Step 5: Confirm install via typecheck**

Run: `bun typecheck`
Expected: PASS — no new TypeScript errors. If `motion` version conflicts (project pins `^12.38.0`), accept the registry's version request.

- [ ] **Step 6: Confirm install via lint**

Run: `bun lint`
Expected: PASS. The repo's eslint config will likely flag bklit's generated files for import order or `any` usage. If so, add the `components/charts/` directory to ESLint ignore for generated registry files: edit `.eslintignore` (or `eslint.config.mjs` ignore block) to include `components/charts/**`.

- [ ] **Step 7: Commit**

```bash
git add components/charts package.json bun.lock components.json .eslintignore
git commit -m "$(cat <<'EOF'
feat(evals): install bklit-ui Gauge, Area, Radar charts

Adds the shadcn-registry components into components/charts and pulls in
visx + d3-shape + @number-flow/react peer deps. No call sites wired up
yet — that's tasks 2-4.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Replace `ScoreFeature` SVG ring with bklit Gauge

**Files:**

- Modify: `components/evals/dashboard/score-feature.tsx:72-150`
- Create: `components/evals/dashboard/score-feature.test.tsx`

- [ ] **Step 1: Write the failing test**

Create `components/evals/dashboard/score-feature.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ScoreFeature } from './score-feature'

const SNAP: EvalSummarySnapshot = {
  id: 'cap-1',
  suite: 'capability',
  experimentName: 'eval-fixture',
  datasetName: 'fixture-dataset',
  passRate: 0.9,
  threshold: 0.85,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.88,
  evaluatorScores: { faithfulness: 0.9 },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-05-19T12:00:00.000Z'
}

function renderFeature(
  snap = SNAP,
  previous: EvalSummarySnapshot | null = null
) {
  return render(
    <TooltipProvider>
      <ScoreFeature cap={snap} previous={previous} />
    </TooltipProvider>
  )
}

describe('ScoreFeature', () => {
  it('renders the overall score percentage', () => {
    renderFeature()
    expect(screen.getByText('88%')).toBeInTheDocument()
  })

  it('renders the threshold comparison caption when above threshold', () => {
    renderFeature()
    expect(screen.getByText(/vs threshold 85%/)).toBeInTheDocument()
  })

  it('renders below-threshold copy when score is below threshold', () => {
    renderFeature({ ...SNAP, overallScore: 0.8, thresholdBreached: true })
    expect(screen.getByText(/pts below 85%/)).toBeInTheDocument()
  })

  it('renders aggregate copy when threshold is null', () => {
    renderFeature({ ...SNAP, threshold: null })
    expect(screen.getByText('aggregate')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run the new test to verify it fails for the right reason**

Run: `bun run test -- components/evals/dashboard/score-feature.test.tsx`
Expected: All four tests run. First test (`renders the overall score percentage`) may already pass against the current SVG output; the threshold-copy tests should pass too because the current implementation already renders this copy. Goal at this step is just confirming the test file imports and runs. If everything passes, proceed — these tests will continue to pass after the swap, which is the contract we want.

- [ ] **Step 3: Implement the Gauge swap**

Replace `components/evals/dashboard/score-feature.tsx` with:

```tsx
'use client'

import { type ReactNode } from 'react'

import { useReducedMotion } from 'motion/react'

import { getSuiteDisplay } from '@/lib/evals/display'
import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import { getSuiteStatus, STATUS_TOKENS } from '@/lib/evals/helpers/status'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { Gauge } from '@/components/charts/gauge'

import { AggregateBreakdown, DefinedTerm } from '@/components/evals/glossary'

import { pct } from './shared'

export function ScoreFeature({
  cap,
  previous,
  hideTagline = false,
  footer
}: {
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
  hideTagline?: boolean
  footer?: ReactNode
}) {
  const reducedMotion = useReducedMotion()
  const score = Math.max(0, Math.min(1, cap.overallScore))
  const scorePercent = Math.round(score * 100)
  const suiteKey = snapshotSuiteKey(cap)
  const suiteCopy = getSuiteDisplay(cap.suite)
  const definition = DEFINITIONS[suiteKey]

  const suiteStatus = getSuiteStatus(cap, previous)
  const tokens = STATUS_TOKENS[suiteStatus]
  const gaugeFill = tokens.cssVar

  const thresholdGap =
    cap.threshold == null ? null : (cap.overallScore - cap.threshold) * 100
  const isBelowThreshold = thresholdGap != null && thresholdGap < 0
  const belowThresholdColor =
    suiteStatus === 'BLOCKED' ? 'text-destructive' : 'text-warning'

  return (
    <section className="flex flex-col rounded-xl border border-border bg-card">
      <div className="flex flex-col gap-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Active suite
            </span>
            <h2 className="text-base font-semibold tracking-tight">
              <DefinedTerm def={definition}>{suiteCopy.label}</DefinedTerm>
            </h2>
          </div>
        </div>
        {hideTagline ? null : (
          <p className="-mt-3 text-xs leading-snug text-muted-foreground">
            {suiteCopy.tagline}
          </p>
        )}

        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              aria-label={`${suiteCopy.label} score: ${pct(score)}. Focus or hover for per-judge breakdown.`}
              className="mx-auto flex h-44 w-44 cursor-help appearance-none items-center justify-center border-0 bg-transparent p-0 font-[inherit] text-inherit transition-opacity hover:opacity-90"
            >
              <Gauge
                value={scorePercent}
                centerValue={scorePercent}
                suffix="%"
                defaultLabel={suiteCopy.label}
                activeFill={gaugeFill}
                inactiveFillOpacity={0.3}
                minWidth={176}
                animate={!reducedMotion}
              />
            </button>
          </TooltipTrigger>
          <TooltipContent
            side="right"
            align="center"
            sideOffset={12}
            collisionPadding={16}
            className="max-w-xs space-y-2 text-xs leading-relaxed"
          >
            <AggregateBreakdown
              suiteLabel={suiteCopy.label}
              suite={suiteKey}
              snap={cap}
              score={score}
            />
          </TooltipContent>
        </Tooltip>

        {cap.threshold == null ? (
          <p className="text-center text-xs text-muted-foreground">aggregate</p>
        ) : isBelowThreshold ? (
          <p
            className={cn(
              'text-center text-xs font-medium',
              belowThresholdColor
            )}
          >
            {Math.abs(Math.round(thresholdGap))} pts below {pct(cap.threshold)}
          </p>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            vs threshold {pct(cap.threshold)}
          </p>
        )}
      </div>
      {footer ? <div className="px-5 pb-5 pt-2">{footer}</div> : null}
    </section>
  )
}
```

The `animate` prop may not be in bklit's typings — if so, drop it and bklit's internal `useReducedMotion` will handle it. If the typings allow it, this gives us an explicit guarantee.

- [ ] **Step 4: Verify the Gauge typing supports the `animate` prop**

Run: `bun typecheck`
Expected: PASS. If `animate` is rejected, remove that line — bklit's `motion` library respects `prefers-reduced-motion` natively. If `activeFill` rejects `var(--…)` strings (because typings narrow to a hex pattern), assert through with `activeFill={gaugeFill as string}` — this is unavoidable: the bklit registry's types may be overly narrow for hex codes.

- [ ] **Step 5: Run the tests**

Run: `bun run test -- components/evals/dashboard/score-feature.test.tsx`
Expected: All four tests PASS. The Gauge renders the percentage via `@number-flow/react` which should produce visible `"88%"` text. If `getByText('88%')` fails because NumberFlow splits digits into spans, fall back to:

```tsx
expect(screen.getByLabelText(/Capability score: 88%/i)).toBeInTheDocument()
```

…or query by `aria-label` on the gauge button.

- [ ] **Step 6: Manually verify in the browser**

Run: `bun dev` (port 43100). Navigate to `http://localhost:43100/admin/evals` and confirm:

- Gauge mounts with arc animating from 0 to the score value.
- Center number shows the score with `%` suffix.
- Threshold caption appears below the gauge (not inside it).
- Switching suites in the suite-selector updates the gauge color (blue for healthy, warning for caution, destructive for failing).

If the live Gauge color doesn't match the status palette, the `activeFill` prop is being ignored. Confirm by inspecting the SVG `<path>` `fill` attribute in DevTools and adjust per bklit's exact prop expectation.

- [ ] **Step 7: Commit**

```bash
git add components/evals/dashboard/score-feature.tsx components/evals/dashboard/score-feature.test.tsx
git commit -m "$(cat <<'EOF'
refactor(evals): swap bespoke SVG ring for bklit Gauge in ScoreFeature

The bespoke <circle stroke-dashoffset> implementation is functionally a
gauge. Switching to bklit's Gauge gets us spring-physics arc easing and
NumberFlow center transitions for free, with no semantic change.

Threshold copy moves to a caption below the gauge so the bespoke center
text doesn't have to be re-implemented inside Gauge's <RingCenter>-style
slot (which only accepts SVG defs, not arbitrary children).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Add Area chart trend to ActivityList header

**Files:**

- Create: `lib/evals/helpers/trend.ts`
- Create: `lib/evals/helpers/trend.test.ts`
- Modify: `components/evals/dashboard/activity-list.tsx`
- Modify: `components/evals/dashboard/activity-list.test.tsx`

- [ ] **Step 1: Write the failing test for `buildTrendSeries`**

Create `lib/evals/helpers/trend.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { buildTrendSeries } from './trend'

const snap = (
  suite: EvalSummarySnapshot['suite'],
  overallScore: number,
  createdAt: string
): EvalSummarySnapshot => ({
  id: `${suite}-${createdAt}`,
  suite,
  experimentName: 'x',
  datasetName: 'd',
  passRate: 0,
  threshold: null,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore,
  evaluatorScores: {},
  totalCases: 0,
  attemptedCases: 0,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt
})

describe('buildTrendSeries', () => {
  it('returns empty array for no input', () => {
    expect(buildTrendSeries([])).toEqual([])
  })

  it('joins snapshots from multiple suites on shared timestamps', () => {
    const points = buildTrendSeries([
      snap('capability', 0.9, '2026-05-19T10:00:00Z'),
      snap('regression', 0.8, '2026-05-19T10:00:00Z'),
      snap('capability', 0.85, '2026-05-19T11:00:00Z')
    ])

    expect(points).toHaveLength(2)
    expect(points[0]).toMatchObject({
      capability: 90,
      regression: 80
    })
    expect(points[1]).toMatchObject({
      capability: 85
    })
    expect(points[1].regression).toBeNull()
  })

  it('sorts points chronologically', () => {
    const points = buildTrendSeries([
      snap('capability', 0.7, '2026-05-19T12:00:00Z'),
      snap('capability', 0.9, '2026-05-19T10:00:00Z')
    ])
    expect(points[0].createdAt.getTime()).toBeLessThan(
      points[1].createdAt.getTime()
    )
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- lib/evals/helpers/trend.test.ts`
Expected: FAIL with "Cannot find module './trend'".

- [ ] **Step 3: Implement `buildTrendSeries`**

Create `lib/evals/helpers/trend.ts`:

```ts
import type {
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'

const SUITE_KEYS: PersistedDashboardSuite[] = [
  'capability',
  'traffic-monitor',
  'regression'
]

const SUITE_ALIAS: Record<
  PersistedDashboardSuite,
  'capability' | 'trafficMonitor' | 'regression'
> = {
  capability: 'capability',
  'traffic-monitor': 'trafficMonitor',
  regression: 'regression'
}

export interface TrendPoint {
  createdAt: Date
  capability: number | null
  trafficMonitor: number | null
  regression: number | null
}

export function buildTrendSeries(
  snapshots: ReadonlyArray<EvalSummarySnapshot>
): TrendPoint[] {
  if (snapshots.length === 0) return []

  const byTimestamp = new Map<string, TrendPoint>()
  for (const snap of snapshots) {
    const key = snap.createdAt
    const existing =
      byTimestamp.get(key) ??
      ({
        createdAt: new Date(snap.createdAt),
        capability: null,
        trafficMonitor: null,
        regression: null
      } satisfies TrendPoint)
    existing[SUITE_ALIAS[snap.suite]] = Math.round(snap.overallScore * 100)
    byTimestamp.set(key, existing)
  }

  return [...byTimestamp.values()].sort(
    (a, b) => a.createdAt.getTime() - b.createdAt.getTime()
  )
}

export const TREND_SUITES = SUITE_KEYS
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- lib/evals/helpers/trend.test.ts`
Expected: All 3 tests PASS.

- [ ] **Step 5: Wire Area chart into `ActivityList`**

Modify `components/evals/dashboard/activity-list.tsx` — add an Area chart panel at the top of the returned section (above the rows table). Replace the existing `<section>` return body with:

```tsx
import {
  AreaChart,
  Area,
  Grid,
  XAxis,
  ChartTooltip
} from '@/components/charts/area-chart'

// ...existing imports...
import { buildTrendSeries } from '@/lib/evals/helpers/trend'

// inside ActivityList, after buildRows(data):
const trendPoints = buildTrendSeries(data.recentRuns)

// then in the return, insert this above the existing <div className="overflow-hidden ..."> block:

{
  trendPoints.length > 1 ? (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="mb-2 text-xs font-medium text-muted-foreground">
        Score trend · last {trendPoints.length} runs
      </p>
      <AreaChart
        data={trendPoints}
        xDataKey="createdAt"
        aspectRatio="5 / 1"
        margin={{ top: 8, right: 16, bottom: 24, left: 32 }}
      >
        <Grid horizontal />
        <Area
          dataKey="capability"
          fill="var(--accent-blue)"
          fillOpacity={0.35}
        />
        <Area
          dataKey="trafficMonitor"
          fill="var(--warning)"
          fillOpacity={0.35}
        />
        <Area dataKey="regression" fill="var(--success)" fillOpacity={0.35} />
        <XAxis />
        <ChartTooltip
          rows={(point: {
            createdAt: Date
            capability: number | null
            trafficMonitor: number | null
            regression: number | null
          }) =>
            [
              point.capability != null && {
                color: 'var(--accent-blue)',
                label: 'Capability',
                value: `${point.capability}%`
              },
              point.trafficMonitor != null && {
                color: 'var(--warning)',
                label: 'Traffic Monitor',
                value: `${point.trafficMonitor}%`
              },
              point.regression != null && {
                color: 'var(--success)',
                label: 'Regression',
                value: `${point.regression}%`
              }
            ].filter(Boolean)
          }
        />
      </AreaChart>
    </div>
  ) : null
}
```

This goes inside the existing `<section>` between the header `<div>` and the `<div className="overflow-hidden ...">`. The chart only renders when there are at least 2 data points (otherwise an area chart is meaningless).

- [ ] **Step 6: Extend the test for the chart presence**

Open `components/evals/dashboard/activity-list.test.tsx`. Find the existing happy-path render test and add a sibling test that asserts the trend caption renders when there are 2+ recent runs:

```tsx
it('renders the trend caption when there are at least 2 recent runs', () => {
  const data: EvalsDashboardData = {
    /* ...existing fixture with at least 2 recentRuns entries... */
  }
  render(<ActivityList data={data} />)
  expect(screen.getByText(/Score trend/i)).toBeInTheDocument()
})

it('hides the trend chart when there is only one recent run', () => {
  const data: EvalsDashboardData = {
    /* ...fixture with one recentRuns entry... */
  }
  render(<ActivityList data={data} />)
  expect(screen.queryByText(/Score trend/i)).not.toBeInTheDocument()
})
```

Use the existing fixture pattern from the file. Read the file first to see the exact shape — copy the existing 2-run fixture if one exists, otherwise extend the single-run fixture by cloning the snapshot with a different `id` and `createdAt`.

- [ ] **Step 7: Run all activity-list tests**

Run: `bun run test -- components/evals/dashboard/activity-list.test.tsx`
Expected: All existing tests + 2 new tests PASS.

- [ ] **Step 8: Manually verify in the browser**

Run: `bun dev`. Navigate to `/admin/evals`, switch to the History view (the `view-switcher` toggle). Confirm:

- Trend chart renders above the row list with 3 colored areas (capability=blue, traffic=warning, regression=success).
- Hover shows the ChartTooltip with the correct labels and values.
- Animation plays once on mount and is suppressed when system reduced-motion is on (toggle via macOS System Settings → Accessibility → Display → Reduce motion).

- [ ] **Step 9: Commit**

```bash
git add lib/evals/helpers/trend.ts lib/evals/helpers/trend.test.ts \
        components/evals/dashboard/activity-list.tsx \
        components/evals/dashboard/activity-list.test.tsx
git commit -m "$(cat <<'EOF'
feat(evals): add Area chart score trend above ActivityList

Renders a 3-series area chart (capability / traffic / regression) above
the existing run table in the History view. Pure addition — the table
and per-row interactions are unchanged. Trend chart hides when there's
fewer than 2 runs.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add Radar chart above `EvaluatorBreakdown`

**Files:**

- Modify: `components/evals/dashboard-v2/evaluator-breakdown.tsx:71-82`
- Modify: `components/evals/dashboard-v2/evaluator-breakdown.test.tsx`

- [ ] **Step 1: Write the failing test**

Open `components/evals/dashboard-v2/evaluator-breakdown.test.tsx` and add:

```tsx
it('renders a radar chart with every evaluator label', () => {
  render(
    <EvaluatorBreakdown snap={FIXTURE_WITH_ALL_EVALUATORS} previous={null} />
  )
  // RadarLabels renders evaluator names as SVG <text> nodes
  for (const key of EVALUATOR_DISPLAY_ORDER) {
    if (FIXTURE_WITH_ALL_EVALUATORS.evaluatorScores[key] == null) continue
    expect(screen.getAllByText(localLabel(key)).length).toBeGreaterThan(0)
  }
})
```

Add imports as needed at the top of the test file:

```tsx
import { EVALUATOR_DISPLAY_ORDER } from '@/lib/evals/evaluator-labels'
import { localLabel } from './local-labels'
```

If `FIXTURE_WITH_ALL_EVALUATORS` doesn't exist in this file, create it inline mirroring the existing fixture pattern and populate `evaluatorScores` with every key from `EVALUATOR_DISPLAY_ORDER` set to e.g. `0.8`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- components/evals/dashboard-v2/evaluator-breakdown.test.tsx`
Expected: FAIL — the radar isn't there yet, so `getAllByText` returns the label from the list row only (length 1), but the assertion expects `>0`. So the test will _pass_ until the radar adds a second occurrence. Adjust the assertion to `length).toBeGreaterThan(1)` so it actually fails before the implementation lands.

- [ ] **Step 3: Implement the radar above the bar list**

Modify `components/evals/dashboard-v2/evaluator-breakdown.tsx`. Add imports near the top:

```tsx
import { useReducedMotion } from 'motion/react'
import {
  RadarChart,
  RadarGrid,
  RadarAxis,
  RadarLabels,
  RadarArea
} from '@/components/charts/radar-chart'
import { STATUS_TOKENS } from '@/lib/evals/helpers/status'
```

Inside the `EvaluatorBreakdown` function, after computing `evaluators` and before the existing `return` block, add:

```tsx
const reducedMotion = useReducedMotion()
const suiteStatus = getSuiteStatus(snap, previous ?? null)
const radarColor = STATUS_TOKENS[suiteStatus].cssVar

const radarMetrics = evaluators.map(key => ({
  key,
  label: localLabel(key)
}))
const radarValues = Object.fromEntries(
  evaluators.map(key => [key, (snap.evaluatorScores[key] ?? 0) * 100])
)
const radarData = [
  {
    label: 'This run',
    color: radarColor,
    values: radarValues
  }
]
```

Then insert a new block at the very top of the returned `<section>`, immediately after the `<div className="space-y-1">` header block:

```tsx
{
  evaluators.length >= 3 ? (
    <div className="flex justify-center" data-testid="evaluator-radar">
      <RadarChart
        data={radarData}
        metrics={radarMetrics}
        size={240}
        levels={4}
        margin={48}
        animate={!reducedMotion}
      >
        <RadarGrid showLabels={false} />
        <RadarAxis />
        <RadarLabels offset={20} fontSize={10} />
        <RadarArea index={0} showPoints showGlow />
      </RadarChart>
    </div>
  ) : null
}
```

The radar only renders when there are 3 or more evaluators — fewer than that produces a degenerate polygon.

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: PASS. If the `RadarChart`/`RadarArea` exports differ from what's documented, run `cat components/charts/radar-chart.tsx` to confirm the actual export names and adjust imports.

- [ ] **Step 5: Run the tests**

Run: `bun run test -- components/evals/dashboard-v2/evaluator-breakdown.test.tsx`
Expected: All tests PASS, including the new radar-label assertion (each label now appears twice: once in the list row, once in the radar SVG).

- [ ] **Step 6: Manually verify in the browser**

Run: `bun dev`. Navigate to `/admin/evals`, default Suites view. Confirm:

- Above the existing list of evaluator bars, a radar polygon renders showing the run's "shape."
- The polygon expands on mount with spring physics.
- The fill color matches the status color (blue/warning/destructive).
- Switching suites re-renders the radar with the new values.
- Toggling system reduced-motion suppresses the mount animation.

- [ ] **Step 7: Commit**

```bash
git add components/evals/dashboard-v2/evaluator-breakdown.tsx \
        components/evals/dashboard-v2/evaluator-breakdown.test.tsx
git commit -m "$(cat <<'EOF'
feat(evals): add Radar chart above EvaluatorBreakdown

Pure addition: the per-evaluator bar list is unchanged, but a radar
polygon now renders above it showing the run's overall 'shape' across
all evaluators. Fill color follows the suite's STATUS_TOKENS palette so
healthy runs render blue, watch warning, blocked destructive.

Hidden when fewer than 3 evaluators are present (degenerate polygon).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Verification pass

**Files:** none modified — verification only.

- [ ] **Step 1: Full lint**

Run: `bun lint`
Expected: PASS with no new warnings. If bklit's generated files in `components/charts/` produce warnings (any/import order/unused), and they're not covered by the `.eslintignore` update from Task 1, narrow the rule for that directory rather than blanket-ignoring it.

- [ ] **Step 2: Full typecheck**

Run: `bun typecheck`
Expected: PASS.

- [ ] **Step 3: Full eval-related test suite**

Run: `bun run test -- components/evals lib/evals`
Expected: All tests PASS.

- [ ] **Step 4: Format check**

Run: `bun format:check`
Expected: PASS. If failing, run `bun format` and re-stage changes.

- [ ] **Step 5: Manual smoke test in the browser**

Run: `bun dev`. Walk through the full admin/evals UI:

1. Suites view: Gauge animates in for each of the three suites; threshold caption renders correctly for above/below/null threshold cases. Radar appears above evaluator list and matches suite color.
2. History view: Trend chart appears above the row list when ≥2 runs exist. Hover tooltip works.
3. Switch system to reduced-motion mode (macOS System Settings → Accessibility → Display → Reduce motion ON). Reload. Confirm: no mount animations for any of the three charts.

- [ ] **Step 6: Bundle size sanity check (optional)**

Run: `bun run build`
Expected: PASS. Note the size of the admin-evals bundle — visx + d3-shape add roughly 80–120 KB gzipped. Confirm this is acceptable; the admin route is not on the user-facing critical path, so this should be fine.

- [ ] **Step 7: Open a PR**

```bash
git push -u origin HEAD
gh pr create --title "feat(evals): bklit chart visualizations in admin/evals" --body "$(cat <<'EOF'
## Summary

- Replace bespoke SVG ring in `ScoreFeature` with bklit Gauge (spring-physics arc + NumberFlow center)
- Add Area chart score trend above the History view's run list
- Add Radar chart above the Evaluator Breakdown bar list

Functionality of the evals dashboard is unchanged — these are visual upgrades only. Bespoke threshold copy moves from inside the ring to a caption below the new Gauge. Both additive charts hide gracefully when their data is degenerate (<2 runs for area, <3 evaluators for radar).

Bundle adds visx + d3-shape + @number-flow/react (~80–120 KB gzipped, admin route only).

## Test plan

- [ ] `bun typecheck` passes
- [ ] `bun lint` passes
- [ ] `bun run test -- components/evals lib/evals` passes
- [ ] Suites view: gauge animates per suite, threshold caption renders, radar matches suite color
- [ ] History view: trend chart renders with 2+ runs, hover tooltip correct
- [ ] Reduced-motion: all three charts skip mount animation when prefers-reduced-motion is ON

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Self-Review

**Spec coverage:**

- Bring bklit "fluid animations and UI" into admin/evals → Tasks 2, 3, 4 cover the three highest-fit chart components.
- Preserve functionality → Task 2 keeps threshold copy (moved to caption); Tasks 3 & 4 are pure additions, not replacements.
- Avoid major refactor → Each task touches 1–2 files. Total surface: ~6 files + 3 new chart wrappers from the registry.

**Placeholder scan:** Each step has either a concrete command, complete code, or a concrete decision rule. No "TBD" / "add validation" / "similar to Task N" patterns.

**Type consistency:**

- `TrendPoint` defined in `lib/evals/helpers/trend.ts` with explicit `capability` / `trafficMonitor` / `regression` keys; consumed by Task 3's `ChartTooltip` rows with matching types.
- `STATUS_TOKENS[suiteStatus].cssVar` is the canonical color source across all three tasks.
- `EVALUATOR_DISPLAY_ORDER` + `localLabel(key)` consistent between Task 4's radar and existing breakdown rows.

**Known risks called out in-task:**

- Gauge's `activeFill` typing may not accept `var(--…)` — Task 2 Step 4 has a workaround.
- Gauge's `animate` prop may not be in the typings — Task 2 Step 4 says to drop and rely on bklit's internal reduced-motion detection.
- NumberFlow may split digits — Task 2 Step 5 has a fallback selector.
- bklit registry export names may drift from docs — Task 4 Step 4 has a verification step.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-19-bklit-charts-in-admin-evals.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit here because each task touches a tight scope and benefits from independent verification.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**

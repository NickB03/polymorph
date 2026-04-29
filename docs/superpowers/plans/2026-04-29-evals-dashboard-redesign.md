# Evals Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Port the design language and on-hover insight tooltips from the demo at `/admin/evals/demo-mixed` into the production `/admin/evals` page, and fix a tooltip stacking-context bug in the shared `components/ui/tooltip.tsx` so floating tooltips never get clipped by sibling cards.

**Architecture:** Replace the multi-template `EvalsDashboardV2` with a single, opinionated layout that mirrors `components/evals/demo/mixed-dashboard.tsx`. Wire it to real data from `getEvalsDashboardWithLayout`. Promote the demo's `DefinedTerm` / `ScoreCell` / `AggregateBreakdown` helpers and term glossary into reusable modules. Patch the shared shadcn `Tooltip` to portal content into `document.body` (eliminates the stacking-context clipping). Retire the `TemplateSwitcher` UX (no longer relevant) and delete unused widget files.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, Radix UI Tooltip primitive, recharts, shadcn/ui.

---

## Reference material

The design source-of-truth is the demo file. Engineers should keep it open while working through this plan:

- **Demo (intermingled / preferred):** `components/evals/demo/mixed-dashboard.tsx` — the entire visual target
- **Demo (sectioned / alternative):** `components/evals/demo/polished-dashboard.tsx` — kept for reference
- **Production entry:** `app/(admin)/admin/evals/page.tsx` and `components/evals/dashboard-v2/dashboard.tsx`
- **Existing widgets:** `components/evals/widgets/*.tsx`
- **Project design tokens & conventions:** `.impeccable.md`
- **CLAUDE.md non-obvious invariants:** path alias `@/*`, Prettier without semicolons/single quotes/no trailing commas, ESLint forbids direct `motion/react` imports — use existing motion wrappers in `components/motion/` only

## Decisions baked into this plan

These were chosen during demo iteration. Each is justified inline below; do not relitigate.

1. **Drop the three-template system.** The demo replaced "Health / Compare / Activity" with a single canonical layout. Production follows. `TemplateSwitcher`, `lib/evals/layout/templates.ts`, and `setPreferredEvalsLayout` action are removed.
2. **Rename "Capability" → "Benchmarks"** in user-facing strings. Internal codebase identifier `suite: 'capability'` is unchanged (data-shape contract).
3. **Rename "evaluators" → "judges"** in user-facing labels. The internal label maps and column names stay (e.g., `evaluatorScores`, `failedEvaluators`) — these are data-layer terms.
4. **Patch shared `components/ui/tooltip.tsx`** to wrap `TooltipPrimitive.Content` in `TooltipPrimitive.Portal`. Affects every tooltip in the app (the change is strictly an improvement — fixes clipping, adds nothing).
5. **Static `SCORE_INSIGHTS` placeholder data** for now. The contract type is committed; real population from a failure-mode pipeline is out of scope for this plan and tracked separately.
6. **Keep the demo files in tree.** They serve as design reference.

---

## File Structure

### Created

| Path                                                        | Responsibility                                                                                                                             |
| ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `lib/evals/glossary.ts`                                     | Single source of truth for term `DEFINITIONS`, `JUDGE_DEFINITIONS`, `SCORE_INSIGHTS` placeholder data, and helpers like `snapshotSuiteKey` |
| `components/evals/glossary/defined-term.tsx`                | Reusable dotted-underline tooltip for canonical terms                                                                                      |
| `components/evals/glossary/score-cell.tsx`                  | Hover-wraps a per-judge bar/score with the failure-mode insight tooltip                                                                    |
| `components/evals/glossary/aggregate-breakdown.tsx`         | The per-judge sorted breakdown shown when hovering a score ring                                                                            |
| `components/evals/glossary/judge-label.tsx`                 | Convenience that wraps a judge's display name with `DefinedTerm`                                                                           |
| `components/evals/glossary/index.ts`                        | Barrel export                                                                                                                              |
| `lib/evals/glossary.test.ts`                                | Unit tests for the glossary helpers                                                                                                        |
| `components/evals/glossary/__tests__/defined-term.test.tsx` | Tests for the tooltip components                                                                                                           |
| `components/evals/dashboard/header.tsx`                     | New header (eyebrow + h1 + subtitle + sync timestamp)                                                                                      |
| `components/evals/dashboard/kpi-strip.tsx`                  | New 4-tile naked KPI strip (Status / Pass rate / Aggregate score / Cases scored)                                                           |
| `components/evals/dashboard/score-feature.tsx`              | New score-ring section for Benchmarks (with `AggregateBreakdown` tooltip)                                                                  |
| `components/evals/dashboard/combined-trend.tsx`             | Three-suite overlaid trend chart                                                                                                           |
| `components/evals/dashboard/comparison-table.tsx`           | Curated-vs-live evaluator comparison with `ScoreCell` tooltips                                                                             |
| `components/evals/dashboard/activity-list.tsx`              | Hairline-divided list of recent runs                                                                                                       |

### Modified

| Path                                          | Change                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `components/ui/tooltip.tsx`                   | Wrap content in `TooltipPrimitive.Portal`; export `TooltipPortal`                                              |
| `components/evals/dashboard-v2/dashboard.tsx` | Replace body with composed dashboard sections; remove TemplateSwitcher reference                               |
| `app/(admin)/admin/evals/page.tsx`            | Drop `initialLayout` prop; pass only `data`                                                                    |
| `app/(admin)/admin/evals/loading.tsx`         | Update skeleton to match new layout                                                                            |
| `lib/evals/queries.ts`                        | Drop `getEvalsDashboardWithLayout`; expose simpler `getEvalsDashboard(userId)` returning just `data`           |
| `components/evals/score-ring.tsx`             | Update visual chrome (no card wrapper, blue stroke routing, "aggregate" caption) — used by `score-feature.tsx` |

### Deleted

| Path                                                                     | Reason                                                                |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------- |
| `components/evals/dashboard-v2/template-switcher.tsx`                    | Templates retired                                                     |
| `components/evals/dashboard-v2/template-switcher.test.tsx` _(if exists)_ | Templates retired                                                     |
| `lib/evals/layout/templates.ts`                                          | Templates retired                                                     |
| `lib/evals/layout/types.ts`                                              | Templates retired (move any reusable types into `lib/evals/types.ts`) |
| `lib/actions/eval-preferences.ts`                                        | `setPreferredEvalsLayout` action no longer needed                     |
| `components/evals/widgets/layout-renderer.tsx` + test                    | Layout renderer retired                                               |
| `components/evals/widgets/registry.ts`                                   | Widget registry retired                                               |
| `components/evals/widgets/page-header.tsx`                               | Replaced by `dashboard/header.tsx`                                    |
| `components/evals/widgets/kpi-tile.tsx`                                  | Replaced by `dashboard/kpi-strip.tsx`                                 |
| `components/evals/widgets/suite-header-card.tsx`                         | Replaced by `dashboard/score-feature.tsx`                             |
| `components/evals/widgets/score-ring-widget.tsx`                         | Replaced by `dashboard/score-feature.tsx`                             |
| `components/evals/widgets/combined-trend-chart.tsx`                      | Replaced by `dashboard/combined-trend.tsx`                            |
| `components/evals/widgets/trend-chart-widget.tsx`                        | No longer referenced                                                  |
| `components/evals/widgets/evaluator-comparison-grid.tsx`                 | Replaced by `dashboard/comparison-table.tsx`                          |
| `components/evals/widgets/divergence-banner.tsx`                         | Folded into comparison table                                          |
| `components/evals/widgets/what-changed-card.tsx`                         | Folded into comparison table (the divergence list IS what changed)    |
| `components/evals/widgets/activity-feed.tsx`                             | Replaced by `dashboard/activity-list.tsx`                             |
| `components/evals/widgets/evaluator-bars-widget.tsx`                     | No longer referenced                                                  |
| `components/evals/widgets/evaluator-chip-grid.tsx`                       | No longer referenced                                                  |
| `components/evals/widgets/empty-state.tsx`                               | Empty states inlined per section                                      |
| `components/evals/evaluator-bars.tsx`                                    | No longer referenced                                                  |
| `components/evals/widgets/__tests__/null-safety.test.tsx`                | Tests its widgets which no longer exist                               |
| `components/evals/widgets/layout-renderer.test.tsx`                      | Layout renderer retired                                               |
| `components/evals/dashboard-v2/dashboard.test.tsx`                       | Rewritten in Task 21                                                  |
| `components/evals/score-ring.test.tsx`                                   | Rewritten in Task 21                                                  |
| `components/evals/demo/*`                                                | **NOT deleted.** Kept as design reference.                            |

The result: a flatter layout with ~30% fewer files, no widget registry indirection, and the demo file remaining as design-spec.

---

## Phase 0 — Baseline (1 task)

### Task 0: Verify baseline before changes

**Files:** none

- [ ] **Step 1: Confirm dev server runs and demo renders**

```bash
bun dev
```

In your authenticated browser, open `http://localhost:43100/admin/evals/demo-mixed`. Confirm the design target renders cleanly: hover the Benchmarks ring, hover bars in the comparison table, hover suite names — every tooltip should appear and not be clipped.

- [ ] **Step 2: Capture current test baseline**

```bash
bun run test components/evals lib/evals 2>&1 | tee /tmp/evals-baseline.txt
```

Note the pass/fail count. Tests for soon-to-be-deleted files (e.g., `layout-renderer.test.tsx`) should pass now; they will be removed in Task 22.

- [ ] **Step 3: Confirm typecheck and lint baseline**

```bash
bun typecheck
bun lint
```

Expected: clean for everything in `components/evals/**` and `app/(admin)/**`. (Repo-wide `skills/...` errors are pre-existing and not your concern.)

- [ ] **Step 4: Commit nothing — this is just verification**

---

## Phase 1 — Shared foundations (5 tasks)

### Task 1: Patch shared Tooltip to portal content

**Files:**

- Modify: `components/ui/tooltip.tsx`

This is the canonical fix for the stacking-context clipping bug. Every `<TooltipContent>` in the app instantly stops being clipped by sibling cards.

- [ ] **Step 1: Replace the file contents**

```tsx
'use client'

import * as React from 'react'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'

import { cn } from '@/lib/utils/index'

const TooltipProvider = TooltipPrimitive.Provider

const Tooltip = TooltipPrimitive.Root

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipPortal = TooltipPrimitive.Portal

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 4, ...props }, ref) => (
  <TooltipPortal>
    <TooltipPrimitive.Content
      ref={ref}
      sideOffset={sideOffset}
      className={cn(
        'z-50 overflow-hidden rounded-md border bg-popover px-3 py-1.5 text-sm text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 origin-[--radix-tooltip-content-transform-origin]',
        className
      )}
      {...props}
    />
  </TooltipPortal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export {
  Tooltip,
  TooltipContent,
  TooltipPortal,
  TooltipProvider,
  TooltipTrigger
}
```

- [ ] **Step 2: Verify nothing breaks for existing tooltip consumers**

```bash
bun typecheck
bun lint
bun run test
```

Expected: clean. The change is internal (Portal wrap is the canonical Radix pattern); no existing call site needs updating.

- [ ] **Step 3: Commit**

```bash
git add components/ui/tooltip.tsx
git commit -m "fix(ui/tooltip): portal content to escape sibling stacking contexts"
```

---

### Task 2: Create the eval glossary module

**Files:**

- Create: `lib/evals/glossary.ts`
- Create: `lib/evals/glossary.test.ts`

Single source of truth for every defined term, every judge insight fixture, and the `snapshotSuiteKey` helper.

- [ ] **Step 1: Write the failing test**

`lib/evals/glossary.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  DEFINITIONS,
  getJudgeDefinition,
  getScoreInsight,
  snapshotSuiteKey
} from './glossary'

describe('glossary', () => {
  it('defines every canonical term', () => {
    expect(DEFINITIONS.benchmarks).toMatch(/curated/i)
    expect(DEFINITIONS.trafficMonitor).toMatch(/live|production/i)
    expect(DEFINITIONS.regression).toMatch(/pinned|drift/i)
    expect(DEFINITIONS.aggregateScore).toMatch(/weighted/i)
    expect(DEFINITIONS.passRate).toMatch(/%|threshold/i)
  })

  it('returns judge definitions for all known judge keys', () => {
    expect(getJudgeDefinition('faithfulness')).toMatch(/grounded/i)
    expect(getJudgeDefinition('safety')).toMatch(/harmful|policy/i)
    expect(getJudgeDefinition('not_a_real_judge')).toBeNull()
  })

  it('maps snapshot suite enum to glossary suite key', () => {
    expect(snapshotSuiteKey({ suite: 'capability' } as never)).toBe(
      'benchmarks'
    )
    expect(snapshotSuiteKey({ suite: 'traffic-monitor' } as never)).toBe(
      'trafficMonitor'
    )
    expect(snapshotSuiteKey({ suite: 'regression' } as never)).toBe(
      'regression'
    )
  })

  it('returns score insight for known suite/judge pairs', () => {
    const insight = getScoreInsight('trafficMonitor', 'citation_accuracy')
    expect(insight).not.toBeNull()
    expect(insight!.passed).toBeLessThan(insight!.total)
    expect(insight!.failureModes!.length).toBeGreaterThan(0)
  })

  it('returns null for unknown suite/judge', () => {
    expect(getScoreInsight('benchmarks', 'not_a_judge')).toBeNull()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test lib/evals/glossary.test.ts
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Create the implementation**

`lib/evals/glossary.ts`:

```ts
import type { EvalSummarySnapshot } from './types'

export type SuiteKey = 'benchmarks' | 'trafficMonitor' | 'regression'

export type FailureMode = { count: number; description: string }

export type ScoreInsight = {
  passed: number
  total: number
  threshold?: number
  failureModes?: FailureMode[]
  note?: string
}

export const DEFINITIONS = {
  benchmarks:
    'A curated benchmark set. Run on demand against a fixed list of test prompts to measure how the model performs against a known reference.',
  trafficMonitor:
    'A rolling sample of real production chats, scored on a cron. Tells you what users are actually getting.',
  regression:
    'Pinned cases that previously broke. Run after material changes to catch drift. Silent unless one fails.',
  aggregateScore:
    'Weighted mean across all judges per run. 0–1 scale; higher is better.',
  passRate:
    '% of cases scoring at or above the per-judge thresholds. A case must pass every judge to count.',
  status:
    'The worst state across all suites. Healthy = everything above threshold. Watch = within 5 points of threshold. Alarm = at least one breach.',
  delta:
    'Difference in points (×100). E.g. −7 means the live column is 7 points behind the curated column.',
  faithfulness: 'Does the response stay grounded in the supplied sources?',
  relevance: 'Does the response address what the user actually asked?',
  safety:
    'Does the response avoid harmful, unsafe, or policy-violating output?',
  response_quality:
    'Is the response well-formed, useful, and appropriately scoped?',
  citation_accuracy:
    'Do the citations actually support the claims they accompany?',
  tool_usage: 'Did the agent reach for the right tools at the right time?',
  deterministic_prechecks:
    'Mechanical assertions that run before the LLM judges (formatting, schema, length).'
} as const

const JUDGE_DEFINITIONS: Record<string, string> = {
  faithfulness: DEFINITIONS.faithfulness,
  relevance: DEFINITIONS.relevance,
  safety: DEFINITIONS.safety,
  response_quality: DEFINITIONS.response_quality,
  citation_accuracy: DEFINITIONS.citation_accuracy,
  tool_usage: DEFINITIONS.tool_usage,
  deterministic_prechecks: DEFINITIONS.deterministic_prechecks
}

export function getJudgeDefinition(key: string): string | null {
  return JUDGE_DEFINITIONS[key] ?? null
}

// Placeholder fixtures. Real population from a failure-mode pipeline is
// tracked separately. Until then, these read as plausible defaults — the
// shape is the contract the UI relies on.
export const SCORE_INSIGHTS: Record<SuiteKey, Record<string, ScoreInsight>> = {
  benchmarks: {
    faithfulness: { passed: 0, total: 0 },
    relevance: { passed: 0, total: 0 },
    safety: { passed: 0, total: 0 },
    response_quality: { passed: 0, total: 0 },
    citation_accuracy: { passed: 0, total: 0 },
    tool_usage: { passed: 0, total: 0 },
    deterministic_prechecks: { passed: 0, total: 0 }
  },
  trafficMonitor: {
    faithfulness: { passed: 0, total: 0 },
    relevance: { passed: 0, total: 0 },
    safety: { passed: 0, total: 0 },
    response_quality: { passed: 0, total: 0 },
    citation_accuracy: {
      passed: 0,
      total: 0,
      failureModes: [
        {
          count: 0,
          description: 'Citation did not support the claim it followed.'
        },
        { count: 0, description: 'Linked URLs that returned 404.' },
        {
          count: 0,
          description: 'Fabricated citation IDs that resolve to nothing.'
        }
      ],
      note: 'Most common breach in the live sample.'
    },
    tool_usage: { passed: 0, total: 0 },
    deterministic_prechecks: { passed: 0, total: 0 }
  },
  regression: {
    faithfulness: { passed: 0, total: 0 },
    relevance: { passed: 0, total: 0 },
    safety: { passed: 0, total: 0 },
    response_quality: { passed: 0, total: 0 },
    citation_accuracy: { passed: 0, total: 0 },
    tool_usage: { passed: 0, total: 0 },
    deterministic_prechecks: { passed: 0, total: 0 }
  }
}

export function getScoreInsight(
  suite: SuiteKey,
  judgeKey: string
): ScoreInsight | null {
  return SCORE_INSIGHTS[suite]?.[judgeKey] ?? null
}

export function snapshotSuiteKey(snap: EvalSummarySnapshot): SuiteKey {
  switch (snap.suite) {
    case 'capability':
      return 'benchmarks'
    case 'traffic-monitor':
      return 'trafficMonitor'
    case 'regression':
      return 'regression'
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
bun run test lib/evals/glossary.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/evals/glossary.ts lib/evals/glossary.test.ts
git commit -m "feat(evals): add glossary module with term definitions and score insights"
```

---

### Task 3: Create `DefinedTerm` and `JudgeLabel` components

**Files:**

- Create: `components/evals/glossary/defined-term.tsx`
- Create: `components/evals/glossary/judge-label.tsx`
- Create: `components/evals/glossary/__tests__/defined-term.test.tsx`

- [ ] **Step 1: Write the failing test**

`components/evals/glossary/__tests__/defined-term.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'

import { DefinedTerm } from '../defined-term'
import { JudgeLabel } from '../judge-label'

function withTooltip(node: React.ReactNode) {
  return <TooltipProvider>{node}</TooltipProvider>
}

describe('DefinedTerm', () => {
  it('renders children with a help cursor and dotted underline', () => {
    render(withTooltip(<DefinedTerm def="test def">Hello</DefinedTerm>))
    const term = screen.getByText('Hello')
    expect(term).toHaveClass('cursor-help')
    expect(term.className).toMatch(/decoration-dotted/)
  })
})

describe('JudgeLabel', () => {
  it('renders the human-readable judge label', () => {
    render(withTooltip(<JudgeLabel judgeKey="faithfulness" />))
    expect(screen.getByText('Faithfulness')).toBeInTheDocument()
  })

  it('renders unknown keys as raw text without tooltip wrapper', () => {
    render(withTooltip(<JudgeLabel judgeKey="not_a_judge" />))
    expect(screen.getByText('Not A Judge')).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test components/evals/glossary/__tests__/defined-term.test.tsx
```

Expected: FAIL with module-not-found.

- [ ] **Step 3: Create `defined-term.tsx`**

`components/evals/glossary/defined-term.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

export function DefinedTerm({
  def,
  className,
  children
}: {
  def: string
  className?: string
  children: ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          className={[
            'cursor-help underline decoration-dotted decoration-muted-foreground/50 underline-offset-[3px] transition-colors hover:decoration-foreground',
            className
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {children}
        </span>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
        {def}
      </TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 4: Create `judge-label.tsx`**

`components/evals/glossary/judge-label.tsx`:

```tsx
'use client'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getJudgeDefinition } from '@/lib/evals/glossary'

import { DefinedTerm } from './defined-term'

export function JudgeLabel({ judgeKey }: { judgeKey: string }) {
  const def = getJudgeDefinition(judgeKey)
  const label = getEvaluatorLabel(judgeKey)
  if (!def) return <>{label}</>
  return <DefinedTerm def={def}>{label}</DefinedTerm>
}
```

- [ ] **Step 5: Run test to verify it passes**

```bash
bun run test components/evals/glossary/__tests__/defined-term.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add components/evals/glossary/
git commit -m "feat(evals): add DefinedTerm and JudgeLabel tooltip helpers"
```

---

### Task 4: Create `ScoreCell` component

**Files:**

- Create: `components/evals/glossary/score-cell.tsx`

- [ ] **Step 1: Create the component**

`components/evals/glossary/score-cell.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getScoreInsight, type SuiteKey } from '@/lib/evals/glossary'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

export function ScoreCell({
  suite,
  judgeKey,
  value,
  children
}: {
  suite: SuiteKey
  judgeKey: string
  value: number
  children: ReactNode
}) {
  const insight = getScoreInsight(suite, judgeKey)
  if (!insight || (insight.total === 0 && !insight.failureModes)) {
    return <>{children}</>
  }

  const judgeLabel = getEvaluatorLabel(judgeKey)
  const pctValue = Math.round(value * 100)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-full cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        sideOffset={6}
        collisionPadding={16}
        className="max-w-sm space-y-2 text-xs leading-relaxed"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-foreground">
            {judgeLabel} · {pctValue}%
          </span>
          {insight.total > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {insight.passed}/{insight.total} passed
            </span>
          ) : null}
        </div>
        {insight.failureModes && insight.failureModes.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">Top failure modes</p>
            <ul className="space-y-1">
              {insight.failureModes.map(mode => (
                <li
                  key={mode.description}
                  className="grid grid-cols-[20px_1fr] gap-2"
                >
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {mode.count}
                  </span>
                  <span className="text-muted-foreground">
                    {mode.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {insight.note ? (
          <p className="italic text-muted-foreground">{insight.note}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}
```

- [ ] **Step 2: Typecheck and lint**

```bash
bun typecheck
bun lint
```

Expected: clean.

- [ ] **Step 3: Commit**

```bash
git add components/evals/glossary/score-cell.tsx
git commit -m "feat(evals): add ScoreCell tooltip wrapper for per-judge insights"
```

---

### Task 5: Create `AggregateBreakdown` and barrel export

**Files:**

- Create: `components/evals/glossary/aggregate-breakdown.tsx`
- Create: `components/evals/glossary/index.ts`

- [ ] **Step 1: Create `aggregate-breakdown.tsx`**

```tsx
'use client'

import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import { getScoreInsight, type SuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'

export function AggregateBreakdown({
  suiteLabel,
  suite,
  snap,
  score
}: {
  suiteLabel: string
  suite: SuiteKey
  snap: EvalSummarySnapshot
  score: number
}) {
  const judges: Array<{ key: string; label: string; value: number }> = []
  for (const key of EVALUATOR_DISPLAY_ORDER) {
    const value = snap.evaluatorScores[key]
    if (value == null) continue
    judges.push({ key, label: getEvaluatorLabel(key), value })
  }
  judges.sort((a, b) => b.value - a.value)

  const lowest = judges[judges.length - 1]
  const lowestInsight = lowest ? getScoreInsight(suite, lowest.key) : null

  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <span className="font-semibold text-foreground">
          {suiteLabel} · {Math.round(score * 100)}% aggregate
        </span>
        <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {snap.totalCases} cases · {judges.length} judges
        </span>
      </div>
      <ul className="space-y-1">
        {judges.map(j => (
          <li
            key={j.key}
            className="grid grid-cols-[40px_1fr] items-baseline gap-2"
          >
            <span
              className={[
                'font-mono font-medium tabular-nums',
                j.key === lowest?.key
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              ].join(' ')}
            >
              {Math.round(j.value * 100)}%
            </span>
            <span
              className={
                j.key === lowest?.key
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }
            >
              {j.label}
            </span>
          </li>
        ))}
      </ul>
      {lowest && lowestInsight && lowestInsight.total > 0 ? (
        <p className="border-t border-border/60 pt-2 text-muted-foreground">
          Biggest drag is{' '}
          <span className="font-medium text-foreground">{lowest.label}</span> (
          {Math.round(lowest.value * 100)}%) — {lowestInsight.passed}/
          {lowestInsight.total} cases passed
          {lowestInsight.failureModes && lowestInsight.failureModes[0]
            ? `; top miss: ${lowestInsight.failureModes[0].description.toLowerCase()}`
            : ''}
        </p>
      ) : null}
    </>
  )
}
```

- [ ] **Step 2: Create `index.ts` barrel**

```ts
export { AggregateBreakdown } from './aggregate-breakdown'
export { DefinedTerm } from './defined-term'
export { JudgeLabel } from './judge-label'
export { ScoreCell } from './score-cell'
```

- [ ] **Step 3: Typecheck**

```bash
bun typecheck
```

Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add components/evals/glossary/
git commit -m "feat(evals): add AggregateBreakdown + glossary barrel export"
```

---

## Phase 2 — Layout module (composed from glossary helpers) (6 tasks)

### Task 6: Create the new `Header` section

**Files:**

- Create: `components/evals/dashboard/header.tsx`

- [ ] **Step 1: Create the file**

```tsx
'use client'

import { useState } from 'react'

import { formatDistanceToNow } from 'date-fns'

import type { EvalsDashboardData } from '@/lib/evals/types'

export function DashboardHeader({ data }: { data: EvalsDashboardData }) {
  const lastSyncIso = data.trafficMonitor.lastUpdated
  const lastSync = lastSyncIso
    ? formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true })
    : 'never'

  return (
    <header className="flex flex-col gap-6 border-b border-border/60 pb-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="max-w-2xl space-y-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Polymorph · Quality evals
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Response quality
        </h1>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Seven automated judges grade every model response on faithfulness,
          relevance, safety, and four other criteria. This page tracks how
          scores trend across curated test prompts and live user traffic. Hover
          anything underlined to learn what it means.
        </p>
        <p className="text-xs text-muted-foreground">Last sync {lastSync}.</p>
      </div>
      <ViewSwitcher />
    </header>
  )
}

function ViewSwitcher() {
  const [active, setActive] = useState<'glance' | 'sidebyside' | 'history'>(
    'glance'
  )
  const items = [
    { id: 'glance' as const, label: 'At a glance' },
    { id: 'sidebyside' as const, label: 'Curated vs live' },
    { id: 'history' as const, label: 'Run history' }
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Dashboard layout"
      className="inline-flex items-center gap-1 self-start rounded-full border border-border bg-background p-1 shadow-xs"
    >
      {items.map(it => {
        const on = active === it.id
        return (
          <button
            key={it.id}
            role="radio"
            aria-checked={on}
            type="button"
            onClick={() => setActive(it.id)}
            className={[
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              on
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            ].join(' ')}
          >
            {it.label}
          </button>
        )
      })}
    </div>
  )
}
```

> **Note for the engineer:** the `ViewSwitcher` is a visual element only in this iteration — none of the three modes are functionally implemented. Wiring them is out of scope.

- [ ] **Step 2: Typecheck and lint**

```bash
bun typecheck
bun lint
```

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard/header.tsx
git commit -m "feat(evals): add DashboardHeader (eyebrow + h1 + subtitle)"
```

---

### Task 7: Create the `KpiStrip` section

**Files:**

- Create: `components/evals/dashboard/kpi-strip.tsx`

This file ports `KpiStrip` from `components/evals/demo/mixed-dashboard.tsx`. The full implementation is ~120 lines. Copy that function (and its `severityForScore` / `severityText` / `pct` / `deltaPts` helpers) into the new file. Wire `Status` / `Pass rate` / `Aggregate score` labels through `<DefinedTerm>` using the new glossary module.

- [ ] **Step 1: Create the file by porting from the demo**

Open `components/evals/demo/mixed-dashboard.tsx` and copy these specific exports into `components/evals/dashboard/kpi-strip.tsx`:

- `function KpiStrip({ data }: ...)` — the entire function
- The local helpers `pct`, `deltaPts`, `Severity`, `severityForScore`, `severityText`

Make these changes during the port:

1. Imports replaced: pull `DefinedTerm` from `@/components/evals/glossary` and `DEFINITIONS` from `@/lib/evals/glossary`. Remove the demo's local `DEFINITIONS` and `DefinedTerm` references in favor of the shared modules.
2. The `t.labelNode` use of `DEFINITIONS.passRate` etc. now references the imported `DEFINITIONS`.
3. The `severityForScore`, `severityText`, `pct`, `deltaPts` helpers will be reused across multiple new dashboard files. **Move them into a shared module instead of duplicating.** Create `components/evals/dashboard/shared.ts`:

```ts
export const pct = (v: number) => `${Math.round(v * 100)}%`

export const deltaPts = (n: number | null) => {
  if (n == null) return null
  const r = Math.round(n * 100)
  if (r === 0) return '·'
  return `${r > 0 ? '+' : ''}${r}`
}

export type Severity = 'ok' | 'watch' | 'alarm'

export function severityForScore(
  v: number,
  healthy = 0.85,
  warn = 0.7
): Severity {
  if (v >= healthy) return 'ok'
  if (v >= warn) return 'watch'
  return 'alarm'
}

export function severityText(s: Severity) {
  switch (s) {
    case 'ok':
      return 'text-foreground'
    case 'watch':
      return 'text-accent-amber'
    case 'alarm':
      return 'text-destructive'
  }
}
```

`kpi-strip.tsx` then imports those helpers from `./shared`.

- [ ] **Step 2: Typecheck and lint**

```bash
bun typecheck
bun lint components/evals/dashboard/
```

Expected: clean. If imports complain, ensure the demo file's `'@/lib/evals/glossary'` import was renamed appropriately.

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard/
git commit -m "feat(evals): add KpiStrip section + shared severity helpers"
```

---

### Task 8: Create the `ScoreFeature` (Benchmarks ring) section

**Files:**

- Create: `components/evals/dashboard/score-feature.tsx`

Port the `ScoreFeature` function from `mixed-dashboard.tsx`. Includes:

- Section heading with `<DefinedTerm def={DEFINITIONS.benchmarks}>Benchmarks</DefinedTerm>`
- Score ring SVG (no card chrome)
- The ring wrapped in `<Tooltip>` containing `<AggregateBreakdown>`
- Pass rate / Change · 48h / Cases sub-grid
- Experiment + Dataset metadata footer

- [ ] **Step 1: Create the file**

Refer to `components/evals/demo/mixed-dashboard.tsx` lines containing `function ScoreFeature` (approx. lines 766-870). Port wholesale, replacing local imports with the shared glossary module:

```tsx
'use client'

import { AggregateBreakdown, DefinedTerm } from '@/components/evals/glossary'
import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import { deltaPts, pct } from './shared'

export function ScoreFeature({
  cap,
  previous
}: {
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  // ... full ring SVG code from demo ...
}
```

(See demo file for the full body — the only changes are the imports, dropping the `label` prop in favor of the literal `'Benchmarks'`, and using `DEFINITIONS.benchmarks` from the imported glossary.)

- [ ] **Step 2: Typecheck and lint**

```bash
bun typecheck
bun lint components/evals/dashboard/
```

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard/score-feature.tsx
git commit -m "feat(evals): add ScoreFeature with hoverable ring breakdown"
```

---

### Task 9: Create the `CombinedTrend` section

**Files:**

- Create: `components/evals/dashboard/combined-trend.tsx`

Port `CombinedTrend` and its inner `Legend` from `mixed-dashboard.tsx`. Use the shared glossary for legend defs (Benchmarks / Traffic / Regression).

- [ ] **Step 1: Create the file**

Copy the `CombinedTrend` and `Legend` functions from the demo file. Replace local references to `DEFINITIONS` with imports from `@/lib/evals/glossary`. Keep the recharts setup, the `<defs><linearGradient/></defs>` blue-fill block, and the three `<Area>` series with their existing stroke/dash patterns.

The container wrapping uses `rounded-2xl border border-border/60 bg-background p-6` (one of the few card-chrome surfaces preserved — the chart needs visual containment because it's a complex visualization).

- [ ] **Step 2: Typecheck and lint**

```bash
bun typecheck
bun lint components/evals/dashboard/
```

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard/combined-trend.tsx
git commit -m "feat(evals): add CombinedTrend chart with suite-color routing"
```

---

### Task 10: Create the `ComparisonTable` section

**Files:**

- Create: `components/evals/dashboard/comparison-table.tsx`

Port `ComparisonTable` and its inner `Bar` from `mixed-dashboard.tsx`. Wire each bar through `<ScoreCell>` so hovering reveals per-suite-per-judge insights.

- [ ] **Step 1: Create the file**

Critical fragment to preserve verbatim (the part that wraps each bar in `ScoreCell`):

```tsx
<ScoreCell suite="benchmarks" judgeKey={key} value={c}>
  <Bar value={c} tone="primary" />
</ScoreCell>
<ScoreCell suite="trafficMonitor" judgeKey={key} value={t}>
  <Bar value={t} tone="secondary" />
</ScoreCell>
```

(Note: `suite="capability"` in the demo becomes `suite="benchmarks"` because the glossary's `SuiteKey` type was renamed.)

The header row uses the natural-case treatment: `text-xs font-medium text-muted-foreground`, columns "Judge / Curated prompts / Live chats / Δ pts". The judge label uses `<JudgeLabel judgeKey={key} />`. The alarm row tint is `bg-destructive/5`. **No side-stripe borders.**

- [ ] **Step 2: Typecheck and lint**

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard/comparison-table.tsx
git commit -m "feat(evals): add ComparisonTable with per-bar insight tooltips"
```

---

### Task 11: Create the `ActivityList` section

**Files:**

- Create: `components/evals/dashboard/activity-list.tsx`

Port `ActivityList` and `ExpandedRow` from `mixed-dashboard.tsx`. Each suite name is wrapped in `<DefinedTerm>` (capability → benchmarks); the expanded row's per-judge bars are wrapped in `<ScoreCell>` with the snapshot's suite key.

- [ ] **Step 1: Create the file**

Refer to the demo file. Replace `'Capability'` row label with `'Benchmarks'`. Replace local `getSnapshotSuiteKey` with the imported `snapshotSuiteKey` from `@/lib/evals/glossary`.

The expanded row pattern (from demo):

```tsx
<ScoreCell key={key} suite={suiteKey} judgeKey={key} value={v}>
  <div className="flex items-center gap-3 ...">
    <span>...{getEvaluatorLabel(key)}</span>
    [bar]
    <span>{pct(v)}</span>
  </div>
</ScoreCell>
```

- [ ] **Step 2: Typecheck and lint**

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard/activity-list.tsx
git commit -m "feat(evals): add ActivityList with expandable per-judge rows"
```

---

## Phase 3 — Wire it together (3 tasks)

### Task 12: Replace `EvalsDashboardV2` body

**Files:**

- Modify: `components/evals/dashboard-v2/dashboard.tsx`
- Delete: `components/evals/dashboard-v2/template-switcher.tsx`

- [ ] **Step 1: Replace `dashboard.tsx` contents**

```tsx
'use client'

import type { CSSProperties } from 'react'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { CombinedTrend } from '@/components/evals/dashboard/combined-trend'
import { ComparisonTable } from '@/components/evals/dashboard/comparison-table'
import { DashboardHeader } from '@/components/evals/dashboard/header'
import { KpiStrip } from '@/components/evals/dashboard/kpi-strip'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'

import { AlertBanner } from '@/components/evals/widgets/alert-banner'

function enter(delayMs: number): CSSProperties {
  return { ['--enter-delay' as string]: `${delayMs}ms` }
}

export function EvalsDashboardV2({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest

  if (!cap && !traf && !reg) {
    return (
      <TooltipProvider delayDuration={200}>
        <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
            <DashboardHeader data={data} />
            <p className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-12 text-center text-sm text-muted-foreground">
              No evaluation runs have landed yet. The next Traffic Monitor cron
              will populate this page.
            </p>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <AlertBanner data={data} />

          <div className="motion-safe:animate-content-enter" style={enter(0)}>
            <DashboardHeader data={data} />
          </div>

          <div className="motion-safe:animate-content-enter" style={enter(60)}>
            <KpiStrip data={data} />
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            {cap ? (
              <div
                className="motion-safe:animate-content-enter lg:col-span-4"
                style={enter(120)}
              >
                <ScoreFeature cap={cap} previous={data.capability.previous} />
              </div>
            ) : null}

            <div
              className="motion-safe:animate-content-enter lg:col-span-8"
              style={enter(180)}
            >
              <CombinedTrend
                capability={data.capability.trend}
                traffic={data.trafficMonitor.trend}
                regression={data.regression.trend}
              />
            </div>
          </div>

          {cap && traf ? (
            <div
              className="motion-safe:animate-content-enter"
              style={enter(240)}
            >
              <ComparisonTable cap={cap} traf={traf} />
            </div>
          ) : null}

          <div className="motion-safe:animate-content-enter" style={enter(300)}>
            <ActivityList data={data} />
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
```

- [ ] **Step 2: Delete TemplateSwitcher**

```bash
git rm components/evals/dashboard-v2/template-switcher.tsx
```

- [ ] **Step 3: Typecheck**

```bash
bun typecheck
```

Expect failures in `app/(admin)/admin/evals/page.tsx` (drops the `initialLayout` prop). Fix in next task.

- [ ] **Step 4: Commit (will be paired with Task 13's commit)**

Hold off committing until page.tsx is also fixed in Task 13.

---

### Task 13: Update page entry + queries

**Files:**

- Modify: `app/(admin)/admin/evals/page.tsx`
- Modify: `app/(admin)/admin/evals/loading.tsx`
- Modify: `lib/evals/queries.ts`
- Delete: `lib/actions/eval-preferences.ts`

- [ ] **Step 1: Replace `page.tsx`**

```tsx
import { redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { getEvalsDashboard } from '@/lib/evals/queries'

import { EvalsDashboardV2 } from '@/components/evals/dashboard-v2/dashboard'

export const dynamic = 'force-dynamic'

export default async function EvalsPage() {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  const data = await getEvalsDashboard(user.id)

  return <EvalsDashboardV2 data={data} />
}
```

- [ ] **Step 2: Update `lib/evals/queries.ts`**

In `lib/evals/queries.ts`, find `getEvalsDashboardWithLayout` and replace with a simpler `getEvalsDashboard` that returns just `EvalsDashboardData`:

```ts
// Drop the layout-loading helper. Users no longer pick a layout.
export async function getEvalsDashboard(
  _userId: string
): Promise<EvalsDashboardData> {
  // Reuse the existing data-loading core that getEvalsDashboardWithLayout
  // wrapped (the body that called the suite query helpers). Drop the
  // `layout: TemplateId` resolution.
  // ...existing data-fetching logic, returning only `data`...
}
```

> **Note:** the engineer should preserve the existing data-fetching code that was inside `getEvalsDashboardWithLayout` and just remove the layout-resolution wrapper. Inline the body. Run a global search for `getEvalsDashboardWithLayout` callers — there should be only `app/(admin)/admin/evals/page.tsx` after Task 12.

- [ ] **Step 3: Delete the action file**

```bash
git rm lib/actions/eval-preferences.ts
```

If there are tests for it, delete those too.

- [ ] **Step 4: Update loading skeleton**

`app/(admin)/admin/evals/loading.tsx`:

```tsx
'use client'

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
        <div className="border-b border-border/60 pb-6">
          <Skeleton className="mb-3 h-3 w-40 rounded" />
          <Skeleton className="mb-3 h-12 w-72 rounded-md" />
          <Skeleton className="h-4 w-full max-w-xl rounded" />
        </div>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-2xl lg:col-span-4" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-8" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Typecheck and lint**

```bash
bun typecheck
bun lint
```

Expected: clean. (If lint complains about unused imports anywhere, fix.)

- [ ] **Step 6: Commit (combines Task 12 and Task 13)**

```bash
git add app/(admin)/admin/evals/ \
  components/evals/dashboard-v2/ \
  lib/evals/queries.ts
git rm components/evals/dashboard-v2/template-switcher.tsx \
  lib/actions/eval-preferences.ts \
  lib/evals/layout/templates.ts \
  lib/evals/layout/types.ts || true
git commit -m "refactor(evals): replace dashboard-v2 with single composed layout"
```

---

### Task 14: Verify in browser end-to-end

**Files:** none

- [ ] **Step 1: Start dev server**

```bash
bun dev
```

- [ ] **Step 2: Open `/admin/evals` in your authenticated browser**

Confirm:

- Header reads "Response quality" with the explanatory subtitle
- KPI strip shows Status / Pass rate · curated / Aggregate score / Cases scored · 48h, all in sentence case
- Benchmarks ring is hoverable; tooltip shows per-judge breakdown floating over the trend chart (no clipping — Task 1 verified)
- Comparison table rows: hover any bar to see per-judge insight; alarm row has full-row tint, no side stripes
- Activity list: expandable rows; per-judge breakdown on hover

- [ ] **Step 3: If anything looks broken, capture the issue and fix before proceeding**

Common gotchas:

- `bg-accent-blue/10` not resolving → verify the `--accent-blue` token is in `app/globals.css` (it is per the project)
- Animation jank on mount → confirm `motion-safe:animate-content-enter` utility exists in globals
- Tooltips clipping → re-verify Task 1 was actually committed

---

## Phase 4 — Cleanup (3 tasks)

### Task 15: Delete obsolete widget files

**Files:** delete the entire list below

- [ ] **Step 1: Delete unused widget files**

```bash
git rm \
  components/evals/widgets/page-header.tsx \
  components/evals/widgets/kpi-tile.tsx \
  components/evals/widgets/suite-header-card.tsx \
  components/evals/widgets/score-ring-widget.tsx \
  components/evals/widgets/combined-trend-chart.tsx \
  components/evals/widgets/trend-chart-widget.tsx \
  components/evals/widgets/evaluator-comparison-grid.tsx \
  components/evals/widgets/divergence-banner.tsx \
  components/evals/widgets/what-changed-card.tsx \
  components/evals/widgets/activity-feed.tsx \
  components/evals/widgets/evaluator-bars-widget.tsx \
  components/evals/widgets/evaluator-chip-grid.tsx \
  components/evals/widgets/empty-state.tsx \
  components/evals/widgets/registry.ts \
  components/evals/widgets/layout-renderer.tsx \
  components/evals/widgets/layout-renderer.test.tsx \
  components/evals/widgets/__tests__/null-safety.test.tsx \
  components/evals/evaluator-bars.tsx
```

- [ ] **Step 2: Confirm `components/evals/widgets/alert-banner.tsx` and `components/evals/widgets/shared/` survive**

These are still referenced. Run:

```bash
grep -r "from '@/components/evals/widgets/alert-banner'" --include='*.tsx' --include='*.ts'
grep -r "from '@/components/evals/widgets/shared/" --include='*.tsx' --include='*.ts'
```

Expected: at least one match each. Otherwise audit.

- [ ] **Step 3: Typecheck**

```bash
bun typecheck
```

Expected: clean. Any remaining errors mean a deletion broke a still-live import — fix before commit.

- [ ] **Step 4: Commit**

```bash
git commit -m "chore(evals): remove unused widgets after dashboard redesign"
```

---

### Task 16: Update or remove existing tests

**Files:**

- Modify: `components/evals/dashboard-v2/dashboard.test.tsx`
- Delete: `components/evals/score-ring.test.tsx` (the component is now used differently)

- [ ] **Step 1: Rewrite `dashboard.test.tsx` for the new component**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData } from '@/lib/evals/types'

import { EvalsDashboardV2 } from './dashboard'

const EMPTY: EvalsDashboardData = {
  capability: { latest: null, previous: null, trend: [], lastUpdated: null },
  regression: { latest: null, previous: null, trend: [], lastUpdated: null },
  trafficMonitor: {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  }
}

describe('EvalsDashboardV2', () => {
  it('renders the empty state when no suite has data', () => {
    render(<EvalsDashboardV2 data={EMPTY} />)
    expect(
      screen.getByText(/no evaluation runs have landed/i)
    ).toBeInTheDocument()
  })

  it('renders the header in any state', () => {
    render(<EvalsDashboardV2 data={EMPTY} />)
    expect(
      screen.getByRole('heading', { level: 1, name: /response quality/i })
    ).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Delete obsolete tests**

```bash
git rm components/evals/score-ring.test.tsx
```

- [ ] **Step 3: Run full test suite**

```bash
bun run test
```

Expected: clean. Any remaining test failures mean a renamed export or moved file broke something — fix before commit.

- [ ] **Step 4: Commit**

```bash
git add components/evals/dashboard-v2/dashboard.test.tsx
git commit -m "test(evals): rewrite dashboard tests for redesigned layout"
```

---

### Task 17: Final verification

**Files:** none

- [ ] **Step 1: Full quality gate**

```bash
bun typecheck
bun lint
bun run test
bun format:check
```

Expected: all clean.

- [ ] **Step 2: Build**

```bash
bun run build
```

Expected: clean build. Watch for lazy-imported widget references that the tree-shaker can't statically resolve.

- [ ] **Step 3: Manual smoke test**

In your authenticated browser at `/admin/evals`:

- Hover the Benchmarks ring → breakdown tooltip lands cleanly to the right
- Hover individual bars in comparison table → insight tooltips work, no clipping
- Hover suite/judge/metric labels → definition tooltips work
- Confirm no console errors
- Refresh once and confirm the staggered entrance animation still plays

- [ ] **Step 4: Capture diff for review**

```bash
git diff --stat main..HEAD
git log --oneline main..HEAD
```

This is the changeset to send to review.

---

## Self-review checklist

Before marking the plan done, the engineer should confirm:

- [ ] Every user-facing "Capability" was replaced with "Benchmarks"
- [ ] Every user-facing "evaluator" was replaced with "judge"
- [ ] No `border-l-2` / `border-l-4` / `border-r-*` colored stripes anywhere in the new dashboard files (impeccable BAN 1)
- [ ] No `font-mono uppercase tracking-[0.16em]` chrome labels in new files except the page eyebrow + footer version stamp (if any)
- [ ] All three suite names use `<DefinedTerm>` on first appearance per section
- [ ] `<ScoreCell>` is wired around every per-judge bar (comparison table + activity expanded rows)
- [ ] `<AggregateBreakdown>` is wired around the score ring
- [ ] `getEvalsDashboardWithLayout` and `setPreferredEvalsLayout` no longer exist anywhere
- [ ] No imports of deleted files remain
- [ ] `components/evals/demo/` files still exist (kept as reference)
- [ ] `bun typecheck`, `bun lint`, `bun run test`, `bun run build` all clean

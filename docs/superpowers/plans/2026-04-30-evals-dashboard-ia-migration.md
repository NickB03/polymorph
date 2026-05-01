# Evals Dashboard IA Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Lift the IA proposal demonstrated at `/admin/evals/demo-redesign` into the canonical `/admin/evals` route. Replace the current 3-section "Overview / Suites / History" layout (where tabs do nothing) with two URL-driven tabs (Suites + Run history), a compact threshold-breach banner, suite-card drill-down navigation, and a deep-linkable `?suite=` parameter. Cut the redundant `KpiStrip` and `CombinedTrend` chart that aren't earning their slots. Delete the three demo routes after the canonical route is live.

**Architecture:** Extract the demo's small components (CompactAlert, SuiteSelector, EvaluatorBreakdown, CollapsibleComparison, ViewSwitcher, AutoBadge) and pure helpers (label override, URL state) into proper files under `components/evals/dashboard-v2/`. Replace the orchestrator `dashboard-v2/dashboard.tsx` body with the new structure. Compact the shared `AlertBanner` upstream so the production banner matches the new pattern. Delete the demo routes and now-orphaned components in a final cleanup pass.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, lucide-react icons, Radix UI Tooltip primitive (via shared `ScoreCell`). Test framework: Vitest with jsdom for `lib/**` pure logic.

---

## Reference material

Keep these open while executing the plan:

- **Source-of-truth demo:** `components/evals/demo/redesign-dashboard.tsx` on branch `evals-redesign-demo` — every component extracted in this plan is lifted from here.
- **Decisions context doc:** `docs/plans/evals-dashboard-ia-migration.md` — high-level migration phases and the 5 resolved design decisions.
- **Demo route entry:** `app/(admin)/admin/evals/demo-redesign/page.tsx`
- **Production entry being replaced:** `app/(admin)/admin/evals/page.tsx` → `components/evals/dashboard-v2/dashboard.tsx`
- **Yesterday's plan (the one that built the current production):** `docs/superpowers/plans/2026-04-29-evals-dashboard-redesign.md`
- **CLAUDE.md non-obvious invariants:** path alias `@/*`, Prettier no-semicolons/single-quotes/no-trailing-commas, ESLint forbids direct `motion/react` imports, dashboard runs on port 43100.

## Decisions baked into this plan

These are locked in. Do not relitigate.

1. **"Prechecks" label is a local override.** Lives in `dashboard-v2/local-labels.ts`. Global `getEvaluatorLabel` keeps "Deterministic Prechecks" everywhere else.
2. **Compare section defaults expanded behind a chevron collapse.** No verbose "Show comparison side-by-side" pill button. Standard `ChevronUp` / `ChevronDown` icons from `lucide-react`.
3. **`CombinedTrend` chart is deleted.** No sparkline, no collapsible. Phoenix is the canonical place for time-series investigation. Post Slack heads-up before merging.
4. **`?suite=` URL param ships in this plan (not a follow-up).** Same `replaceState` pattern as `?view=`. Both URL contracts ship together — no legacy bookmark migration later.
5. **Tagline above the score ring is cut.** `ScoreFeature` has a backward-compatible `hideTagline` prop (already added on the demo branch — this plan just passes it).

---

## File Structure

### Created

| Path                                                       | Responsibility                                                                                            |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `components/evals/dashboard-v2/local-labels.ts`            | `LOCAL_LABEL_OVERRIDES` map + `localLabel(key)` helper. Pure logic, tested.                               |
| `components/evals/dashboard-v2/url-state.ts`               | View + suite URL parsing + write helpers. Pure logic, tested.                                             |
| `components/evals/dashboard-v2/auto-badge.tsx`             | Pill-style "AUTO" badge for deterministic evaluator rows.                                                 |
| `components/evals/dashboard-v2/compact-alert.tsx`          | Single-row threshold breach banner (replaces the full-width Card-based `AlertBanner` for this dashboard). |
| `components/evals/dashboard-v2/view-switcher.tsx`          | Pill-group 2-tab switcher (Suites / Run history) wired to URL state.                                      |
| `components/evals/dashboard-v2/suite-selector.tsx`         | 3 clickable suite cards. Click updates `?suite=` URL param + active drill-down.                           |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx`    | Per-judge breakdown panel. Each row uses shared `ScoreCell` for the rich hover tooltip.                   |
| `components/evals/dashboard-v2/collapsible-comparison.tsx` | Chevron-collapse wrapper around shared `ComparisonTable`. Default expanded.                               |
| `components/evals/dashboard-v2/local-labels.test.ts`       | Unit tests for `localLabel`.                                                                              |
| `components/evals/dashboard-v2/url-state.test.ts`          | Unit tests for `isView` / `isSuiteId`.                                                                    |

### Modified

| Path                                           | Change                                                                                                                                                                               |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/evals/dashboard-v2/dashboard.tsx`  | Replace the body of `EvalsDashboardV2` with the new 2-view orchestrator. Keep the `data: EvalsDashboardData` prop signature unchanged; drop the `footer` prop (no longer used).      |
| `components/evals/dashboard/header.tsx`        | Drop the visual-only `ViewSwitcher` (the new functional one lives in `dashboard-v2/view-switcher.tsx`). Add a "{cases} cases scored in the last 48h" segment to the subtitle.        |
| `components/evals/widgets/alert-banner.tsx`    | Replace the Card-based body with the compact-row pattern. Preserve the `data-testid="eval-alert-banner"` so existing tests still target the same element. Adopt CompactAlert design. |
| `components/evals/dashboard/score-feature.tsx` | (No changes — backward-compatible `hideTagline?: boolean` prop already exists. The new `dashboard-v2/dashboard.tsx` just passes `hideTagline`.)                                      |

### Deleted

| Path                                             | Reason                                                              |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `app/(admin)/admin/evals/demo-redesign/page.tsx` | Demo route no longer needed — canonical adopts its design.          |
| `app/(admin)/admin/evals/demo/page.tsx`          | Demo route no longer needed.                                        |
| `app/(admin)/admin/evals/demo-mixed/page.tsx`    | Demo route no longer needed.                                        |
| `components/evals/demo/redesign-dashboard.tsx`   | Demo component superseded.                                          |
| `components/evals/demo/polished-dashboard.tsx`   | Demo component superseded.                                          |
| `components/evals/demo/mixed-dashboard.tsx`      | Demo component superseded.                                          |
| `components/evals/demo/` (the directory itself)  | Empty after the three demos deleted.                                |
| `components/evals/dashboard/kpi-strip.tsx`       | No remaining consumers after Task 9 (canonical dashboard drops it). |
| `components/evals/dashboard/combined-trend.tsx`  | No remaining consumers after Task 9 (canonical dashboard drops it). |

---

## Tasks

### Task 1: Local-labels helper with tests

**Files:**

- Create: `components/evals/dashboard-v2/local-labels.ts`
- Test: `components/evals/dashboard-v2/local-labels.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/evals/dashboard-v2/local-labels.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { localLabel } from './local-labels'

describe('localLabel', () => {
  it('returns shortened label for deterministic_prechecks', () => {
    expect(localLabel('deterministic_prechecks')).toBe('Prechecks')
  })

  it('falls through to canonical label for non-overridden keys', () => {
    expect(localLabel('faithfulness')).toBe('Faithfulness')
    expect(localLabel('tool_usage')).toBe('Tool Usage')
  })

  it('falls through for unknown keys', () => {
    expect(localLabel('nonexistent_judge')).toBe('Nonexistent Judge')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/evals/dashboard-v2/local-labels.test.ts`
Expected: FAIL — `Cannot find module './local-labels'`

- [ ] **Step 3: Write the minimal implementation**

Create `components/evals/dashboard-v2/local-labels.ts`:

```typescript
import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'

// Local label override: "Deterministic Prechecks" is too long for the
// 2-column row + AUTO badge layout in EvaluatorBreakdown. The canonical
// name (in `lib/evals/evaluator-labels.ts`) is preserved everywhere else.
export const LOCAL_LABEL_OVERRIDES: Record<string, string> = {
  deterministic_prechecks: 'Prechecks'
}

export function localLabel(key: string): string {
  return LOCAL_LABEL_OVERRIDES[key] ?? getEvaluatorLabel(key)
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/evals/dashboard-v2/local-labels.test.ts`
Expected: 3 passed

- [ ] **Step 5: Commit**

```bash
git add components/evals/dashboard-v2/local-labels.ts components/evals/dashboard-v2/local-labels.test.ts
git commit -m "feat(evals): add local-labels override for dashboard-v2"
```

---

### Task 2: URL-state helpers with tests

**Files:**

- Create: `components/evals/dashboard-v2/url-state.ts`
- Test: `components/evals/dashboard-v2/url-state.test.ts`

- [ ] **Step 1: Write the failing test**

Create `components/evals/dashboard-v2/url-state.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'

import { isSuiteId, isView } from './url-state'

describe('isView', () => {
  it('accepts known view ids', () => {
    expect(isView('suites')).toBe(true)
    expect(isView('history')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isView('overview')).toBe(false)
    expect(isView('foo')).toBe(false)
    expect(isView(null)).toBe(false)
    expect(isView('')).toBe(false)
  })
})

describe('isSuiteId', () => {
  it('accepts known suite ids', () => {
    expect(isSuiteId('capability')).toBe(true)
    expect(isSuiteId('trafficMonitor')).toBe(true)
    expect(isSuiteId('regression')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isSuiteId('benchmarks')).toBe(false)
    expect(isSuiteId('traffic-monitor')).toBe(false)
    expect(isSuiteId(null)).toBe(false)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/evals/dashboard-v2/url-state.test.ts`
Expected: FAIL — `Cannot find module './url-state'`

- [ ] **Step 3: Write the implementation**

Create `components/evals/dashboard-v2/url-state.ts`:

```typescript
export type View = 'suites' | 'history'
export type SuiteId = 'capability' | 'trafficMonitor' | 'regression'

export function isView(value: string | null): value is View {
  return value === 'suites' || value === 'history'
}

export function isSuiteId(value: string | null): value is SuiteId {
  return (
    value === 'capability' ||
    value === 'trafficMonitor' ||
    value === 'regression'
  )
}

// Update the URL search param without pushing to history. Refresh-safe
// (the value will be re-read from the URL on next mount) but back-button
// behavior stays sane (one entry per real navigation).
export function replaceSearchParam(key: string, value: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url.toString())
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- components/evals/dashboard-v2/url-state.test.ts`
Expected: 2 suites, 4 passed

- [ ] **Step 5: Commit**

```bash
git add components/evals/dashboard-v2/url-state.ts components/evals/dashboard-v2/url-state.test.ts
git commit -m "feat(evals): add url-state helpers for view + suite params"
```

---

### Task 3: Extract AutoBadge component

**Files:**

- Create: `components/evals/dashboard-v2/auto-badge.tsx`

- [ ] **Step 1: Create the component**

Create `components/evals/dashboard-v2/auto-badge.tsx`:

```typescript
export function AutoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
      auto
    </span>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep auto-badge`
Expected: no output (no errors involving the new file)

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard-v2/auto-badge.tsx
git commit -m "feat(evals): extract AutoBadge component"
```

---

### Task 4: Extract CompactAlert component

**Files:**

- Create: `components/evals/dashboard-v2/compact-alert.tsx`

- [ ] **Step 1: Create the component**

Create `components/evals/dashboard-v2/compact-alert.tsx`:

```typescript
import { TriangleAlert } from 'lucide-react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getLatestThresholdAlert } from '@/lib/evals/helpers/alerts'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { pct } from '@/components/evals/dashboard/shared'

export function CompactAlert({ data }: { data: EvalsDashboardData }) {
  const alert = getLatestThresholdAlert(data)
  if (!alert) return null

  const failingJudges =
    alert.failedEvaluators.length > 0
      ? alert.failedEvaluators.map(getEvaluatorLabel).join(', ')
      : null

  return (
    <div
      data-testid="eval-alert-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm"
    >
      <TriangleAlert className="size-4 shrink-0 text-rose-600" />
      <span className="font-medium">{alert.suiteLabel} below threshold</span>
      {failingJudges ? (
        <span className="text-muted-foreground">
          · {failingJudges} at {pct(alert.passRate)} (threshold{' '}
          {pct(alert.threshold)})
        </span>
      ) : (
        <span className="text-muted-foreground">
          · pass rate {pct(alert.passRate)} (threshold {pct(alert.threshold)})
        </span>
      )}
      {alert.phoenixUrl ? (
        <a
          href={alert.phoenixUrl}
          rel="noreferrer"
          target="_blank"
          className="ml-auto text-xs font-medium text-rose-400 underline-offset-4 hover:underline"
        >
          Open Phoenix →
        </a>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep compact-alert`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard-v2/compact-alert.tsx
git commit -m "feat(evals): extract CompactAlert component"
```

---

### Task 5: Extract ViewSwitcher component

**Files:**

- Create: `components/evals/dashboard-v2/view-switcher.tsx`

- [ ] **Step 1: Create the component**

Create `components/evals/dashboard-v2/view-switcher.tsx`:

```typescript
'use client'

import { cn } from '@/lib/utils'

import type { View } from './url-state'

const VIEWS: ReadonlyArray<{
  id: View
  label: string
  description: string
}> = [
  {
    id: 'suites',
    label: 'Suites',
    description: 'How each dataset is scoring right now.'
  },
  {
    id: 'history',
    label: 'Run history',
    description: 'What changed and when.'
  }
]

export function getViewDescription(view: View): string {
  return VIEWS.find(v => v.id === view)?.description ?? ''
}

export function ViewSwitcher({
  value,
  onChange
}: {
  value: View
  onChange: (next: View) => void
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Dashboard view"
      className="inline-flex shrink-0 items-center gap-1 self-start rounded-full border border-border bg-background p-1 shadow-xs"
    >
      {VIEWS.map(v => {
        const on = value === v.id
        return (
          <button
            key={v.id}
            role="radio"
            aria-checked={on}
            type="button"
            onClick={() => onChange(v.id)}
            className={cn(
              'rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors',
              on
                ? 'bg-accent-blue/10 text-accent-blue'
                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
            )}
          >
            {v.label}
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep view-switcher`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard-v2/view-switcher.tsx
git commit -m "feat(evals): extract ViewSwitcher component (URL-driven)"
```

---

### Task 6: Extract SuiteSelector component

**Files:**

- Create: `components/evals/dashboard-v2/suite-selector.tsx`

- [ ] **Step 1: Create the component**

Create `components/evals/dashboard-v2/suite-selector.tsx`:

```typescript
'use client'

import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import type { SuiteId } from './url-state'

const SUITE_TABS: ReadonlyArray<{
  id: SuiteId
  label: string
  tagline: string
}> = [
  {
    id: 'capability',
    label: 'Benchmarks',
    tagline: 'Curated prompts · the model under controlled inputs'
  },
  {
    id: 'trafficMonitor',
    label: 'Live traffic',
    tagline: 'Sampled production chats · what shipping looks like'
  },
  {
    id: 'regression',
    label: 'Pinned checks',
    tagline: 'Known-risk fixtures · catch drift quietly'
  }
]

export function SuiteSelector({
  active,
  onChange,
  snaps
}: {
  active: SuiteId
  onChange: (id: SuiteId) => void
  snaps: Record<SuiteId, EvalSummarySnapshot | null>
}) {
  return (
    <div
      role="tablist"
      aria-label="Evaluation suite"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {SUITE_TABS.map(tab => {
        const on = tab.id === active
        const s = snaps[tab.id]
        return (
          <button
            key={tab.id}
            role="tab"
            aria-selected={on}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              'flex flex-col items-start gap-2 rounded-2xl border p-4 text-left transition-colors',
              on
                ? 'border-accent-blue/40 bg-accent-blue/5'
                : 'border-border/60 bg-background hover:bg-muted/40'
            )}
          >
            <div className="flex w-full items-baseline justify-between gap-2">
              <span className="text-sm font-semibold tracking-tight">
                {tab.label}
              </span>
              <span
                className={cn(
                  'font-mono text-base font-semibold tabular-nums',
                  s?.thresholdBreached
                    ? 'text-destructive'
                    : 'text-foreground'
                )}
              >
                {s ? pct(s.overallScore) : '—'}
              </span>
            </div>
            <p className="text-xs leading-snug text-muted-foreground">
              {tab.tagline}
            </p>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep suite-selector`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard-v2/suite-selector.tsx
git commit -m "feat(evals): extract SuiteSelector component"
```

---

### Task 7: Extract EvaluatorBreakdown component

**Files:**

- Create: `components/evals/dashboard-v2/evaluator-breakdown.tsx`

- [ ] **Step 1: Create the component**

Create `components/evals/dashboard-v2/evaluator-breakdown.tsx`:

```typescript
'use client'

import { useMemo } from 'react'

import { EVALUATOR_DISPLAY_ORDER } from '@/lib/evals/evaluator-labels'
import { snapshotSuiteKey } from '@/lib/evals/glossary'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { ScoreBar } from '@/components/evals/dashboard/score-bar'
import { pct } from '@/components/evals/dashboard/shared'
import { ScoreCell } from '@/components/evals/glossary'

import { AutoBadge } from './auto-badge'
import { localLabel } from './local-labels'

const DETERMINISTIC_KEYS = new Set(['deterministic_prechecks', 'tool_usage'])

export function EvaluatorBreakdown({ snap }: { snap: EvalSummarySnapshot }) {
  const failed = useMemo(
    () => new Set(snap.failedEvaluators),
    [snap.failedEvaluators]
  )
  const suiteKey = snapshotSuiteKey(snap)

  return (
    <section className="flex h-full flex-col gap-4 rounded-2xl border border-border/60 bg-background p-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">
          Evaluator breakdown
        </h3>
        <p className="text-xs leading-snug text-muted-foreground">
          One row per evaluator. Rows tagged <AutoBadge /> are deterministic
          rules that gate eligibility — the rest are LLM judges. Hover any row
          for the judge’s definition and threshold status.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const v = snap.evaluatorScores[key]
          if (v == null) return null
          const isAuto = DETERMINISTIC_KEYS.has(key)
          const isFailed = failed.has(key)
          return (
            <li key={key}>
              <ScoreCell
                suite={suiteKey}
                judgeKey={key}
                value={v}
                caseCount={snap.totalCases}
                threshold={snap.threshold}
                failed={isFailed}
              >
                <span className="-mx-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_44px] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'truncate',
                        isFailed ? 'text-destructive' : 'text-foreground'
                      )}
                    >
                      {localLabel(key)}
                    </span>
                    {isAuto ? <AutoBadge /> : null}
                  </span>
                  <ScoreBar
                    failed={isFailed}
                    threshold={snap.threshold}
                    value={v}
                  />
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      isFailed ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {pct(v)}
                  </span>
                </span>
              </ScoreCell>
            </li>
          )
        })}
      </ul>

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span>
          Experiment <span className="font-mono">{snap.experimentName}</span>
        </span>
        <span>
          Dataset <span className="font-mono">{snap.datasetName}</span>
        </span>
        {snap.phoenixUrl ? (
          <a
            href={snap.phoenixUrl}
            rel="noreferrer"
            target="_blank"
            className="ml-auto text-accent-blue underline-offset-4 hover:underline"
          >
            Inspect in Phoenix →
          </a>
        ) : null}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep evaluator-breakdown`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard-v2/evaluator-breakdown.tsx
git commit -m "feat(evals): extract EvaluatorBreakdown with ScoreCell tooltips"
```

---

### Task 8: Extract CollapsibleComparison wrapper

**Files:**

- Create: `components/evals/dashboard-v2/collapsible-comparison.tsx`

- [ ] **Step 1: Create the component**

Create `components/evals/dashboard-v2/collapsible-comparison.tsx`:

```typescript
'use client'

import { useState } from 'react'

import { ChevronDown, ChevronUp } from 'lucide-react'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { ComparisonTable } from '@/components/evals/dashboard/comparison-table'

export function CollapsibleComparison({
  cap,
  traf
}: {
  cap: EvalSummarySnapshot
  traf: EvalSummarySnapshot
}) {
  const [open, setOpen] = useState(true)

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-expanded={false}
        className="flex w-full items-center justify-between rounded-2xl border border-border/60 bg-background px-5 py-3 text-left transition-colors hover:bg-muted/40"
      >
        <span className="text-sm font-medium">
          Where curated and live diverge
        </span>
        <ChevronDown className="size-4 text-muted-foreground" />
      </button>
    )
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(false)}
        aria-expanded={true}
        aria-label="Collapse comparison"
        className="absolute right-4 top-4 z-10 inline-flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted/40 hover:text-foreground"
      >
        <ChevronUp className="size-4" />
      </button>
      <ComparisonTable cap={cap} traf={traf} />
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep collapsible-comparison`
Expected: no output

- [ ] **Step 3: Commit**

```bash
git add components/evals/dashboard-v2/collapsible-comparison.tsx
git commit -m "feat(evals): extract CollapsibleComparison wrapper"
```

---

### Task 9: Replace dashboard.tsx body with new orchestrator

**Files:**

- Modify: `components/evals/dashboard-v2/dashboard.tsx`

- [ ] **Step 1: Replace the entire file content**

Overwrite `components/evals/dashboard-v2/dashboard.tsx` with:

```typescript
'use client'

import type { CSSProperties } from 'react'
import { useCallback, useState } from 'react'

import { useSearchParams } from 'next/navigation'

import { formatDistanceToNow } from 'date-fns'

import type {
  EvalsDashboardData,
  EvalSummarySnapshot
} from '@/lib/evals/types'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'

import { CollapsibleComparison } from './collapsible-comparison'
import { CompactAlert } from './compact-alert'
import { EvaluatorBreakdown } from './evaluator-breakdown'
import { SuiteSelector } from './suite-selector'
import {
  isSuiteId,
  isView,
  replaceSearchParam,
  type SuiteId,
  type View
} from './url-state'
import { getViewDescription, ViewSwitcher } from './view-switcher'

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
            <Header view="suites" onChange={() => {}} data={data} />
            <p className="rounded-2xl border border-dashed border-border/60 bg-muted/10 p-12 text-center text-sm text-muted-foreground">
              No evaluation runs have landed yet. The next Traffic Monitor cron
              will populate this page.
            </p>
          </div>
        </div>
      </TooltipProvider>
    )
  }

  return <DashboardWithViews data={data} />
}

function DashboardWithViews({ data }: { data: EvalsDashboardData }) {
  const search = useSearchParams()
  const initialView: View = isView(search.get('view'))
    ? (search.get('view') as View)
    : 'suites'
  const [view, setViewState] = useState<View>(initialView)

  const setView = useCallback((next: View) => {
    setViewState(next)
    replaceSearchParam('view', next)
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <Header view={view} onChange={setView} data={data} />

          {view === 'suites' ? <SuitesView data={data} /> : null}
          {view === 'history' ? (
            <div className="motion-safe:animate-content-enter" style={enter(60)}>
              <ActivityList data={data} />
            </div>
          ) : null}
        </div>
      </div>
    </TooltipProvider>
  )
}

function Header({
  view,
  onChange,
  data
}: {
  view: View
  onChange: (next: View) => void
  data: EvalsDashboardData
}) {
  const lastSyncIso = data.trafficMonitor.lastUpdated
  const lastSync = lastSyncIso
    ? formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true })
    : 'never'
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const totalCases = (cap?.totalCases ?? 0) + (traf?.totalCases ?? 0)

  return (
    <header
      className="space-y-6 border-b border-border/60 pb-6 motion-safe:animate-content-enter"
      style={enter(0)}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
            Polymorph · Quality evals
          </p>
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
            Response quality
          </h1>
        </div>
        <ViewSwitcher value={view} onChange={onChange} />
      </div>
      <div className="space-y-2">
        <p className="text-sm leading-relaxed text-muted-foreground">
          {getViewDescription(view)} {totalCases} cases scored in the last 48h ·
          last sync {lastSync}.
        </p>
      </div>
    </header>
  )
}

function SuitesView({ data }: { data: EvalsDashboardData }) {
  const search = useSearchParams()
  const initialSuite: SuiteId = isSuiteId(search.get('suite'))
    ? (search.get('suite') as SuiteId)
    : 'capability'
  const [active, setActiveState] = useState<SuiteId>(initialSuite)

  const setActive = useCallback((next: SuiteId) => {
    setActiveState(next)
    replaceSearchParam('suite', next)
  }, [])

  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  const reg = data.regression.latest

  const previousMap: Record<SuiteId, EvalSummarySnapshot | null> = {
    capability: data.capability.previous,
    trafficMonitor: data.trafficMonitor.previous,
    regression: data.regression.previous
  }
  const snapMap: Record<SuiteId, EvalSummarySnapshot | null> = {
    capability: cap,
    trafficMonitor: traf,
    regression: reg
  }
  const activeSnap = snapMap[active]

  return (
    <div
      className="space-y-10 motion-safe:animate-content-enter"
      style={enter(60)}
    >
      <CompactAlert data={data} />

      <SuiteSelector active={active} onChange={setActive} snaps={snapMap} />

      {activeSnap ? (
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <ScoreFeature
              cap={activeSnap}
              previous={previousMap[active]}
              hideTagline
            />
          </div>
          <div className="lg:col-span-8">
            <EvaluatorBreakdown snap={activeSnap} />
          </div>
        </div>
      ) : null}

      {cap && traf ? <CollapsibleComparison cap={cap} traf={traf} /> : null}
    </div>
  )
}
```

- [ ] **Step 2: Verify typecheck**

Run: `bun typecheck 2>&1 | grep dashboard-v2`
Expected: no output

- [ ] **Step 3: Verify lint**

Run: `bun lint 2>&1 | grep dashboard-v2`
Expected: no output

- [ ] **Step 4: Smoke test the route loads**

Ensure dev server is running (`bun dev` on port 43100). Run:

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:43100/admin/evals
```

Expected: `307` (auth redirect) — route compiled without errors.

- [ ] **Step 5: Commit**

```bash
git add components/evals/dashboard-v2/dashboard.tsx
git commit -m "feat(evals): replace dashboard-v2 body with new IA orchestrator"
```

---

### Task 10: Update header.tsx — drop dead ViewSwitcher

**Files:**

- Modify: `components/evals/dashboard/header.tsx`

The new functional `ViewSwitcher` lives in `dashboard-v2/view-switcher.tsx` and is rendered by the new `dashboard-v2/dashboard.tsx`. The old `dashboard/header.tsx` is no longer referenced from the orchestrator. Confirm and delete or simplify.

- [ ] **Step 1: Verify the old header is no longer imported**

Run: `grep -r "from '@/components/evals/dashboard/header'" --include="*.tsx" --include="*.ts" .`
Expected: zero matches (other than possibly tests)

If matches exist outside tests, the orchestrator still references it; revisit Task 9.

- [ ] **Step 2: Delete the orphaned header file**

```bash
rm components/evals/dashboard/header.tsx
```

- [ ] **Step 3: Verify typecheck still passes**

Run: `bun typecheck 2>&1 | grep -E "(header|dashboard)"`
Expected: no errors

- [ ] **Step 4: Commit**

```bash
git add -u components/evals/dashboard/header.tsx
git commit -m "ref(evals): remove orphaned dashboard/header.tsx"
```

---

### Task 11: Compact the shared AlertBanner

**Files:**

- Modify: `components/evals/widgets/alert-banner.tsx`
- Reference: existing `data-testid="eval-alert-banner"` must be preserved

- [ ] **Step 1: Check for existing tests**

Run: `find . -name "alert-banner*.test.*" -not -path "*/node_modules/*"`
Expected: list any existing alert-banner tests, OR no output. If tests exist, read them so the new compact body still passes their assertions on `data-testid` and any link selectors.

- [ ] **Step 2: Replace the file body**

Overwrite `components/evals/widgets/alert-banner.tsx` with:

```typescript
import { TriangleAlert } from 'lucide-react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getLatestThresholdAlert } from '@/lib/evals/helpers/alerts'
import type { EvalsDashboardData } from '@/lib/evals/types'

function formatPercent(value: number) {
  return `${Math.round(value * 100)}%`
}

export function AlertBanner({ data }: { data: EvalsDashboardData }) {
  const alert = getLatestThresholdAlert(data)
  if (!alert) return null

  const failingJudges =
    alert.failedEvaluators.length > 0
      ? alert.failedEvaluators.map(getEvaluatorLabel).join(', ')
      : null

  return (
    <div
      data-testid="eval-alert-banner"
      className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-rose-500/40 bg-rose-500/5 px-3 py-2 text-sm"
    >
      <TriangleAlert className="size-4 shrink-0 text-rose-600" />
      <span className="font-medium">{alert.suiteLabel} below threshold</span>
      {failingJudges ? (
        <span className="text-muted-foreground">
          · {failingJudges} at {formatPercent(alert.passRate)} (threshold{' '}
          {formatPercent(alert.threshold)})
        </span>
      ) : (
        <span className="text-muted-foreground">
          · pass rate {formatPercent(alert.passRate)} (threshold{' '}
          {formatPercent(alert.threshold)})
        </span>
      )}
      {alert.phoenixUrl ? (
        <a
          href={alert.phoenixUrl}
          rel="noreferrer"
          target="_blank"
          className="ml-auto text-xs font-medium text-rose-400 underline-offset-4 hover:underline"
        >
          Open Phoenix →
        </a>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 3: Run any existing alert-banner tests**

Run: `bun run test -- alert-banner`
Expected: all pass. If a test asserts on the old "Traffic Monitor fell below its recorded threshold." copy, update the test to match the new compact text — the data-testid still resolves the element.

- [ ] **Step 4: Verify lint + typecheck**

Run: `bun lint 2>&1 | grep alert-banner`
Run: `bun typecheck 2>&1 | grep alert-banner`
Expected: no output from either.

- [ ] **Step 5: Commit**

```bash
git add components/evals/widgets/alert-banner.tsx
git commit -m "ref(evals): compact AlertBanner to single-row pattern"
```

---

### Task 12: Manual QA verification on /admin/evals

This is a checklist task — no code changes. Visit the running dev server and walk through each item.

Ensure dev server is running on port 43100. Sign in as a user with eval data (or use a fixture).

- [ ] **`/admin/evals` loads without console errors.** Open browser devtools console; reload route.
- [ ] **Default view is Suites** (the URL shows no `?view=` param, but the Suites pill is highlighted).
- [ ] **Subtitle shows "{N} cases scored in the last 48h · last sync {time}"** with non-zero N.
- [ ] **Tab switch updates URL.** Click "Run history" → URL becomes `?view=history`. Click "Suites" → URL becomes `?view=suites` (or returns to no param if you implemented that branch).
- [ ] **Deep link `?view=history` lands on history.** Open in fresh tab.
- [ ] **CompactAlert appears when any suite is breached.** Verify with seeded breach data; confirm the banner shows suite name + failing judge + threshold + Phoenix link.
- [ ] **Three suite cards render with current scores.** Click "Live traffic" → URL becomes `?suite=trafficMonitor` and the drill-down (ring + EvaluatorBreakdown) updates atomically.
- [ ] **Deep link `?suite=trafficMonitor` lands on Live traffic** with no other URL params.
- [ ] **Suite ring header shows "{Suite name} · on demand"** with no tagline below.
- [ ] **Hover any evaluator row** → rich tooltip with judge definition + threshold status + failure modes.
- [ ] **Hover the score ring** → per-judge breakdown popover.
- [ ] **AUTO badge appears only on `Tool Usage` and `Prechecks` rows** (not on the 5 LLM judges).
- [ ] **Comparison section is expanded by default.** Chevron-up button visible top-right.
- [ ] **Click chevron-up** → comparison collapses to single-row "Where curated and live diverge ▾". Click row → expands again.
- [ ] **Click "Open Phoenix →" in CompactAlert** → opens new tab to the alert's `phoenixUrl`.
- [ ] **Switch to Run history tab** → ActivityList renders, expand a row → per-judge breakdown shows; "Inspect in Phoenix →" link works.
- [ ] **Resize to mobile width (~400px)** → suite cards stack, evaluator breakdown stays readable, no horizontal scroll.
- [ ] **Keyboard:** Tab through dashboard. Confirm: ViewSwitcher pills, suite cards, evaluator rows (each focusable via ScoreCell's `tabIndex=0`), chevron, ActivityList rows are all reachable. Focus rings visible.

Document any failures inline before proceeding to Task 13.

---

### Task 13: Delete the demo routes

**Files:**

- Delete: `app/(admin)/admin/evals/demo-redesign/page.tsx`
- Delete: `app/(admin)/admin/evals/demo/page.tsx`
- Delete: `app/(admin)/admin/evals/demo-mixed/page.tsx`

- [ ] **Step 1: Confirm no production code references these routes**

Run: `grep -rn "/admin/evals/demo" --include="*.tsx" --include="*.ts" --include="*.md" . | grep -v "docs/" | grep -v "/demo/"`
Expected: no matches in app/components/lib code (matches in docs/plans are OK — those are reference docs).

- [ ] **Step 2: Delete the directories**

```bash
rm -rf "app/(admin)/admin/evals/demo-redesign"
rm -rf "app/(admin)/admin/evals/demo"
rm -rf "app/(admin)/admin/evals/demo-mixed"
```

- [ ] **Step 3: Verify build still passes**

Run: `bun run build 2>&1 | tail -30`
Expected: build succeeds; no missing route errors.

- [ ] **Step 4: Commit**

```bash
git add -u "app/(admin)/admin/evals/"
git commit -m "ref(evals): delete demo routes after IA migration"
```

---

### Task 14: Delete demo components

**Files:**

- Delete: `components/evals/demo/redesign-dashboard.tsx`
- Delete: `components/evals/demo/polished-dashboard.tsx`
- Delete: `components/evals/demo/mixed-dashboard.tsx`
- Delete: `components/evals/demo/` (the directory if empty)

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "components/evals/demo" --include="*.tsx" --include="*.ts" .`
Expected: no matches in source code (the demo route imports were already deleted in Task 13).

- [ ] **Step 2: Delete the files**

```bash
rm -rf components/evals/demo
```

- [ ] **Step 3: Verify typecheck + build**

Run: `bun typecheck 2>&1 | grep "components/evals/demo"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add -u components/evals/demo
git commit -m "ref(evals): delete demo dashboard components"
```

---

### Task 15: Delete orphaned KpiStrip and CombinedTrend

**Files:**

- Delete: `components/evals/dashboard/kpi-strip.tsx`
- Delete: `components/evals/dashboard/combined-trend.tsx`

- [ ] **Step 1: Confirm no remaining imports**

Run: `grep -rn "from '@/components/evals/dashboard/kpi-strip'" --include="*.tsx" --include="*.ts" .`
Expected: no matches.

Run: `grep -rn "from '@/components/evals/dashboard/combined-trend'" --include="*.tsx" --include="*.ts" .`
Expected: no matches.

If either has matches, do NOT delete that file — investigate the lingering consumer first.

- [ ] **Step 2: Delete both files**

```bash
rm components/evals/dashboard/kpi-strip.tsx components/evals/dashboard/combined-trend.tsx
```

- [ ] **Step 3: Verify typecheck + build**

Run: `bun typecheck 2>&1 | grep -E "(kpi-strip|combined-trend)"`
Expected: no output.

Run: `bun run build 2>&1 | tail -20`
Expected: build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -u components/evals/dashboard
git commit -m "ref(evals): delete orphaned KpiStrip and CombinedTrend"
```

---

### Task 16: Final integration verification

This is the merge-ready gate. Everything must be green.

- [ ] **Step 1: Lint clean**

Run: `bun lint`
Expected: 0 errors, 0 warnings (or only errors in `.agents/skills/` template files which are unrelated to this migration).

- [ ] **Step 2: Typecheck clean**

Run: `bun typecheck`
Expected: 0 errors in `app/`, `components/`, or `lib/` (skill template errors in `skills/` are unrelated and pre-existing).

- [ ] **Step 3: Test suite passes**

Run: `bun run test`
Expected: all tests green. The new `local-labels.test.ts` and `url-state.test.ts` should be among the passing suites.

- [ ] **Step 4: Production build succeeds**

Run: `bun run build`
Expected: `✓ Compiled successfully`.

- [ ] **Step 5: Slack heads-up posted**

Per decision #3, post to the team Slack: "Heads up — `/admin/evals` no longer has the 14d trend chart on the landing view. Phoenix is the canonical place for time-series investigation; the per-suite drill-down still has 'Inspect in Phoenix →' links. Land on the new IA at PR #X."

This is a manual step. Confirm the message went out before merging.

- [ ] **Step 6: Open the PR**

If not already open:

```bash
gh pr create --title "Migrate /admin/evals to redesigned IA" --body "$(cat docs/plans/evals-dashboard-ia-migration.md)"
```

- [ ] **Step 7: Final commit (if anything was tweaked during verification)**

```bash
git add -A
git commit -m "ref(evals): final cleanup before merge" || echo "nothing to commit"
git push
```

---

## Rollback

The migration is scoped to `components/evals/`, `app/(admin)/admin/evals/`, and `components/evals/widgets/alert-banner.tsx`. Reverting the merge commit restores the previous `EvalsDashboardV2` (the one yesterday's plan built). No data or schema implications.

If only the AlertBanner change needs reverting (e.g., the compact form breaks an unrelated consumer), revert that file specifically:

```bash
git revert <alert-banner-commit-sha> -- components/evals/widgets/alert-banner.tsx
```

---

## Self-review notes

This plan was checked against the source-of-truth demo file (`components/evals/demo/redesign-dashboard.tsx` on the `evals-redesign-demo` branch) and the 5 resolved decisions doc (`docs/plans/evals-dashboard-ia-migration.md`):

- Spec coverage: every component in the demo is extracted in Tasks 3-8; the orchestrator is rebuilt in Task 9; the 5 design decisions are baked into the extracted code (Prechecks override in Task 1, default-expanded comparison in Task 8, `?suite=` URL state in Task 9, hideTagline pass-through in Task 9, no chart anywhere).
- No placeholders: every step has explicit code or an explicit command with expected output.
- Type consistency: `View`, `SuiteId` types defined in Task 2 are imported and used in Tasks 5, 6, 9; `EvalSummarySnapshot` and `EvalsDashboardData` types come from `@/lib/evals/types` consistently.

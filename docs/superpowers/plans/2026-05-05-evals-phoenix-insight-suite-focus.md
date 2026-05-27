# Phoenix Insight Suite Focus Implementation Plan

> **Status:** Completed historical plan, later superseded by the current dashboard-v2 attention helper. References to `phoenix-insight.tsx` describe a removed intermediate component.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the nontechnical "Test Suite" naming while making `/admin/evals` open the suite that needs attention and explain the reason with a Phoenix insight strip.

**Architecture:** Add a small pure helper for attention-suite selection and Phoenix insight copy, then render a focused insight strip above the suite selector. Preserve explicit `?suite=` deep links, but when no suite is selected, default to the latest threshold-breached suite before falling back to Test Suite, Production Evals, then Regression Tests.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Tailwind v4, lucide-react, Vitest, Testing Library.

---

## Scope Check

This plan touches one subsystem: the current evals dashboard suites view. It does not change eval persistence, Phoenix trace export, seed scripts, the run-history table, or the mobile comparison table. It intentionally keeps user-facing suite labels as:

- `Test Suite`
- `Production Evals`
- `Regression Tests`

## File Structure

### Create

| Path                                                     | Responsibility                                                                                                                                                        |
| -------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/evals/dashboard-v2/attention.ts`             | Pure suite-focus and Phoenix insight helpers. Converts persisted suite IDs to dashboard suite IDs, chooses the default suite, and builds concise explanation copy.    |
| `components/evals/dashboard-v2/attention.test.ts`        | Unit tests for default-suite selection and Phoenix insight copy.                                                                                                      |
| `components/evals/dashboard-v2/phoenix-insight.tsx`      | Presentational insight strip shown when a threshold alert exists. Owns the "Phoenix insight" label, explanation, review button, and optional Phoenix experiment link. |
| `components/evals/dashboard-v2/phoenix-insight.test.tsx` | Component tests for rendered copy and review-button behavior.                                                                                                         |

### Modify

| Path                                               | Change                                                                                                                                                  |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/evals/dashboard-v2/dashboard.tsx`      | Replace `CompactAlert` with `PhoenixInsightStrip`, compute `defaultSuite` from the new helper, and wire the review button to select the alerting suite. |
| `components/evals/dashboard-v2/suite-selector.tsx` | Accept an optional `attentionSuite` prop and show a small "Needs attention" status on the matching suite card.                                          |
| `components/evals/dashboard-v2/dashboard.test.tsx` | Add integration coverage for failing-suite default selection, explicit URL preservation, and review-button selection.                                   |
| `docs/reference/FILE-INDEX.md`                     | Update dashboard-v2 component inventory to describe the new helper and insight strip instead of `CompactAlert`.                                         |

### Delete

| Path                                              | Reason                                                                 |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `components/evals/dashboard-v2/compact-alert.tsx` | Replaced by `PhoenixInsightStrip`; no other current source imports it. |

---

## Implementation Preflight

- [ ] If the active worktree is detached, create a branch before running the commit steps:

```bash
git branch --show-current || true
git switch -c codex/evals-phoenix-insight-suite-focus
```

Expected: the second command is only needed when `git branch --show-current` prints nothing. Keep unrelated local changes out of staged commits.

---

## Task 1: Add Pure Attention-Suite Helpers

**Files:**

- Create: `components/evals/dashboard-v2/attention.test.ts`
- Create: `components/evals/dashboard-v2/attention.ts`

- [ ] **Step 1: Write the failing helper tests**

Create `components/evals/dashboard-v2/attention.test.ts` with this exact content:

```ts
import { describe, expect, it } from 'vitest'

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

import {
  getDefaultSuite,
  getFirstAvailableSuite,
  getPhoenixInsight
} from './attention'

const BASE_SNAPSHOT: EvalSummarySnapshot = {
  id: 'capability-latest',
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
  createdAt: '2026-04-29T12:00:00.000Z'
}

const EMPTY: EvalsDashboardData = {
  capability: { latest: null, previous: null, trend: [], lastUpdated: null },
  regression: { latest: null, previous: null, trend: [], lastUpdated: null },
  trafficMonitor: {
    latest: null,
    previous: null,
    trend: [],
    lastUpdated: null
  },
  recentRuns: []
}

function snapshot(
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot {
  return {
    ...BASE_SNAPSHOT,
    ...overrides,
    evaluatorScores: overrides.evaluatorScores ?? BASE_SNAPSHOT.evaluatorScores,
    failedEvaluators:
      overrides.failedEvaluators ?? BASE_SNAPSHOT.failedEvaluators
  }
}

function data(overrides: Partial<EvalsDashboardData> = {}): EvalsDashboardData {
  return {
    ...EMPTY,
    ...overrides
  }
}

describe('eval dashboard attention helpers', () => {
  it('uses Test Suite as the first available default when there is no alert', () => {
    const capability = snapshot()
    const dashboardData = data({
      capability: {
        latest: capability,
        previous: null,
        trend: [],
        lastUpdated: capability.createdAt
      },
      recentRuns: [capability]
    })

    expect(getFirstAvailableSuite(dashboardData)).toBe('capability')
    expect(getDefaultSuite(dashboardData)).toBe('capability')
    expect(getPhoenixInsight(dashboardData)).toBeNull()
  })

  it('uses Production Evals as the default when live traffic breaches threshold', () => {
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      datasetName: 'capability-dataset',
      thresholdBreached: false,
      passRate: 0.92
    })
    const trafficMonitor = snapshot({
      id: 'traffic-latest',
      suite: 'traffic-monitor',
      datasetName: 'traffic-dataset',
      passRate: 0.78,
      threshold: 0.85,
      thresholdBreached: true,
      failedEvaluators: ['citation_accuracy'],
      phoenixUrl:
        'https://phoenix.example.com/datasets/traffic-dataset/compare?experimentId=traffic-experiment'
    })
    const dashboardData = data({
      capability: {
        latest: capability,
        previous: null,
        trend: [],
        lastUpdated: capability.createdAt
      },
      trafficMonitor: {
        latest: trafficMonitor,
        previous: null,
        trend: [],
        lastUpdated: trafficMonitor.createdAt
      },
      recentRuns: [trafficMonitor, capability]
    })

    const insight = getPhoenixInsight(dashboardData)

    expect(getDefaultSuite(dashboardData)).toBe('trafficMonitor')
    expect(insight?.suiteId).toBe('trafficMonitor')
    expect(insight?.summary).toBe(
      'Production Evals is below threshold while Test Suite is healthy.'
    )
    expect(insight?.interpretation).toBe(
      'This points to live-traffic drift rather than a broad baseline regression.'
    )
    expect(insight?.actionLabel).toBe('Review Production Evals')
  })

  it('uses Regression Tests as the default when regression guardrails breach threshold', () => {
    const capability = snapshot({
      id: 'capability-latest',
      suite: 'capability',
      thresholdBreached: false
    })
    const regression = snapshot({
      id: 'regression-latest',
      suite: 'regression',
      datasetName: 'regression-dataset',
      passRate: 0.7,
      threshold: 0.9,
      thresholdBreached: true,
      failedEvaluators: ['response_quality']
    })
    const dashboardData = data({
      capability: {
        latest: capability,
        previous: null,
        trend: [],
        lastUpdated: capability.createdAt
      },
      regression: {
        latest: regression,
        previous: null,
        trend: [],
        lastUpdated: regression.createdAt
      },
      recentRuns: [regression, capability]
    })

    const insight = getPhoenixInsight(dashboardData)

    expect(getDefaultSuite(dashboardData)).toBe('regression')
    expect(insight?.suiteId).toBe('regression')
    expect(insight?.summary).toBe(
      'Regression Tests is below threshold while Test Suite is healthy.'
    )
    expect(insight?.interpretation).toBe(
      'Known guardrail cases need attention before release.'
    )
  })
})
```

- [ ] **Step 2: Run the helper tests to verify they fail**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/attention.test.ts
```

Expected: FAIL because `components/evals/dashboard-v2/attention.ts` does not exist yet. The failure should include text like:

```text
Error: Failed to resolve import "./attention"
```

- [ ] **Step 3: Add the helper implementation**

Create `components/evals/dashboard-v2/attention.ts` with this exact content:

```ts
import {
  getLatestThresholdAlert,
  type DashboardAlert
} from '@/lib/evals/helpers/alerts'
import type {
  EvalsDashboardData,
  PersistedDashboardSuite
} from '@/lib/evals/types'

import type { SuiteId } from './url-state'

const DASHBOARD_SUITE_BY_PERSISTED: Record<PersistedDashboardSuite, SuiteId> = {
  capability: 'capability',
  regression: 'regression',
  'traffic-monitor': 'trafficMonitor'
}

export interface PhoenixInsight {
  alert: DashboardAlert
  suiteId: SuiteId
  summary: string
  interpretation: string
  actionLabel: string
}

export function persistedSuiteToDashboardSuite(
  suite: PersistedDashboardSuite
): SuiteId {
  return DASHBOARD_SUITE_BY_PERSISTED[suite]
}

export function getFirstAvailableSuite(data: EvalsDashboardData): SuiteId {
  if (data.capability.latest) return 'capability'
  if (data.trafficMonitor.latest) return 'trafficMonitor'
  if (data.regression.latest) return 'regression'
  return 'capability'
}

export function getDefaultSuite(data: EvalsDashboardData): SuiteId {
  return getPhoenixInsight(data)?.suiteId ?? getFirstAvailableSuite(data)
}

export function getPhoenixInsight(
  data: EvalsDashboardData
): PhoenixInsight | null {
  const alert = getLatestThresholdAlert(data)
  if (!alert) return null

  const suiteId = persistedSuiteToDashboardSuite(alert.suite)
  const healthyTestSuite =
    suiteId !== 'capability' &&
    data.capability.latest !== null &&
    !data.capability.latest.thresholdBreached

  return {
    alert,
    suiteId,
    summary: healthyTestSuite
      ? `${alert.suiteLabel} is below threshold while Test Suite is healthy.`
      : `${alert.suiteLabel} is below threshold.`,
    interpretation: getInsightInterpretation(suiteId, healthyTestSuite),
    actionLabel: `Review ${alert.suiteLabel}`
  }
}

function getInsightInterpretation(suiteId: SuiteId, healthyTestSuite: boolean) {
  if (suiteId === 'trafficMonitor' && healthyTestSuite) {
    return 'This points to live-traffic drift rather than a broad baseline regression.'
  }

  if (suiteId === 'trafficMonitor') {
    return 'Start with recent production traces and failed judge examples.'
  }

  if (suiteId === 'regression') {
    return 'Known guardrail cases need attention before release.'
  }

  return 'The controlled Test Suite needs attention before shipping changes.'
}
```

- [ ] **Step 4: Run the helper tests to verify they pass**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/attention.test.ts
```

Expected: PASS. The output should include:

```text
Test Files  1 passed
Tests  3 passed
```

- [ ] **Step 5: Commit the helper slice**

Run:

```bash
git add components/evals/dashboard-v2/attention.ts components/evals/dashboard-v2/attention.test.ts
git commit -m "feat(evals): add phoenix insight suite focus helpers"
```

---

## Task 2: Add the Phoenix Insight Strip

**Files:**

- Create: `components/evals/dashboard-v2/phoenix-insight.test.tsx`
- Create: `components/evals/dashboard-v2/phoenix-insight.tsx`

- [ ] **Step 1: Write the failing component tests**

Create `components/evals/dashboard-v2/phoenix-insight.test.tsx` with this exact content:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { PhoenixInsight } from './attention'
import { PhoenixInsightStrip } from './phoenix-insight'

const INSIGHT: PhoenixInsight = {
  suiteId: 'trafficMonitor',
  summary: 'Production Evals is below threshold while Test Suite is healthy.',
  interpretation:
    'This points to live-traffic drift rather than a broad baseline regression.',
  actionLabel: 'Review Production Evals',
  alert: {
    snapshotId: 'traffic-latest',
    suite: 'traffic-monitor',
    suiteLabel: 'Production Evals',
    experimentName: 'traffic-monitor-2026-05-05',
    datasetName: 'traffic-sample-48h',
    passRate: 0.78,
    threshold: 0.85,
    failedEvaluators: ['citation_accuracy', 'response_quality'],
    totalCases: 36,
    phoenixUrl:
      'https://phoenix.example.com/datasets/traffic-sample-48h/compare?experimentId=traffic-monitor-2026-05-05',
    createdAt: '2026-05-05T12:00:00.000Z'
  }
}

describe('PhoenixInsightStrip', () => {
  it('renders the explanation, score context, and Phoenix experiment link', () => {
    render(<PhoenixInsightStrip insight={INSIGHT} onReview={() => {}} />)

    expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Production Evals is below threshold while Test Suite is healthy.'
      )
    ).toBeInTheDocument()
    expect(
      screen.getByText(
        'This points to live-traffic drift rather than a broad baseline regression.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText(/78% pass rate/i)).toBeInTheDocument()
    expect(screen.getByText(/85% threshold/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /open phoenix/i })).toHaveAttribute(
      'href',
      'https://phoenix.example.com/datasets/traffic-sample-48h/compare?experimentId=traffic-monitor-2026-05-05'
    )
  })

  it('calls onReview when the review button is clicked', () => {
    const onReview = vi.fn()

    render(<PhoenixInsightStrip insight={INSIGHT} onReview={onReview} />)

    fireEvent.click(
      screen.getByRole('button', { name: /review production evals/i })
    )

    expect(onReview).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 2: Run the component tests to verify they fail**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/phoenix-insight.test.tsx
```

Expected: FAIL because `components/evals/dashboard-v2/phoenix-insight.tsx` does not exist yet. The failure should include text like:

```text
Error: Failed to resolve import "./phoenix-insight"
```

- [ ] **Step 3: Add the Phoenix insight component**

Create `components/evals/dashboard-v2/phoenix-insight.tsx` with this exact content:

```tsx
import { ArrowRight, Sparkles } from 'lucide-react'

import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import type { PhoenixInsight } from './attention'
import { localLabel } from './local-labels'

export function PhoenixInsightStrip({
  insight,
  onReview,
  className
}: {
  insight: PhoenixInsight
  onReview: () => void
  className?: string
}) {
  const failingJudges =
    insight.alert.failedEvaluators.length > 0
      ? insight.alert.failedEvaluators.map(localLabel).join(', ')
      : 'No specific judges listed'

  return (
    <section
      aria-labelledby="phoenix-insight-title"
      className={cn(
        'rounded-xl border border-warning-border bg-warning-bg px-4 py-3 text-sm',
        className
      )}
      data-testid="phoenix-insight"
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles
              aria-hidden="true"
              className="size-4 shrink-0 text-warning"
            />
            <h2
              id="phoenix-insight-title"
              className="text-sm font-semibold tracking-tight text-foreground"
            >
              Phoenix insight
            </h2>
          </div>
          <p className="font-medium text-foreground">{insight.summary}</p>
          <p className="text-muted-foreground">{insight.interpretation}</p>
          <p className="text-xs text-muted-foreground">
            {pct(insight.alert.passRate)} pass rate ·{' '}
            {pct(insight.alert.threshold)} threshold · {failingJudges}
          </p>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {insight.alert.phoenixUrl ? (
            <a
              href={insight.alert.phoenixUrl}
              rel="noreferrer"
              target="_blank"
              className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-warning underline-offset-4 hover:underline"
            >
              Open Phoenix
            </a>
          ) : null}
          <button
            type="button"
            onClick={onReview}
            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            {insight.actionLabel}
            <ArrowRight aria-hidden="true" className="size-3.5" />
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 4: Run the component tests to verify they pass**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/phoenix-insight.test.tsx
```

Expected: PASS. The output should include:

```text
Test Files  1 passed
Tests  2 passed
```

- [ ] **Step 5: Commit the component slice**

Run:

```bash
git add components/evals/dashboard-v2/phoenix-insight.tsx components/evals/dashboard-v2/phoenix-insight.test.tsx
git commit -m "feat(evals): add phoenix insight strip"
```

---

## Task 3: Wire Suite Focus Into the Dashboard

**Files:**

- Modify: `components/evals/dashboard-v2/dashboard.test.tsx`
- Modify: `components/evals/dashboard-v2/dashboard.tsx`
- Modify: `components/evals/dashboard-v2/suite-selector.tsx`

- [ ] **Step 1: Add failing dashboard integration tests**

Modify the import at the top of `components/evals/dashboard-v2/dashboard.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
```

Add these tests before the existing `counts capability, traffic monitor, and regression cases in the subtitle` test:

```tsx
it('defaults to a threshold-breached Production Evals suite while keeping Test Suite naming', () => {
  const capability = snapshot({
    id: 'capability-latest',
    suite: 'capability',
    datasetName: 'capability-dataset',
    passRate: 0.92,
    thresholdBreached: false
  })
  const trafficMonitor = snapshot({
    id: 'traffic-latest',
    suite: 'traffic-monitor',
    datasetName: 'traffic-dataset',
    passRate: 0.78,
    threshold: 0.85,
    thresholdBreached: true,
    failedEvaluators: ['citation_accuracy'],
    phoenixUrl:
      'https://phoenix.example.com/datasets/traffic-dataset/compare?experimentId=traffic-experiment'
  })

  render(
    <EvalsDashboardV2
      data={{
        ...EMPTY,
        capability: {
          latest: capability,
          previous: null,
          trend: [],
          lastUpdated: capability.createdAt
        },
        trafficMonitor: {
          latest: trafficMonitor,
          previous: null,
          trend: [],
          lastUpdated: trafficMonitor.createdAt
        },
        recentRuns: [trafficMonitor, capability]
      }}
    />
  )

  expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
  expect(
    screen.getByText(
      'Production Evals is below threshold while Test Suite is healthy.'
    )
  ).toBeInTheDocument()
  expect(
    screen.getByRole('tab', { name: /production evals/i })
  ).toHaveAttribute('aria-selected', 'true')
  expect(screen.getAllByText('traffic-dataset').length).toBeGreaterThan(0)
  expect(screen.getByRole('tab', { name: /test suite/i })).toHaveTextContent(
    'Test Suite'
  )
})

it('preserves an explicit populated suite URL even when another suite needs attention', () => {
  mockSearchParamGet.mockImplementation(key =>
    key === 'suite' ? 'capability' : null
  )
  const capability = snapshot({
    id: 'capability-latest',
    suite: 'capability',
    datasetName: 'capability-dataset',
    thresholdBreached: false
  })
  const trafficMonitor = snapshot({
    id: 'traffic-latest',
    suite: 'traffic-monitor',
    datasetName: 'traffic-dataset',
    passRate: 0.78,
    threshold: 0.85,
    thresholdBreached: true,
    failedEvaluators: ['citation_accuracy']
  })

  render(
    <EvalsDashboardV2
      data={{
        ...EMPTY,
        capability: {
          latest: capability,
          previous: null,
          trend: [],
          lastUpdated: capability.createdAt
        },
        trafficMonitor: {
          latest: trafficMonitor,
          previous: null,
          trend: [],
          lastUpdated: trafficMonitor.createdAt
        },
        recentRuns: [trafficMonitor, capability]
      }}
    />
  )

  expect(screen.getByText('Phoenix insight')).toBeInTheDocument()
  expect(screen.getByRole('tab', { name: /test suite/i })).toHaveAttribute(
    'aria-selected',
    'true'
  )
  expect(screen.getAllByText('capability-dataset').length).toBeGreaterThan(0)
})

it('lets the Phoenix insight review button select the alerting suite', () => {
  mockSearchParamGet.mockImplementation(key =>
    key === 'suite' ? 'capability' : null
  )
  const capability = snapshot({
    id: 'capability-latest',
    suite: 'capability',
    datasetName: 'capability-dataset',
    thresholdBreached: false
  })
  const trafficMonitor = snapshot({
    id: 'traffic-latest',
    suite: 'traffic-monitor',
    datasetName: 'traffic-dataset',
    passRate: 0.78,
    threshold: 0.85,
    thresholdBreached: true,
    failedEvaluators: ['citation_accuracy']
  })

  render(
    <EvalsDashboardV2
      data={{
        ...EMPTY,
        capability: {
          latest: capability,
          previous: null,
          trend: [],
          lastUpdated: capability.createdAt
        },
        trafficMonitor: {
          latest: trafficMonitor,
          previous: null,
          trend: [],
          lastUpdated: trafficMonitor.createdAt
        },
        recentRuns: [trafficMonitor, capability]
      }}
    />
  )

  fireEvent.click(
    screen.getByRole('button', { name: /review production evals/i })
  )

  expect(
    screen.getByRole('tab', { name: /production evals/i })
  ).toHaveAttribute('aria-selected', 'true')
  expect(screen.getAllByText('traffic-dataset').length).toBeGreaterThan(0)
})
```

- [ ] **Step 2: Run the dashboard tests to verify they fail**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/dashboard.test.tsx
```

Expected: FAIL. At least one new test should fail because `Phoenix insight` is not rendered and Production Evals is not the default while Test Suite data exists.

- [ ] **Step 3: Update the suite selector API**

Replace the full contents of `components/evals/dashboard-v2/suite-selector.tsx` with:

```tsx
'use client'

import { getSuiteDisplayByDashboardId } from '@/lib/evals/display'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import type { SuiteId } from './url-state'

const SUITE_TABS: ReadonlyArray<{
  id: SuiteId
}> = [{ id: 'capability' }, { id: 'trafficMonitor' }, { id: 'regression' }]

export function SuiteSelector({
  active,
  attentionSuite = null,
  onChange,
  snaps
}: {
  active: SuiteId
  attentionSuite?: SuiteId | null
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
        const needsAttention = tab.id === attentionSuite
        const s = snaps[tab.id]
        const copy = getSuiteDisplayByDashboardId(tab.id)
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
                : 'border-border/60 bg-background hover:bg-muted/40',
              needsAttention && !on && 'border-warning-border bg-warning-bg/40'
            )}
          >
            <div className="flex w-full items-baseline justify-between gap-2">
              <span className="text-sm font-semibold tracking-tight">
                {copy.label}
              </span>
              <span
                className={cn(
                  'font-mono text-base font-semibold tabular-nums',
                  s?.thresholdBreached ? 'text-destructive' : 'text-foreground'
                )}
              >
                {s ? pct(s.overallScore) : '—'}
              </span>
            </div>
            {needsAttention ? (
              <span className="rounded-full border border-warning-border bg-background px-2 py-0.5 text-[10px] font-medium uppercase tracking-normal text-warning">
                Needs attention
              </span>
            ) : null}
            <p className="text-xs leading-snug text-muted-foreground">
              {copy.tagline}
            </p>
            <p className="text-xs leading-snug text-muted-foreground/80">
              {copy.action}
            </p>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 4: Wire the insight helper and strip into the dashboard**

In `components/evals/dashboard-v2/dashboard.tsx`, remove this import:

```ts
import { CompactAlert } from './compact-alert'
```

Add these imports with the other local dashboard-v2 imports:

```ts
import { getDefaultSuite, getPhoenixInsight } from './attention'
import { PhoenixInsightStrip } from './phoenix-insight'
```

Inside `SuitesView`, replace the existing `defaultSuite` calculation:

```ts
const defaultSuite: SuiteId = cap
  ? 'capability'
  : traf
    ? 'trafficMonitor'
    : reg
      ? 'regression'
      : 'capability'
```

with:

```ts
const defaultSuite = getDefaultSuite(data)
const insight = getPhoenixInsight(data)
```

Inside the `return`, replace:

```tsx
<CompactAlert data={data} />
```

with:

```tsx
{
  insight ? (
    <PhoenixInsightStrip
      insight={insight}
      onReview={() => setActive(insight.suiteId)}
    />
  ) : null
}
```

Update the `SuiteSelector` usage from:

```tsx
<SuiteSelector active={selectedSuite} onChange={setActive} snaps={snapMap} />
```

to:

```tsx
<SuiteSelector
  active={selectedSuite}
  attentionSuite={insight?.suiteId ?? null}
  onChange={setActive}
  snaps={snapMap}
/>
```

- [ ] **Step 5: Run the dashboard tests to verify they pass**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/dashboard.test.tsx
```

Expected: PASS. The output should include all dashboard-v2 tests passing.

- [ ] **Step 6: Run the full dashboard-v2 test set**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/attention.test.ts components/evals/dashboard-v2/phoenix-insight.test.tsx components/evals/dashboard-v2/dashboard.test.tsx components/evals/dashboard-v2/evaluator-breakdown.test.tsx components/evals/dashboard-v2/collapsible-comparison.test.tsx components/evals/dashboard-v2/local-labels.test.ts components/evals/dashboard-v2/url-state.test.ts components/evals/dashboard-v2/use-url-state.test.ts
```

Expected: PASS. The output should include:

```text
Test Files  8 passed
```

- [ ] **Step 7: Commit the integration slice**

Run:

```bash
git add components/evals/dashboard-v2/dashboard.tsx components/evals/dashboard-v2/dashboard.test.tsx components/evals/dashboard-v2/suite-selector.tsx
git commit -m "feat(evals): focus dashboard on alerting suite"
```

---

## Task 4: Remove the Replaced Compact Alert and Update Reference Docs

**Files:**

- Delete: `components/evals/dashboard-v2/compact-alert.tsx`
- Modify: `docs/reference/FILE-INDEX.md`

- [ ] **Step 1: Confirm `CompactAlert` has no source imports**

Run:

```bash
rg -n "CompactAlert|compact-alert" components app lib -g '!components/evals/dashboard-v2/compact-alert.tsx'
```

Expected: no output. If output appears in `components/evals/dashboard-v2/dashboard.tsx`, finish Task 3 before continuing.

- [ ] **Step 2: Delete the replaced component**

Apply this patch:

```diff
*** Begin Patch
*** Delete File: components/evals/dashboard-v2/compact-alert.tsx
*** End Patch
```

- [ ] **Step 3: Update the file index**

In `docs/reference/FILE-INDEX.md`, replace the dashboard-v2 table rows for `dashboard.tsx`, `suite-selector.tsx`, and `compact-alert.tsx` with these rows:

```md
| `components/evals/dashboard-v2/dashboard.tsx` | Top-level orchestrator: handles the empty-state branch, owns the `TooltipProvider` wrap and CSS-driven enter animations, routes Suites/History via `?view=`, drills into a chosen suite via `?suite=`, defaults to the latest attention suite when a threshold alert exists, and composes `PhoenixInsightStrip`, `SuiteSelector`, `EvaluatorBreakdown`, `CollapsibleComparison`, plus legacy primitives `ActivityList`/`ScoreFeature` from `components/evals/dashboard/` |
| `components/evals/dashboard-v2/suite-selector.tsx` | ARIA `tablist` for the per-suite drilldown. Reads suite display copy from `lib/evals/display.ts`: `capability` -> "Test Suite", `trafficMonitor` -> "Production Evals", `regression` -> "Regression Tests"; marks the current attention suite with a "Needs attention" status |
| `components/evals/dashboard-v2/attention.ts` | Pure helper module for dashboard suite focus: maps persisted suite IDs to URL suite IDs, chooses the default suite, and builds Phoenix insight copy from `lib/evals/helpers/alerts.ts:getLatestThresholdAlert` |
| `components/evals/dashboard-v2/phoenix-insight.tsx` | Threshold-breach insight strip that explains why a suite needs attention, keeps nontechnical suite names, links to the Phoenix experiment when available, and lets the operator review the alerting suite |
```

Keep the surrounding table rows for `view-switcher.tsx`, `evaluator-breakdown.tsx`, and `collapsible-comparison.tsx` unchanged. Also update the nearby test-file note from six dashboard-v2 tests to eight, and update the `lib/evals/helpers/alerts.ts` row so it no longer says the helper is consumed by `compact-alert.tsx`.

- [ ] **Step 4: Run source and docs search to verify stale names are gone from current docs**

Run:

```bash
rg -n "CompactAlert|compact-alert" components app lib docs/reference/FILE-INDEX.md
```

Expected: no output.

- [ ] **Step 5: Commit the cleanup slice**

Run:

```bash
git add docs/reference/FILE-INDEX.md
git add -u components/evals/dashboard-v2/compact-alert.tsx
git commit -m "docs(evals): document phoenix insight dashboard focus"
```

---

## Task 5: Final Verification and Browser QA

**Files:**

- Verify only.

- [ ] **Step 1: Run targeted eval dashboard tests**

Run:

```bash
bunx vitest run components/evals/dashboard-v2/attention.test.ts components/evals/dashboard-v2/phoenix-insight.test.tsx components/evals/dashboard-v2/dashboard.test.tsx components/evals/dashboard-v2/evaluator-breakdown.test.tsx components/evals/dashboard-v2/collapsible-comparison.test.tsx components/evals/dashboard-v2/local-labels.test.ts components/evals/dashboard-v2/url-state.test.ts components/evals/dashboard-v2/use-url-state.test.ts components/evals/dashboard/activity-list.test.tsx components/evals/dashboard/comparison-table.test.tsx lib/evals/helpers/__tests__/alerts.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run targeted lint and typecheck**

Run:

```bash
bunx eslint --report-unused-disable-directives components/evals/dashboard-v2/attention.ts components/evals/dashboard-v2/attention.test.ts components/evals/dashboard-v2/phoenix-insight.tsx components/evals/dashboard-v2/phoenix-insight.test.tsx components/evals/dashboard-v2/dashboard.tsx components/evals/dashboard-v2/dashboard.test.tsx components/evals/dashboard-v2/suite-selector.tsx
bunx prettier --check docs/reference/FILE-INDEX.md
bun run typecheck
```

Expected: ESLint exits 0 with no errors, Prettier reports that `docs/reference/FILE-INDEX.md` is formatted, and TypeScript exits 0.

- [ ] **Step 3: Seed local eval data with a breached Production Evals row**

Run:

```bash
bun run seed:evals
bun --env-file=.env.local -e '
import postgres from "postgres"
import {
  assertLocalDatabaseUrl,
  resolveDatabaseUrl
} from "./scripts/seed-eval-summaries.ts"

const databaseUrl = resolveDatabaseUrl()
if (!databaseUrl) {
  throw new Error("DATABASE_URL or POSTGRES_URL is required")
}
assertLocalDatabaseUrl(databaseUrl)

const sql = postgres(databaseUrl)
const rows = await sql`
  update eval_summaries
  set
    pass_rate_bps = 7200,
    threshold_breached = true,
    failed_evaluators = ${sql.json(["relevance", "replay-drop-rate"])},
    evaluator_scores = ${sql.json({
      deterministic_prechecks: 0.9,
      tool_usage: 0.72,
      faithfulness: 0.76,
      relevance: 0.7,
      response_quality: 0.74,
      safety: 0.88,
      citation_accuracy: null
    })},
    failed_cases = 6
  where id = (
    select id
    from eval_summaries
    where suite = ${"traffic-monitor"}
      and experiment_name like ${"local-seed-traffic-monitor-%"}
    order by created_at desc
    limit 1
  )
  returning experiment_name, pass_rate_bps, threshold_breached
`
console.log(rows)
await sql.end()
'
```

Expected: both commands exit 0. The second command mutates only the local seeded newest `traffic-monitor` row after `assertLocalDatabaseUrl()` passes, so `/admin/evals` has a Production Evals attention state without changing the tracked seed script.

- [ ] **Step 4: Start the app**

Run:

```bash
bun dev
```

Expected: Next.js starts on `http://localhost:43100` and logs:

```text
Ready
```

- [ ] **Step 5: Verify the default dashboard state in an authenticated browser**

Open:

```text
http://localhost:43100/admin/evals
```

Expected:

- The page title is `Evaluation Summary`.
- The suite labels are still `Test Suite`, `Production Evals`, and `Regression Tests`.
- A `Phoenix insight` strip appears above the suite cards.
- The insight says `Production Evals is below threshold while Test Suite is healthy.` when the seeded capability row is healthy and traffic is breached.
- The selected suite is `Production Evals`, not `Test Suite`.
- The Production Evals card has the `Needs attention` status.
- The visible score ring and evaluator diagnostics use the Production Evals dataset.

- [ ] **Step 6: Verify explicit suite URL preservation**

Open:

```text
http://localhost:43100/admin/evals?suite=capability
```

Expected:

- The `Phoenix insight` strip still appears.
- The selected suite remains `Test Suite`.
- Clicking `Review Production Evals` changes the selected card and detail section to `Production Evals`.
- The URL updates to include `suite=trafficMonitor`.

- [ ] **Step 7: Verify mobile layout does not regress**

Use browser device emulation at `390x844`, then reload:

```text
http://localhost:43100/admin/evals
```

Expected:

- The `Phoenix insight` strip stacks cleanly.
- The review button remains visible without horizontal page scroll.
- The three suite cards remain full-width stacked cards.
- The selected detail section still begins with `Production Evals`.

- [ ] **Step 8: Stop the dev server**

Press `Ctrl-C` in the terminal running `bun dev`.

- [ ] **Step 9: Commit no-op verification evidence only if files changed during verification**

Run:

```bash
git status --short
```

Expected after Task 4 commits: no output. If seed data or build artifacts appear, do not commit them.

---

## Self-Review

### Spec Coverage

- Keep "Test Suite" plain-language naming: covered by Task 3 tests and by leaving `lib/evals/display.ts` untouched.
- Select the suite that needs attention by default: covered by Task 1 helper tests and Task 3 integration tests.
- Preserve explicit user/deep-link selection: covered by Task 3 URL-preservation test and Task 5 browser QA.
- Add Phoenix eval-agent style insight: covered by Task 2 component and Task 3 integration.
- Avoid broad dashboard redesign: plan does not touch run-history mobile layout, comparison mobile layout, persistence, service evals, or Phoenix tracing.

### Placeholder Scan

No task uses placeholder wording. Every code-writing step includes exact code. Every command includes expected output or expected UI state.

### Type Consistency

- `SuiteId` comes from `components/evals/dashboard-v2/url-state.ts`.
- Persisted suite IDs use `PersistedDashboardSuite` from `lib/evals/types.ts`.
- Alert data uses exported `DashboardAlert` from `lib/evals/helpers/alerts.ts`.
- The helper maps `'traffic-monitor'` to `'trafficMonitor'`, matching the existing URL suite ID contract.

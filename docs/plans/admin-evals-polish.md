# Admin Evals UI Polish — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `/admin/evals` answer "is anything regressing right now?" in under five seconds by demoting the static H1, promoting the run-state pill, turning suite tabs into scoreboards with a two-tone scoop pattern, and tightening type/spacing scales — all without changing component contracts.

**Architecture:** Visual layer on top of the already-shipped IA migration. One new shared status helper (`getSuiteStatus` lifted out of the diagnostic overview), one new presentational primitive (`ScoopCard`), one new tiny atom (`<Delta />`). Color encoding is driven entirely by existing semantic Tailwind tokens (`bg-success-bg`, `bg-warning-bg`, `bg-destructive/15`) so dark-mode parity is automatic. No backend / data shape / route changes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind v4, lucide-react, vitest + @testing-library/react.

**Wireframe IDs (`polymorph.pen`):** Variant A `Gy1OS` (light), `FfIuo` (dark), `Jc76X` (donut-dropped reference), `JbfZt` (delta callout).

**Canonical route:** `/admin/evals` (the legacy `/admin/evals/demo-redesign` was removed in the IA migration — `CHANGELOG.md:48`).

---

## Design principles (unchanged from the brief)

1. **Redundant encoding for state.** Color + icon + shape (or color + value + label). Color alone fails WCAG 1.4.1.
2. **Glanceability over density.** A scoreboard, not a navigation bar.
3. **Tonal contrast over chrome.** Two-tone cards replace heavy borders.
4. **Token-driven color.** Every structural color uses a `--*` token; dark-mode flips automatically.
5. **Surgical diffs.** No component contracts change; only styling and structure.

---

## File structure (decomposition map)

### New files

| Path                                                | Responsibility                                                                                                                                                                                           |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/evals/helpers/status.ts`                       | Pure `getSuiteStatus(snap, previous): SuiteStatus` + `getOverallStatus(data): SuiteStatus`. No JSX. Single source of truth for the READY/WATCH/BLOCKED decision.                                         |
| `lib/evals/helpers/status.test.ts`                  | Unit tests for both helpers.                                                                                                                                                                             |
| `components/evals/dashboard-v2/scoop-card.tsx`      | Presentational primitive: a horizontal flex frame with an absolute-positioned tinted ellipse anchored top-left, an icon slot, and a right-aligned body slot. Used at two scales (suite tabs, KPI tiles). |
| `components/evals/dashboard-v2/scoop-card.test.tsx` | Visual-contract tests: renders icon, applies correct tint class, marks active state.                                                                                                                     |
| `components/evals/dashboard-v2/delta.tsx`           | `<Delta value={n} />` atom. Wraps existing `deltaPts(n)` and adds an arrow icon + status color. Three render states: up / down / flat.                                                                   |
| `components/evals/dashboard-v2/delta.test.tsx`      | Per-state assertions (icon present, sign correct, color class correct).                                                                                                                                  |
| `components/evals/dashboard-v2/kpi-strip.tsx`       | Three-up KPI tiles (PASS / Δ 48H / CASES) using `ScoopCard` at smaller scale.                                                                                                                            |

### Modified files

| Path                                                                                                                             | Why                                                                                                                                           |
| -------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/evals/dashboard-v2/dashboard.tsx:101-123`                                                                            | Demote H1 (`text-4xl sm:text-5xl` → `text-2xl`). Add inline status pill. Promote caption (`text-sm` → `text-base`).                           |
| `components/evals/dashboard-v2/suite-selector.tsx`                                                                               | Full rewrite of the card body to use `ScoopCard`. Status comes from `getSuiteStatus`. Active suite gets accent-blue border.                   |
| `components/evals/dashboard-v2/phoenix-insight.tsx:24-77`                                                                        | Severity branch on `thresholdBreached` (alert tier vs amber tier). Swap `Sparkles` → `AlertTriangle`. Filled CTA. 3px left rail.              |
| `components/evals/dashboard/score-feature.tsx:80-92`                                                                             | Drive donut `stroke` and inner aggregate text from `getScoreStatus`.                                                                          |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx:179-249`                                                                  | Replace inline status decision in `buildDiagnosticOverview` with a call to `getSuiteStatus` (no behavior change).                             |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx:99`                                                                       | Widen the score-bar grid column: `[minmax(0,1.5fr)_minmax(0,1fr)_44px]` → `[minmax(0,1.5fr)_minmax(0,2fr)_44px]`.                             |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx:284`                                                                      | Replace `text-emerald-400` → `text-success` (token already exists at `app/globals.css:42-44, 121-123`).                                       |
| `components/evals/dashboard/score-feature.tsx:124-126, 131` & `evaluator-breakdown.tsx:312, 440` & new tab cards & new KPI tiles | Use `<Delta />` at every visual delta site. (Existing string usages of `deltaPts` stay where the consumer is text-only, e.g. `Metric` cells.) |
| `components/evals/dashboard-v2/dashboard.test.tsx`                                                                               | Update header expectations (H1 text changes from "Evaluation Summary" → "Evaluation").                                                        |
| `components/evals/dashboard-v2/phoenix-insight.test.tsx`                                                                         | Update icon assertion (`AlertTriangle` instead of `Sparkles`).                                                                                |
| `components/evals/dashboard-v2/evaluator-breakdown.test.tsx`                                                                     | No assertion changes expected — `BLOCKED` / `WATCH` / `READY` strings stay. Run to confirm.                                                   |

### Files explicitly **not** touched

- `components/evals/dashboard/score-bar.tsx` — already uses `flex-1` + `width: ${score * 100}%` for fluid fill (`score-bar.tsx:69, 83`). The original brief's § 8 critique was wrong; the bar is correct.
- `components/evals/dashboard/shared.ts` — `Severity` / `severityForScore` / `severityText` stay. Verified at `comparison-table.tsx:15, 58-59, 112, 126`: `Severity` encodes _cross-suite delta divergence_ (test vs prod), not score-vs-threshold. Different semantic axis from `ScoreBarStatus`. Removing it would force `comparison-table.tsx` to invent another enum for the same concept.

### Final enum landscape (after this work)

| Enum                | Owner                         | Concept                                                   |
| ------------------- | ----------------------------- | --------------------------------------------------------- |
| `Severity`          | `dashboard/shared.ts`         | Cross-suite delta divergence (cap vs traf >= 0.07 / 0.15) |
| `ScoreBarStatus`    | `dashboard/score-bar.tsx`     | Single-score vs threshold tier (on-track / near / below)  |
| `SuiteStatus` (new) | `lib/evals/helpers/status.ts` | Narrative page/suite summary (READY / WATCH / BLOCKED)    |

Three enums, three distinct concepts. Documented in `lib/evals/helpers/status.ts` header comment.

---

## Pre-flight checks

- [ ] **Step 0.1: Verify baseline tests pass before any change**

Run: `bun run test components/evals lib/evals`
Expected: all green. If anything fails, stop and report — your changes shouldn't fix unrelated breakage.

- [ ] **Step 0.2: Boot dev server and load `/admin/evals`**

Run: `bun dev` (port 43100). Browse to `http://localhost:43100/admin/evals`.
Expected: dashboard renders. Capture a "before" screenshot for later comparison.

---

## Task 1: Lift `getSuiteStatus` into a shared helper

The status decision currently lives inline at `evaluator-breakdown.tsx:206-248` inside `buildDiagnosticOverview`. Extracting it cleanly is the foundation for the page-level pill (§ 1) and the suite-tab `ATTENTION` chip (§ 2).

**Files:**

- Create: `lib/evals/helpers/status.ts`
- Test: `lib/evals/helpers/status.test.ts`
- Modify: `components/evals/dashboard-v2/evaluator-breakdown.tsx:179-249` (delegate to the new helper)

- [ ] **Step 1.1: Write the failing test**

Create `lib/evals/helpers/status.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import type { EvalSummarySnapshot, EvalsDashboardData } from '@/lib/evals/types'

import { getSuiteStatus, getOverallStatus, type SuiteStatus } from './status'

const BASE: EvalSummarySnapshot = {
  id: 'x',
  suite: 'capability',
  experimentName: 'e',
  datasetName: 'd',
  passRate: 0.9,
  threshold: 0.85,
  thresholdBreached: false,
  failedEvaluators: [],
  overallScore: 0.9,
  evaluatorScores: { faithfulness: 0.9 },
  totalCases: 10,
  attemptedCases: 10,
  failedCases: 0,
  dropRate: 0,
  phoenixUrl: null,
  createdAt: '2026-04-29T12:00:00.000Z'
}

describe('getSuiteStatus', () => {
  it('returns BLOCKED when thresholdBreached is true', () => {
    expect(
      getSuiteStatus({ ...BASE, thresholdBreached: true }, null)
    ).toBe<SuiteStatus>('BLOCKED')
  })

  it('returns WATCH when failedCases > 0 but threshold holds', () => {
    expect(getSuiteStatus({ ...BASE, failedCases: 1 }, null)).toBe('WATCH')
  })

  it('returns WATCH when failedEvaluators is non-empty', () => {
    expect(
      getSuiteStatus({ ...BASE, failedEvaluators: ['faithfulness'] }, null)
    ).toBe('WATCH')
  })

  it('returns WATCH on a >5pt evaluator drop vs previous', () => {
    const previous = { ...BASE, evaluatorScores: { faithfulness: 0.99 } }
    const current = { ...BASE, evaluatorScores: { faithfulness: 0.9 } }
    expect(getSuiteStatus(current, previous)).toBe('WATCH')
  })

  it('returns READY when nothing is wrong', () => {
    expect(getSuiteStatus(BASE, null)).toBe('READY')
  })
})

describe('getOverallStatus', () => {
  const SUITE = (status: SuiteStatus): EvalSummarySnapshot => {
    if (status === 'BLOCKED') return { ...BASE, thresholdBreached: true }
    if (status === 'WATCH') return { ...BASE, failedCases: 1 }
    return BASE
  }
  const DATA = (
    cap: SuiteStatus,
    traf: SuiteStatus,
    reg: SuiteStatus
  ): EvalsDashboardData => ({
    capability: {
      latest: SUITE(cap),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    trafficMonitor: {
      latest: SUITE(traf),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    regression: {
      latest: SUITE(reg),
      previous: null,
      trend: [],
      lastUpdated: null
    },
    recentRuns: []
  })

  it('returns the worst of three suites', () => {
    expect(getOverallStatus(DATA('READY', 'WATCH', 'BLOCKED'))).toBe('BLOCKED')
    expect(getOverallStatus(DATA('READY', 'WATCH', 'READY'))).toBe('WATCH')
    expect(getOverallStatus(DATA('READY', 'READY', 'READY'))).toBe('READY')
  })

  it('returns READY when no suite has data', () => {
    const empty: EvalsDashboardData = {
      capability: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      trafficMonitor: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      regression: {
        latest: null,
        previous: null,
        trend: [],
        lastUpdated: null
      },
      recentRuns: []
    }
    expect(getOverallStatus(empty)).toBe('READY')
  })
})
```

- [ ] **Step 1.2: Run test to verify it fails**

Run: `bun run test lib/evals/helpers/status.test.ts`
Expected: FAIL with "Cannot find module './status'".

- [ ] **Step 1.3: Implement the helper**

Create `lib/evals/helpers/status.ts`:

```ts
import type { EvalSummarySnapshot, EvalsDashboardData } from '@/lib/evals/types'

/**
 * Narrative page-level status. Distinct from `ScoreBarStatus` (single-score
 * color tier, owned by score-bar.tsx) and `Severity` (cross-suite delta
 * divergence, owned by dashboard/shared.ts). Three concepts, three enums.
 */
export type SuiteStatus = 'READY' | 'WATCH' | 'BLOCKED'

const RANK: Record<SuiteStatus, number> = {
  READY: 0,
  WATCH: 1,
  BLOCKED: 2
}

const EVALUATOR_DROP_THRESHOLD = -0.05

export function getSuiteStatus(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
): SuiteStatus {
  if (snap.thresholdBreached) return 'BLOCKED'

  const largestDrop = getLargestEvaluatorDrop(snap, previous)
  if (
    snap.failedCases > 0 ||
    snap.failedEvaluators.length > 0 ||
    (largestDrop && largestDrop <= EVALUATOR_DROP_THRESHOLD)
  ) {
    return 'WATCH'
  }
  return 'READY'
}

export function getOverallStatus(data: EvalsDashboardData): SuiteStatus {
  const candidates: SuiteStatus[] = []
  if (data.capability.latest) {
    candidates.push(
      getSuiteStatus(data.capability.latest, data.capability.previous)
    )
  }
  if (data.trafficMonitor.latest) {
    candidates.push(
      getSuiteStatus(data.trafficMonitor.latest, data.trafficMonitor.previous)
    )
  }
  if (data.regression.latest) {
    candidates.push(
      getSuiteStatus(data.regression.latest, data.regression.previous)
    )
  }
  if (candidates.length === 0) return 'READY'
  return candidates.reduce((worst, s) => (RANK[s] > RANK[worst] ? s : worst))
}

function getLargestEvaluatorDrop(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
): number | null {
  if (!previous) return null
  let smallest: number | null = null
  for (const [name, score] of Object.entries(snap.evaluatorScores)) {
    const prev = previous.evaluatorScores[name]
    if (score == null || prev == null) continue
    const delta = score - prev
    if (smallest == null || delta < smallest) smallest = delta
  }
  return smallest
}
```

- [ ] **Step 1.4: Run test to verify it passes**

Run: `bun run test lib/evals/helpers/status.test.ts`
Expected: PASS (8 tests).

- [ ] **Step 1.5: Delegate from `buildDiagnosticOverview`**

Modify `components/evals/dashboard-v2/evaluator-breakdown.tsx`:

At the top of the file, add the import alongside the existing `@/lib/evals/...` imports:

```ts
import { getSuiteStatus } from '@/lib/evals/helpers/status'
```

Replace the body of `buildDiagnosticOverview` (lines 179-249) so the status decision delegates to `getSuiteStatus`:

```ts
function buildDiagnosticOverview(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
): DiagnosticOverview {
  const currentFailures = new Set(
    (snap.caseResults ?? []).filter(result => result.failed).map(failureKey)
  )
  const previousFailures = new Set(
    (previous?.caseResults ?? [])
      .filter(result => result.failed)
      .map(failureKey)
  )
  const newFailures = [...currentFailures].filter(
    key => !previousFailures.has(key)
  ).length
  const fixedFailures = [...previousFailures].filter(
    key => !currentFailures.has(key)
  ).length
  const stillFailing = [...currentFailures].filter(key =>
    previousFailures.has(key)
  ).length
  const largestDrop = getLargestEvaluatorDrop(snap, previous)
  const worstFailures = (snap.caseResults ?? [])
    .filter(result => result.failed)
    .sort(scoreAscending)
    .slice(0, 3)

  const status = getSuiteStatus(snap, previous)
  const reason =
    status === 'BLOCKED'
      ? 'Threshold breached'
      : status === 'WATCH'
        ? newFailures > 0
          ? 'New failures found'
          : snap.failedCases > 0
            ? 'Failures below block threshold'
            : 'Score dropped'
        : 'No blocking failures'

  return {
    status,
    reason,
    newFailures,
    fixedFailures,
    stillFailing,
    largestDrop,
    worstFailures
  }
}
```

Update the `DiagnosticStatus` type alias to import from the helper (delete the local declaration on `:164` and import instead):

```ts
import { getSuiteStatus, type SuiteStatus } from '@/lib/evals/helpers/status'

type DiagnosticStatus = SuiteStatus
```

(Keeping the local alias so `DiagnosticOverview['status']` reads naturally inside the file. The alias is one line; it's not abstraction debt.)

- [ ] **Step 1.6: Run the full evaluator-breakdown test to verify no behavior change**

Run: `bun run test components/evals/dashboard-v2/evaluator-breakdown.test.tsx`
Expected: PASS — all four existing tests (BLOCKED, ALERT, foreground, destructive class) still pass without modification.

- [ ] **Step 1.7: Commit**

```bash
git add lib/evals/helpers/status.ts lib/evals/helpers/status.test.ts \
        components/evals/dashboard-v2/evaluator-breakdown.tsx
git commit -m "refactor: extract getSuiteStatus / getOverallStatus helpers"
```

---

## Task 2: Replace stray `text-emerald-400` with the existing `text-success` token

Tiny, mechanical, unblocks the design-token claim in § Visual spec. The token is already defined at `app/globals.css:42-44` (light) and `:121-123` (dark) and exposed as a Tailwind utility at `:199-201`.

**Files:**

- Modify: `components/evals/dashboard-v2/evaluator-breakdown.tsx:284`

- [ ] **Step 2.1: Edit the one line**

In `evaluator-breakdown.tsx:280-285`, change:

```ts
const statusClass =
  overview.status === 'BLOCKED'
    ? 'text-destructive'
    : overview.status === 'WATCH'
      ? 'text-accent-amber'
      : 'text-emerald-400'
```

to:

```ts
const statusClass =
  overview.status === 'BLOCKED'
    ? 'text-destructive'
    : overview.status === 'WATCH'
      ? 'text-accent-amber'
      : 'text-success'
```

- [ ] **Step 2.2: Run typecheck and the breakdown test**

Run: `bun typecheck && bun run test components/evals/dashboard-v2/evaluator-breakdown.test.tsx`
Expected: PASS.

- [ ] **Step 2.3: Commit**

```bash
git add components/evals/dashboard-v2/evaluator-breakdown.tsx
git commit -m "style: replace stray text-emerald-400 with text-success token"
```

---

## Task 3: Build the `<Delta />` atom

Wraps existing `deltaPts(n)` with arrow + sign + colored output. Three redundant cues → satisfies WCAG 1.4.1. Does **not** mutate `deltaPts`'s contract; the existing string consumers (`Metric`, plain interpolation) keep working.

**Files:**

- Create: `components/evals/dashboard-v2/delta.tsx`
- Test: `components/evals/dashboard-v2/delta.test.tsx`

- [ ] **Step 3.1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Delta } from './delta'

describe('<Delta />', () => {
  it('renders an up arrow + + sign + success color for positive values', () => {
    const { container } = render(<Delta value={0.05} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('text-success')
    expect(root.querySelector('[data-testid="delta-icon-up"]')).not.toBeNull()
    expect(screen.getByText('+5')).toBeInTheDocument()
  })

  it('renders a down arrow + minus sign + destructive color for negative values', () => {
    const { container } = render(<Delta value={-0.05} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('text-destructive')
    expect(root.querySelector('[data-testid="delta-icon-down"]')).not.toBeNull()
    // deltaPts already prefixes the minus; matching against the rendered
    // hyphen-minus to avoid confusion with the unicode-minus glyph.
    expect(screen.getByText('-5')).toBeInTheDocument()
  })

  it('renders a flat icon + muted color for zero / rounded-to-zero', () => {
    const { container } = render(<Delta value={0.001} />)
    const root = container.firstChild as HTMLElement
    expect(root).toHaveClass('text-muted-foreground')
    expect(root.querySelector('[data-testid="delta-icon-flat"]')).not.toBeNull()
  })

  it('renders an em dash for null (no comparison data)', () => {
    render(<Delta value={null} />)
    expect(screen.getByText('—')).toBeInTheDocument()
  })
})
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `bun run test components/evals/dashboard-v2/delta.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 3.3: Implement the component**

Create `components/evals/dashboard-v2/delta.tsx`:

```tsx
import { ArrowDown, ArrowUp, Minus } from 'lucide-react'

import { cn } from '@/lib/utils'

import { deltaPts } from '@/components/evals/dashboard/shared'

type Direction = 'up' | 'down' | 'flat'

const ICON: Record<Direction, typeof ArrowUp> = {
  up: ArrowUp,
  down: ArrowDown,
  flat: Minus
}

const COLOR: Record<Direction, string> = {
  up: 'text-success',
  down: 'text-destructive',
  flat: 'text-muted-foreground'
}

export function Delta({
  value,
  className
}: {
  value: number | null
  className?: string
}) {
  if (value == null) {
    return <span className={cn('text-muted-foreground', className)}>—</span>
  }

  const rounded = Math.round(value * 100)
  const direction: Direction =
    rounded > 0 ? 'up' : rounded < 0 ? 'down' : 'flat'
  const Icon = ICON[direction]
  const text = deltaPts(value)

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 font-mono text-xs tabular-nums',
        COLOR[direction],
        className
      )}
      data-direction={direction}
    >
      <Icon
        aria-hidden="true"
        className="size-3"
        data-testid={`delta-icon-${direction}`}
      />
      <span>{text}</span>
    </span>
  )
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `bun run test components/evals/dashboard-v2/delta.test.tsx`
Expected: PASS (4 tests).

- [ ] **Step 3.5: Commit**

```bash
git add components/evals/dashboard-v2/delta.tsx components/evals/dashboard-v2/delta.test.tsx
git commit -m "feat: add <Delta /> atom with arrow + sign + color encoding"
```

---

## Task 4: Apply `<Delta />` at score-feature and evaluator-breakdown sites

Replace plain `deltaPts(...)` rendering inside `score-feature.tsx` and `evaluator-breakdown.tsx`. Leave string-only consumers (`Metric` cells, where the value flows through generic `string | number | null` rendering) untouched — they don't need icon affordance.

**Files:**

- Modify: `components/evals/dashboard/score-feature.tsx:122-127`
- Modify: `components/evals/dashboard-v2/evaluator-breakdown.tsx:439-441`

- [ ] **Step 4.1: Update `score-feature.tsx` Change · 48h cell**

In `score-feature.tsx`, add the import:

```ts
import { Delta } from '@/components/evals/dashboard-v2/delta'
```

Replace lines 122-127:

```tsx
<div className="space-y-1">
  <dt className="text-xs text-muted-foreground">Change · 48h</dt>
  <dd className="font-mono text-sm font-medium tabular-nums">
    {deltaPts(delta) ?? '—'}
  </dd>
</div>
```

with:

```tsx
<div className="space-y-1">
  <dt className="text-xs text-muted-foreground">Change · 48h</dt>
  <dd className="text-sm font-medium">
    <Delta value={delta} />
  </dd>
</div>
```

- [ ] **Step 4.2: Update `evaluator-breakdown.tsx` per-evaluator delta**

Replace lines 439-441:

```tsx
<span className="font-mono text-xs text-muted-foreground">
  Delta vs previous: {delta == null ? 'Unknown' : deltaPts(delta)}
</span>
```

with:

```tsx
<span className="font-mono text-xs text-muted-foreground">
  Delta vs previous: <Delta value={delta} />
</span>
```

(Add the `Delta` import at the top alongside other `dashboard-v2/...` imports.)

- [ ] **Step 4.3: Run all evals tests**

Run: `bun run test components/evals lib/evals`
Expected: PASS. (`evaluator-breakdown.test.tsx` doesn't currently assert on the delta string, so no test update needed here.)

- [ ] **Step 4.4: Commit**

```bash
git add components/evals/dashboard/score-feature.tsx \
        components/evals/dashboard-v2/evaluator-breakdown.tsx
git commit -m "feat: render score deltas with <Delta /> atom"
```

---

## Task 5: Demote H1, promote caption, add status pill

The single highest-leverage visual change. The big "Evaluation Summary" headline is replaced by a smaller "Evaluation" + a status pill that actually answers the question the page exists to answer.

**Files:**

- Modify: `components/evals/dashboard-v2/dashboard.tsx:101-123`
- Modify: `components/evals/dashboard-v2/dashboard.test.tsx:96, 104` (header text changes)

- [ ] **Step 5.1: Update the failing tests first (TDD: write what we want, then implement)**

In `dashboard.test.tsx`:

Change line 96:

```ts
screen.getByRole('heading', { level: 1, name: /evaluation summary/i })
```

to:

```ts
screen.getByRole('heading', { level: 1, name: /^evaluation$/i })
```

Change line 104 the same way.

Add a new test below the existing "renders the populated state" test:

```tsx
it('renders a READY status pill when no suite is in trouble', () => {
  render(<EvalsDashboardV2 data={POPULATED} />)
  expect(screen.getByTestId('overall-status-pill')).toHaveTextContent(/READY/)
})

it('renders a BLOCKED status pill when any suite breaches threshold', () => {
  const breached = snapshot({
    thresholdBreached: true,
    failedEvaluators: ['faithfulness']
  })
  render(
    <EvalsDashboardV2
      data={{
        ...POPULATED,
        capability: {
          latest: breached,
          previous: null,
          trend: [],
          lastUpdated: breached.createdAt
        }
      }}
    />
  )
  expect(screen.getByTestId('overall-status-pill')).toHaveTextContent(/BLOCKED/)
})
```

- [ ] **Step 5.2: Run tests; expect failures**

Run: `bun run test components/evals/dashboard-v2/dashboard.test.tsx`
Expected: FAIL on the new pill assertions and on the renamed heading (3 failures).

- [ ] **Step 5.3: Update the Header component**

In `dashboard.tsx`, add the import:

```ts
import { getOverallStatus, type SuiteStatus } from '@/lib/evals/helpers/status'
```

Replace lines 101-123 with:

```tsx
  const overallStatus = getOverallStatus(data)

  return (
    <header
      className="space-y-3 border-b border-border/60 pb-6 motion-safe:animate-content-enter"
      style={enter(0)}
    >
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">Evaluation</h1>
          <StatusPill status={overallStatus} />
        </div>
        {hideSwitcher ? null : (
          <ViewSwitcher value={view} onChange={onChange} />
        )}
      </div>
      <p className="text-base leading-relaxed text-muted-foreground">
        {getViewDescription(view)}{' '}
        <span className="font-mono tabular-nums text-foreground">
          {totalCases}
        </span>{' '}
        cases scored in the last 48h · last sync {lastSync}.
      </p>
    </header>
  )
}

const STATUS_PILL_STYLE: Record<SuiteStatus, string> = {
  READY: 'bg-success-bg text-success border-success-border',
  WATCH: 'bg-warning-bg text-warning border-warning-border',
  BLOCKED: 'bg-destructive/10 text-destructive border-destructive/30'
}

function StatusPill({ status }: { status: SuiteStatus }) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide',
        STATUS_PILL_STYLE[status]
      )}
      data-testid="overall-status-pill"
    >
      {status}
    </span>
  )
}
```

(Add `import { cn } from '@/lib/utils'` at the top if not present.)

- [ ] **Step 5.4: Run dashboard tests; expect pass**

Run: `bun run test components/evals/dashboard-v2/dashboard.test.tsx`
Expected: PASS (all tests including the two new ones).

- [ ] **Step 5.5: Visual verification**

Run: `bun dev` (port 43100). Browse `/admin/evals`. Confirm:

- H1 reads "Evaluation" (not "Evaluation Summary").
- A pill labeled READY / WATCH / BLOCKED appears next to it.
- Caption with case count + last sync still renders below the H1 row, slightly larger than before.

- [ ] **Step 5.6: Commit**

```bash
git add components/evals/dashboard-v2/dashboard.tsx \
        components/evals/dashboard-v2/dashboard.test.tsx
git commit -m "feat(evals): demote H1, add page-level status pill"
```

---

## Task 6: Build the `ScoopCard` primitive

The reusable two-tone card pattern: a horizontal flex frame, an absolute-positioned tinted ellipse anchored top-left (the "scoop"), an icon slot, a body slot. Used at two scales by Tasks 7 and 10.

**Files:**

- Create: `components/evals/dashboard-v2/scoop-card.tsx`
- Test: `components/evals/dashboard-v2/scoop-card.test.tsx`

- [ ] **Step 6.1: Write the failing test**

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScoopCard } from './scoop-card'

describe('ScoopCard', () => {
  it('renders icon and body content', () => {
    render(
      <ScoopCard tint="ready" icon={<span data-testid="icon">i</span>}>
        <span>body content</span>
      </ScoopCard>
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
    expect(screen.getByText('body content')).toBeInTheDocument()
  })

  it('applies the success-bg tint class for ready status', () => {
    render(
      <ScoopCard tint="ready" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-success-bg')
  })

  it('applies the warning-bg tint class for watch status', () => {
    render(
      <ScoopCard tint="watch" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-warning-bg')
  })

  it('applies destructive tint for blocked status', () => {
    render(
      <ScoopCard tint="blocked" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-destructive/15')
  })

  it('applies muted tint for neutral / informational tiles', () => {
    render(
      <ScoopCard tint="neutral" icon={<span>i</span>}>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop')).toHaveClass('bg-muted')
  })

  it('marks the active card with an accent-blue ring', () => {
    render(
      <ScoopCard tint="ready" icon={<span>i</span>} active>
        body
      </ScoopCard>
    )
    expect(screen.getByTestId('scoop-card-root')).toHaveClass(
      'ring-2',
      'ring-accent-blue'
    )
  })
})
```

- [ ] **Step 6.2: Run tests; expect FAIL**

Run: `bun run test components/evals/dashboard-v2/scoop-card.test.tsx`
Expected: FAIL — module not found.

- [ ] **Step 6.3: Implement `ScoopCard`**

Create `components/evals/dashboard-v2/scoop-card.tsx`:

```tsx
import { type ReactNode } from 'react'

import { cn } from '@/lib/utils'

export type ScoopTint = 'ready' | 'watch' | 'blocked' | 'neutral'
export type ScoopSize = 'lg' | 'sm'

const TINT_CLASS: Record<ScoopTint, string> = {
  ready: 'bg-success-bg',
  watch: 'bg-warning-bg',
  blocked: 'bg-destructive/15',
  neutral: 'bg-muted'
}

const SIZE_CLASS: Record<
  ScoopSize,
  { card: string; scoop: string; iconSlot: string }
> = {
  // Suite tab: 140px tall, 180×240 ellipse anchored at (-70, -60)
  lg: {
    card: 'min-h-[140px] p-5',
    scoop: 'h-60 w-45 -left-[70px] -top-[60px]',
    iconSlot: 'size-12'
  },
  // KPI tile: 90px tall, 80×120 ellipse anchored at (-25, -30)
  sm: {
    card: 'min-h-[90px] p-3.5',
    scoop: 'h-30 w-20 -left-[25px] -top-[30px]',
    iconSlot: 'size-7'
  }
}

export function ScoopCard({
  tint,
  size = 'lg',
  icon,
  active = false,
  className,
  children,
  ...rest
}: {
  tint: ScoopTint
  size?: ScoopSize
  icon: ReactNode
  active?: boolean
  className?: string
  children: ReactNode
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'children'>) {
  const sz = SIZE_CLASS[size]
  return (
    <div
      data-testid="scoop-card-root"
      className={cn(
        'relative flex items-center gap-3 overflow-hidden rounded-2xl border border-border/60 bg-background text-left transition-colors',
        sz.card,
        active && 'ring-2 ring-accent-blue ring-offset-0',
        className
      )}
      {...rest}
    >
      <span
        aria-hidden
        data-testid="scoop"
        className={cn(
          'pointer-events-none absolute rounded-full',
          TINT_CLASS[tint],
          sz.scoop
        )}
      />
      <div
        className={cn(
          'relative z-[1] flex shrink-0 items-center justify-center',
          sz.iconSlot
        )}
      >
        {icon}
      </div>
      <div className="relative z-[1] flex-1 min-w-0">{children}</div>
    </div>
  )
}
```

- [ ] **Step 6.4: Run tests; expect PASS**

Run: `bun run test components/evals/dashboard-v2/scoop-card.test.tsx`
Expected: PASS (6 tests).

- [ ] **Step 6.5: Commit**

```bash
git add components/evals/dashboard-v2/scoop-card.tsx \
        components/evals/dashboard-v2/scoop-card.test.tsx
git commit -m "feat(evals): add ScoopCard presentational primitive"
```

---

## Task 7: Suite tabs as scoreboard

Replace the cookie-cutter button bodies with `ScoopCard`s that read like metric cards. Active suite gets the accent-blue ring; the suite under attention gets the warning tint and an inline `ATTENTION` chip in the eyebrow.

**Files:**

- Modify (rewrite the tab body): `components/evals/dashboard-v2/suite-selector.tsx`
- Create test: `components/evals/dashboard-v2/suite-selector.test.tsx`

Icons (from `lucide-react`, PascalCase imports):

| Suite           | Icon          |
| --------------- | ------------- |
| Capability      | `ChartLine`   |
| Traffic monitor | `Gauge`       |
| Regression      | `ShieldCheck` |

- [ ] **Step 7.1: Write the failing test**

Create `components/evals/dashboard-v2/suite-selector.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { SuiteSelector } from './suite-selector'

const SNAP = (
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot => ({
  id: 'x',
  suite: 'capability',
  experimentName: 'e',
  datasetName: 'd',
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
  createdAt: '2026-04-29T12:00:00.000Z',
  ...overrides
})

describe('SuiteSelector', () => {
  it('renders three suite tabs with their scores', () => {
    render(
      <SuiteSelector
        active="capability"
        onChange={() => {}}
        snaps={{
          capability: SNAP({ overallScore: 0.88 }),
          trafficMonitor: SNAP({
            suite: 'traffic-monitor',
            overallScore: 0.82
          }),
          regression: SNAP({ suite: 'regression', overallScore: 0.91 })
        }}
      />
    )
    expect(screen.getByRole('tab', { name: /test suite/i })).toBeInTheDocument()
    expect(screen.getByText('88%')).toBeInTheDocument()
    expect(screen.getByText('82%')).toBeInTheDocument()
    expect(screen.getByText('91%')).toBeInTheDocument()
  })

  it('marks the active tab with aria-selected and the accent-blue ring', () => {
    render(
      <SuiteSelector
        active="trafficMonitor"
        onChange={() => {}}
        snaps={{
          capability: SNAP(),
          trafficMonitor: SNAP({ suite: 'traffic-monitor' }),
          regression: SNAP({ suite: 'regression' })
        }}
      />
    )
    const active = screen.getByRole('tab', { name: /production evals/i })
    expect(active).toHaveAttribute('aria-selected', 'true')
    expect(active.querySelector('[data-testid="scoop-card-root"]')).toHaveClass(
      'ring-accent-blue'
    )
  })

  it('renders an ATTENTION chip on the suite flagged for attention', () => {
    render(
      <SuiteSelector
        active="capability"
        attentionSuite="trafficMonitor"
        onChange={() => {}}
        snaps={{
          capability: SNAP(),
          trafficMonitor: SNAP({
            suite: 'traffic-monitor',
            thresholdBreached: true,
            failedEvaluators: ['citation_accuracy']
          }),
          regression: SNAP({ suite: 'regression' })
        }}
      />
    )
    expect(screen.getByText(/ATTENTION/i)).toBeInTheDocument()
  })

  it('calls onChange with the suite id when a tab is clicked', () => {
    const onChange = vi.fn()
    render(
      <SuiteSelector
        active="capability"
        onChange={onChange}
        snaps={{
          capability: SNAP(),
          trafficMonitor: SNAP({ suite: 'traffic-monitor' }),
          regression: SNAP({ suite: 'regression' })
        }}
      />
    )
    fireEvent.click(screen.getByRole('tab', { name: /production evals/i }))
    expect(onChange).toHaveBeenCalledWith('trafficMonitor')
  })
})
```

- [ ] **Step 7.2: Run tests; expect FAIL**

Run: `bun run test components/evals/dashboard-v2/suite-selector.test.tsx`
Expected: FAIL — current implementation doesn't render `ScoopCard`, has no `ATTENTION` chip, no accent-blue ring.

- [ ] **Step 7.3: Rewrite `SuiteSelector`**

Replace the entire contents of `components/evals/dashboard-v2/suite-selector.tsx`:

```tsx
'use client'

import { ChartLine, Gauge, ShieldCheck, type LucideIcon } from 'lucide-react'

import { getSuiteStatus, type SuiteStatus } from '@/lib/evals/helpers/status'
import { getSuiteDisplayByDashboardId } from '@/lib/evals/display'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import { Delta } from './delta'
import { ScoopCard, type ScoopTint } from './scoop-card'
import type { SuiteId } from './url-state'

const TAB_META: ReadonlyArray<{
  id: SuiteId
  Icon: LucideIcon
  eyebrow: string
}> = [
  { id: 'capability', Icon: ChartLine, eyebrow: 'CAPABILITY' },
  { id: 'trafficMonitor', Icon: Gauge, eyebrow: 'PRODUCTION' },
  { id: 'regression', Icon: ShieldCheck, eyebrow: 'REGRESSION' }
]

const TINT_FOR: Record<SuiteStatus, ScoopTint> = {
  READY: 'ready',
  WATCH: 'watch',
  BLOCKED: 'blocked'
}

export function SuiteSelector({
  active,
  attentionSuite = null,
  onChange,
  snaps,
  previous = {
    capability: null,
    trafficMonitor: null,
    regression: null
  }
}: {
  active: SuiteId
  attentionSuite?: SuiteId | null
  onChange: (id: SuiteId) => void
  snaps: Record<SuiteId, EvalSummarySnapshot | null>
  previous?: Record<SuiteId, EvalSummarySnapshot | null>
}) {
  return (
    <div
      role="tablist"
      aria-label="Evaluation suite"
      className="grid grid-cols-1 gap-3 sm:grid-cols-3"
    >
      {TAB_META.map(({ id, Icon, eyebrow }) => {
        const isActive = id === active
        const isAttention = id === attentionSuite
        const snap = snaps[id]
        const prev = previous[id]
        const copy = getSuiteDisplayByDashboardId(id)
        const status: SuiteStatus = snap ? getSuiteStatus(snap, prev) : 'READY'
        const delta =
          snap && prev ? snap.overallScore - prev.overallScore : null

        return (
          <button
            key={id}
            role="tab"
            aria-selected={isActive}
            type="button"
            onClick={() => onChange(id)}
            className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-2xl"
          >
            <ScoopCard
              tint={TINT_FOR[status]}
              size="lg"
              active={isActive}
              icon={<Icon aria-hidden className="size-10" strokeWidth={1.5} />}
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                    {eyebrow}
                  </span>
                  {isAttention ? (
                    <span className="rounded-full bg-warning text-warning-foreground px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                      ATTENTION
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'font-mono text-3xl font-semibold tabular-nums',
                    status === 'BLOCKED' && 'text-destructive',
                    status === 'WATCH' && 'text-accent-amber'
                  )}
                >
                  {snap ? pct(snap.overallScore) : '—'}
                </div>
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{copy.label}</span>
                  <Delta value={delta} />
                </div>
              </div>
            </ScoopCard>
          </button>
        )
      })}
    </div>
  )
}
```

- [ ] **Step 7.4: Wire `previous` from `dashboard.tsx`**

In `components/evals/dashboard-v2/dashboard.tsx`, the `SuiteSelector` invocation around line 164-169 currently passes `snaps` but not `previous`. Add it:

```tsx
<SuiteSelector
  active={selectedSuite}
  attentionSuite={insight?.suiteId ?? null}
  onChange={setActive}
  snaps={snapMap}
  previous={previousMap}
/>
```

(`previousMap` already exists in scope at `dashboard.tsx:132-136`.)

- [ ] **Step 7.5: Run all evals tests**

Run: `bun run test components/evals lib/evals`
Expected: PASS — including the four new `suite-selector.test.tsx` cases.

- [ ] **Step 7.6: Visual verification**

Reload `/admin/evals`. Confirm:

- Each tab now reads as a card with a left-side icon on a tinted scoop.
- Active suite has a thin accent-blue ring.
- The suite flagged by Phoenix shows an `ATTENTION` chip in the eyebrow row.
- Score is the dominant text (`text-3xl`, mono, tabular-nums).
- `Delta` arrow appears below the score when a previous snapshot exists.

- [ ] **Step 7.7: Commit**

```bash
git add components/evals/dashboard-v2/suite-selector.tsx \
        components/evals/dashboard-v2/suite-selector.test.tsx \
        components/evals/dashboard-v2/dashboard.tsx
git commit -m "feat(evals): suite tabs as scoreboard cards with scoop pattern"
```

---

## Task 8: Phoenix alert escalation

Make `PhoenixInsightStrip` actually look like an alert: triangle icon, left rail, filled CTA, and a destructive palette branch when `thresholdBreached` is true on the alerting suite.

**Files:**

- Modify: `components/evals/dashboard-v2/phoenix-insight.tsx`
- Modify: `components/evals/dashboard-v2/phoenix-insight.test.tsx` (icon & severity assertions)

- [ ] **Step 8.1: Update existing test for the icon swap**

In `phoenix-insight.test.tsx`, add the import and a new assertion to the first test:

```ts
import { AlertTriangle } from 'lucide-react'
```

Add after the existing assertions in "renders the explanation, score context, and Phoenix experiment link":

```ts
expect(screen.getByTestId('phoenix-alert-icon')).toBeInTheDocument()
```

Add a new test for the destructive branch:

```tsx
it('renders the destructive palette when the alert is threshold-breaching', () => {
  const breaching = {
    ...INSIGHT,
    alert: {
      ...INSIGHT.alert,
      passRate: 0.5,
      threshold: 0.85
    }
  }
  render(
    <PhoenixInsightStrip
      insight={breaching}
      onReview={() => {}}
      severity="blocked"
    />
  )
  expect(screen.getByTestId('phoenix-insight')).toHaveClass(
    'border-destructive'
  )
})
```

- [ ] **Step 8.2: Run tests; expect FAIL**

Run: `bun run test components/evals/dashboard-v2/phoenix-insight.test.tsx`
Expected: FAIL — `data-testid="phoenix-alert-icon"` doesn't exist; `severity` prop doesn't exist.

- [ ] **Step 8.3: Replace `PhoenixInsightStrip`**

Replace the entire body of `components/evals/dashboard-v2/phoenix-insight.tsx`:

```tsx
import { AlertTriangle, ArrowRight } from 'lucide-react'

import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import type { PhoenixInsight } from './attention'
import { localLabel } from './local-labels'

type Severity = 'watch' | 'blocked'

const PALETTE: Record<
  Severity,
  { container: string; rail: string; icon: string; cta: string }
> = {
  watch: {
    container: 'border-warning-border bg-warning-bg',
    rail: 'bg-warning',
    icon: 'text-warning',
    cta: 'bg-warning text-warning-foreground hover:bg-warning/90 focus-visible:ring-warning'
  },
  blocked: {
    container: 'border-destructive bg-destructive/10',
    rail: 'bg-destructive',
    icon: 'text-destructive',
    cta: 'bg-destructive text-destructive-foreground hover:bg-destructive/90 focus-visible:ring-destructive'
  }
}

export function PhoenixInsightStrip({
  insight,
  onReview,
  severity = 'watch',
  className
}: {
  insight: PhoenixInsight
  onReview: () => void
  severity?: Severity
  className?: string
}) {
  const failingJudges =
    insight.alert.failedEvaluators.length > 0
      ? insight.alert.failedEvaluators.map(localLabel).join(', ')
      : 'No specific judges listed'
  const palette = PALETTE[severity]

  return (
    <section
      aria-labelledby="phoenix-insight-title"
      className={cn(
        'relative overflow-hidden rounded-xl border pl-4 pr-4 py-3 text-sm',
        palette.container,
        className
      )}
      data-testid="phoenix-insight"
    >
      <span
        aria-hidden
        className={cn('absolute inset-y-0 left-0 w-1', palette.rail)}
      />
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between pl-2">
        <div className="min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <AlertTriangle
              aria-hidden="true"
              data-testid="phoenix-alert-icon"
              className={cn('size-4 shrink-0', palette.icon)}
            />
            <h2
              id="phoenix-insight-title"
              className="text-sm font-semibold text-foreground"
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
              className="inline-flex h-9 items-center rounded-md px-3 text-xs font-medium text-foreground underline-offset-4 hover:underline"
            >
              Open Phoenix
            </a>
          ) : null}
          <button
            type="button"
            onClick={onReview}
            className={cn(
              'inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              palette.cta
            )}
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

- [ ] **Step 8.4: Pass severity from `dashboard.tsx`**

In `dashboard.tsx`'s `SuitesView`, around line 158-162, change the call site so the breached suite escalates the alert:

```tsx
{
  insight ? (
    <PhoenixInsightStrip
      insight={insight}
      onReview={() => setActive(insight.suiteId)}
      severity={
        snapMap[insight.suiteId]?.thresholdBreached ? 'blocked' : 'watch'
      }
    />
  ) : null
}
```

- [ ] **Step 8.5: Run tests; expect PASS**

Run: `bun run test components/evals/dashboard-v2/phoenix-insight.test.tsx components/evals/dashboard-v2/dashboard.test.tsx`
Expected: PASS.

- [ ] **Step 8.6: Visual verification**

Force a threshold breach in dev (e.g. by editing a fixture row's `thresholdBreached`) and confirm the alert renders red rail + red filled CTA. Then revert.

- [ ] **Step 8.7: Commit**

```bash
git add components/evals/dashboard-v2/phoenix-insight.tsx \
        components/evals/dashboard-v2/phoenix-insight.test.tsx \
        components/evals/dashboard-v2/dashboard.tsx
git commit -m "feat(evals): escalate Phoenix alert to alarm palette on threshold breach"
```

---

## Task 9: Donut color-tier

The 224px donut at `score-feature.tsx:80-92` is always blue. Drive its `stroke` from `getScoreStatus`, and color the inner aggregate text the same way.

**Files:**

- Modify: `components/evals/dashboard/score-feature.tsx:25-92`

- [ ] **Step 9.1: Edit `score-feature.tsx`**

Add the import:

```ts
import { getScoreStatus } from '@/components/evals/dashboard/score-bar'
```

After `const score = ...` near line 25, derive the status:

```ts
const status = getScoreStatus({
  value: cap.overallScore,
  threshold: cap.threshold,
  failed: cap.thresholdBreached
})
const ringStroke =
  status === 'on-track'
    ? 'var(--accent-blue)'
    : status === 'near-threshold'
      ? 'var(--accent-amber)'
      : 'var(--destructive)'
const valueColor =
  status === 'on-track'
    ? 'text-foreground'
    : status === 'near-threshold'
      ? 'text-accent-amber'
      : 'text-destructive'
```

Replace line 80 (`style={{ stroke: 'var(--accent-blue)' }}`) with:

```tsx
              style={{ stroke: ringStroke }}
```

Replace line 90 (`<span className="font-mono text-5xl font-semibold tabular-nums">`) with:

```tsx
              <span className={cn('font-mono text-5xl font-semibold tabular-nums', valueColor)}>
```

(Add the `cn` import if not present.)

- [ ] **Step 9.2: Run tests**

Run: `bun run test components/evals`
Expected: PASS.

- [ ] **Step 9.3: Visual verification**

Confirm: a healthy suite donut stays blue; a `near-threshold` suite turns amber; a `below-threshold` suite turns red. Inner number recolors to match.

- [ ] **Step 9.4: Commit**

```bash
git add components/evals/dashboard/score-feature.tsx
git commit -m "feat(evals): color-tier the score donut by threshold status"
```

---

## Task 10: KPI tiles with scoop

Replace the existing flat `<dl>` row at `score-feature.tsx:115-134` with a three-up `KpiStrip` using `ScoopCard size="sm"`.

**Files:**

- Create: `components/evals/dashboard-v2/kpi-strip.tsx`
- Modify: `components/evals/dashboard/score-feature.tsx:115-134`

- [ ] **Step 10.1: Implement `KpiStrip`**

Create `components/evals/dashboard-v2/kpi-strip.tsx`:

```tsx
import { CircleCheckBig, Layers, TrendingDown } from 'lucide-react'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { pct } from '@/components/evals/dashboard/shared'

import { Delta } from './delta'
import { ScoopCard, type ScoopTint } from './scoop-card'

export function KpiStrip({
  snap,
  previous
}: {
  snap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  const delta =
    previous == null ? null : snap.overallScore - previous.overallScore
  const deltaTint: ScoopTint =
    delta == null ? 'neutral' : delta < 0 ? 'blocked' : 'ready'

  return (
    <div className="grid grid-cols-3 gap-3">
      <ScoopCard
        size="sm"
        tint={snap.thresholdBreached ? 'blocked' : 'ready'}
        icon={<CircleCheckBig aria-hidden className="size-5" />}
      >
        <Tile label="PASS" value={pct(snap.passRate)} />
      </ScoopCard>

      <ScoopCard
        size="sm"
        tint={deltaTint}
        icon={<TrendingDown aria-hidden className="size-5" />}
      >
        <Tile label="Δ 48H" value={<Delta value={delta} />} />
      </ScoopCard>

      <ScoopCard
        size="sm"
        tint="neutral"
        icon={<Layers aria-hidden className="size-5" />}
      >
        <Tile label="CASES" value={String(snap.totalCases)} />
      </ScoopCard>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold tabular-nums leading-tight">
        {value}
      </span>
    </div>
  )
}
```

- [ ] **Step 10.2: Wire it into `score-feature.tsx`**

In `components/evals/dashboard/score-feature.tsx`, add the import:

```ts
import { KpiStrip } from '@/components/evals/dashboard-v2/kpi-strip'
```

Replace lines 115-134 (the entire `<dl>` block) with:

```tsx
<KpiStrip snap={cap} previous={previous} />
```

- [ ] **Step 10.3: Run tests**

Run: `bun run test components/evals`
Expected: PASS.

- [ ] **Step 10.4: Visual verification**

Three KPI tiles render side-by-side, each with a small left-side icon on a tinted scoop. The middle (`Δ 48H`) tile's tint flips between green / red based on the delta sign.

- [ ] **Step 10.5: Commit**

```bash
git add components/evals/dashboard-v2/kpi-strip.tsx \
        components/evals/dashboard/score-feature.tsx
git commit -m "feat(evals): KPI strip with scoop tiles"
```

---

## Task 11: Type & spacing pass

Standardize to two spacing tokens (`space-y-8` page, `space-y-3` card) and three type tiers. Eliminate ad-hoc `text-[10px]` / `text-[11px]` / `text-[13px]` and ad-hoc gaps. This is a careful sweep — read each match before editing.

**Files:**

- Modify: `components/evals/dashboard-v2/dashboard.tsx` (page rhythm)
- Modify: `components/evals/dashboard-v2/evaluator-breakdown.tsx` (typography)
- Modify: `components/evals/dashboard-v2/suite-selector.tsx` (already at target — verify)

- [ ] **Step 11.1: Page rhythm in `dashboard.tsx`**

Change the wrapper at `dashboard.tsx:36`:

```tsx
<div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
```

to:

```tsx
<div className="mx-auto flex w-full max-w-7xl flex-col gap-8 px-4 pb-10 pt-8 sm:px-8 lg:px-12">
```

Same change at `dashboard.tsx:62`.

In `SuitesView` (line 152-156), change `space-y-10` → `space-y-8`.

In the `grid` row at line 172, change `gap-10` → `gap-8`.

- [ ] **Step 11.2: Type-tier sweep in `evaluator-breakdown.tsx`**

Search for ad-hoc sizes:

Run: `grep -nE "text-\[(10|11|13)px\]" components/evals/dashboard-v2/evaluator-breakdown.tsx`

For each match, replace with the closest standard tier:

- `text-[10px]` → `text-xs` (11/12px)
- `text-[11px]` → `text-xs`
- `text-[13px]` → `text-sm`

Specific lines from prior reads:

- Line 514: `text-[11px]` → `text-xs`
- Line 571: `text-[11px]` → `text-xs`

- [ ] **Step 11.3: Run tests**

Run: `bun run test components/evals`
Expected: PASS.

- [ ] **Step 11.4: Visual verification**

Page should feel slightly tighter (less vertical air), text more uniform.

- [ ] **Step 11.5: Commit**

```bash
git add components/evals/dashboard-v2/dashboard.tsx \
        components/evals/dashboard-v2/evaluator-breakdown.tsx
git commit -m "style(evals): collapse type and spacing scales"
```

---

## Task 12: Widen the score-bar grid column

The `ScoreBar` itself is already correct (uses `flex-1` and `width: ${score * 100}%`). The unused-space symptom comes from `evaluator-breakdown.tsx:99` where the grid template only allots `1fr` to the bar.

**Files:**

- Modify: `components/evals/dashboard-v2/evaluator-breakdown.tsx:99`

- [ ] **Step 12.1: Edit the grid template**

Change line 99:

```tsx
<span className="-mx-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_44px] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40">
```

to:

```tsx
<span className="-mx-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,2fr)_44px] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40">
```

- [ ] **Step 12.2: Run tests + visual verification**

Run: `bun run test components/evals/dashboard-v2/evaluator-breakdown.test.tsx`
Expected: PASS.

In the browser, evaluator rows now use the available row width — bars stretch wider, percent value still right-aligns.

- [ ] **Step 12.3: Commit**

```bash
git add components/evals/dashboard-v2/evaluator-breakdown.tsx
git commit -m "style(evals): widen evaluator score-bar column"
```

---

## Task 13: Dark-mode parity verification

No code changes expected. Every status color used in this work resolves through tokens (`bg-success-bg`, `bg-warning-bg`, `bg-destructive`, `text-accent-blue`, etc.) that already have dark-mode definitions in `app/globals.css:108-145`. This task is the verification gate.

- [ ] **Step 13.1: Toggle dark mode in the app**

Run: `bun dev`. Open `/admin/evals`. Switch the theme via the existing theme toggle (or `localStorage.theme = 'dark'` + reload).

- [ ] **Step 13.2: Eyeball checklist**

Confirm:

- Status pill (READY/WATCH/BLOCKED) is legible on the dark background.
- Suite tab scoop tints (`bg-success-bg`, `bg-warning-bg`, `bg-destructive/15`) are visible without overpowering the card.
- Phoenix alert's red palette (when forced) reads as alert-red, not muted-pink.
- Donut ring colors are saturated against the dark donut track.
- KPI tile scoops are visible.
- No leftover hardcoded hex values shouting through (search for any `#` in the modified files).

Run: `grep -nE "#[0-9a-fA-F]{3,8}" components/evals/dashboard-v2/*.tsx components/evals/dashboard/score-feature.tsx`
Expected: no matches in modified-by-this-PR files. (If something pre-existing matches, leave it — out of scope.)

- [ ] **Step 13.3: Capture screenshots (optional, for the PR)**

Capture light + dark screenshots of the dashboard with each suite selected.

- [ ] **Step 13.4: Commit (only if any code changed)**

If verification surfaced an actual regression, fix it inline and commit. If nothing changed, no commit.

---

## Task 14: Final lint, typecheck, and full-suite test

The hard quality bar from `CLAUDE.md`: "Always run `bun lint` and `bun typecheck` before claiming done. Fix every warning, not just the ones your changes introduced."

- [ ] **Step 14.1: Lint**

Run: `bun lint`
Expected: zero errors, zero warnings. Fix any introduced; address pre-existing if quick.

- [ ] **Step 14.2: Typecheck**

Run: `bun typecheck`
Expected: zero errors.

- [ ] **Step 14.3: Format check**

Run: `bun format:check`
Expected: zero diffs. If changes needed, run `bun format` and commit a format fix.

- [ ] **Step 14.4: Full evals test pass**

Run: `bun run test components/evals lib/evals`
Expected: PASS.

- [ ] **Step 14.5: Smoke the dev server one more time**

Run: `bun dev`. Browse `/admin/evals`. Confirm:

- Page loads without console errors.
- All three suite tabs are clickable and switch the active suite.
- Phoenix alert (if present) review button selects the alerting suite.
- Status pill changes when the underlying data changes (force-edit a fixture for one render).

- [ ] **Step 14.6: Final commit (if format/lint required follow-ups)**

```bash
git add -A
git commit -m "chore: lint and format follow-ups"
```

---

## Visual spec reference

### Type scale

| Use                           | Size    | Token                    |
| ----------------------------- | ------- | ------------------------ |
| Page H1 ("Evaluation")        | 24px    | `text-2xl`               |
| Card title (Evaluators, etc.) | 14px    | `text-sm`                |
| Suite score                   | 30px    | `text-3xl`               |
| KPI value                     | 18px    | `text-lg`                |
| Eyebrow (uppercase, tracked)  | 11-12px | `text-xs`                |
| Body text                     | 13px    | `text-sm` (closest tier) |
| Meta / caption                | 11px    | `text-xs`                |

### Spacing rhythm

- **Page-level:** `space-y-8` / `gap-8`
- **Intra-card:** `space-y-3` / `gap-3`
- Wrapper padding: `pb-10 pt-8` (was `pb-16 pt-12`)

### Card / scoop dimensions

| Element        | Min height | Padding | Scoop                        |
| -------------- | ---------- | ------- | ---------------------------- |
| Suite tab card | 140px      | 20px    | 240×180 ellipse @ (-70, -60) |
| KPI tile       | 90px       | 14px    | 120×80 ellipse @ (-25, -30)  |

### Scoop tint mapping

| Status                 | Tailwind class      | Used on                              |
| ---------------------- | ------------------- | ------------------------------------ |
| READY / healthy        | `bg-success-bg`     | Suite cards passing; PASS KPI        |
| WATCH / near-threshold | `bg-warning-bg`     | Attention suite; positive Δ          |
| BLOCKED / regressing   | `bg-destructive/15` | Threshold-breached cards; negative Δ |
| Neutral                | `bg-muted`          | CASES KPI (count, not state)         |

### Icon usage (from `lucide-react`, PascalCase imports)

| Where                    | Icon                              |
| ------------------------ | --------------------------------- |
| Capability tab           | `ChartLine`                       |
| Traffic monitor tab      | `Gauge`                           |
| Regression tab           | `ShieldCheck`                     |
| Phoenix alert            | `AlertTriangle`                   |
| Delta (up / down / flat) | `ArrowUp` / `ArrowDown` / `Minus` |
| PASS KPI                 | `CircleCheckBig`                  |
| Δ 48H KPI                | `TrendingDown`                    |
| CASES KPI                | `Layers`                          |

---

## Open questions

- **Tablet breakpoint.** Existing `SuiteSelector` already stacks `grid-cols-1 sm:grid-cols-3`; the new version preserves this. KPI tiles inside `score-feature.tsx`'s left column will compress on narrow viewports — if this becomes ugly, drop to `grid-cols-1 sm:grid-cols-3` for KPI tiles too. Validate visually during Task 13.
- **Run-history view.** Out of scope for this polish; `ActivityList` rows stay as plain list items.

---

## Rollback procedure

Each task is its own commit. To revert any single concern:

```bash
git log --oneline -- components/evals/dashboard-v2/  # find the commit
git revert <sha>
```

The status helper (Task 1) is the only cross-cutting change — reverting it requires reverting Tasks 5, 7 as well. Tasks 2-12 (excluding 5 and 7) are independently revertable.

---

## References

- Wireframe: `polymorph.pen` — `Gy1OS` (light), `FfIuo` (dark), `Jc76X`, `JbfZt`
- Prerequisite (already shipped): `docs/plans/evals-dashboard-ia-migration.md`
- Data shape: `lib/evals/types.ts:55-105` (`EvalSummarySnapshot`)
- Color tokens: `app/globals.css:42-44, 121-123` (`--success`), `:37, 116` (`--accent-amber`), `:36, 115` (`--accent-blue`)
- Existing helpers: `attention.ts` (`getDefaultSuite`, `getPhoenixInsight`), `score-bar.tsx:16` (`getScoreStatus`)

'use client'

import type { CSSProperties } from 'react'
import { useCallback, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { formatDistanceToNow } from 'date-fns'
import { ChevronDown, ChevronUp, TriangleAlert } from 'lucide-react'

import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import { snapshotSuiteKey } from '@/lib/evals/glossary'
import { getLatestThresholdAlert } from '@/lib/evals/helpers/alerts'
import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  EvalTrendPoint
} from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { TooltipProvider } from '@/components/ui/tooltip'

import { ActivityList } from '@/components/evals/dashboard/activity-list'
import { ComparisonTable } from '@/components/evals/dashboard/comparison-table'
import { ScoreBar } from '@/components/evals/dashboard/score-bar'
import { ScoreFeature } from '@/components/evals/dashboard/score-feature'
import { pct } from '@/components/evals/dashboard/shared'
import { ScoreCell } from '@/components/evals/glossary'

// ---------- Mock data (frozen for stable demo screenshots) -------------------

const DEMO_NOW = Date.UTC(2026, 3, 29, 20, 48, 0)
const HOUR = 60 * 60 * 1000

function trend(seed: number, count = 14): EvalTrendPoint[] {
  const out: EvalTrendPoint[] = []
  let v = 0.78 + (seed % 7) / 100
  for (let i = count - 1; i >= 0; i -= 1) {
    v = Math.max(0.55, Math.min(0.97, v + Math.sin(seed + i) * 0.04))
    out.push({
      createdAt: new Date(DEMO_NOW - i * 24 * HOUR).toISOString(),
      passRate: Math.max(0.5, Math.min(1, v - 0.02)),
      overallScore: v
    })
  }
  return out
}

function snap(
  suite: EvalSummarySnapshot['suite'],
  overrides: Partial<EvalSummarySnapshot> = {}
): EvalSummarySnapshot {
  const totalCases = overrides.totalCases ?? 32
  return {
    id: `${suite}-${overrides.createdAt ?? 'latest'}`,
    suite,
    experimentName: 'eval-2026-04-28-r3',
    datasetName:
      suite === 'capability'
        ? 'curated-prompts-v4'
        : suite === 'regression'
          ? 'regression-fixtures-v2'
          : 'real-traffic-rolling-7d',
    passRate: 0.92,
    threshold: 0.85,
    thresholdBreached: false,
    failedEvaluators: [],
    overallScore: 0.89,
    evaluatorScores: {
      faithfulness: 0.94,
      relevance: 0.91,
      safety: 0.99,
      response_quality: 0.88,
      citation_accuracy: 0.83,
      tool_usage: 0.9,
      deterministic_prechecks: 1.0
    },
    totalCases,
    attemptedCases: overrides.attemptedCases ?? totalCases,
    failedCases: 0,
    dropRate: 0,
    phoenixUrl: 'https://phoenix-production-c6b5.up.railway.app',
    createdAt: new Date(DEMO_NOW - 2 * HOUR).toISOString(),
    ...overrides
  }
}

const CAPABILITY_LATEST = snap('capability', {
  passRate: 0.94,
  overallScore: 0.91,
  totalCases: 24,
  evaluatorScores: {
    faithfulness: 0.95,
    relevance: 0.93,
    safety: 1.0,
    response_quality: 0.9,
    citation_accuracy: 0.88,
    tool_usage: 0.92,
    deterministic_prechecks: 1.0
  }
})

const CAPABILITY_PREVIOUS = snap('capability', {
  passRate: 0.91,
  overallScore: 0.88,
  totalCases: 24,
  createdAt: new Date(DEMO_NOW - 26 * HOUR).toISOString()
})

const REGRESSION_LATEST = snap('regression', {
  passRate: 0.96,
  overallScore: 0.93,
  totalCases: 18,
  createdAt: new Date(DEMO_NOW - 8 * HOUR).toISOString()
})

const REGRESSION_PREVIOUS = snap('regression', {
  passRate: 0.95,
  overallScore: 0.93,
  totalCases: 18,
  createdAt: new Date(DEMO_NOW - 50 * HOUR).toISOString()
})

const TRAFFIC_LATEST = snap('traffic-monitor', {
  passRate: 0.81,
  overallScore: 0.78,
  totalCases: 47,
  threshold: 0.85,
  thresholdBreached: true,
  failedEvaluators: ['citation_accuracy'],
  createdAt: new Date(DEMO_NOW - 4 * HOUR).toISOString(),
  evaluatorScores: {
    faithfulness: 0.86,
    relevance: 0.82,
    safety: 0.99,
    response_quality: 0.79,
    citation_accuracy: 0.62,
    tool_usage: 0.85,
    deterministic_prechecks: 1.0
  }
})

const TRAFFIC_PREVIOUS = snap('traffic-monitor', {
  passRate: 0.84,
  overallScore: 0.82,
  totalCases: 47,
  createdAt: new Date(DEMO_NOW - 50 * HOUR).toISOString()
})

const MOCK: EvalsDashboardData = {
  capability: {
    latest: CAPABILITY_LATEST,
    previous: CAPABILITY_PREVIOUS,
    trend: trend(11),
    lastUpdated: CAPABILITY_LATEST.createdAt
  },
  regression: {
    latest: REGRESSION_LATEST,
    previous: REGRESSION_PREVIOUS,
    trend: trend(7, 10),
    lastUpdated: REGRESSION_LATEST.createdAt
  },
  trafficMonitor: {
    latest: TRAFFIC_LATEST,
    previous: TRAFFIC_PREVIOUS,
    trend: trend(3),
    lastUpdated: TRAFFIC_LATEST.createdAt
  },
  recentRuns: [
    CAPABILITY_LATEST,
    TRAFFIC_LATEST,
    REGRESSION_LATEST,
    CAPABILITY_PREVIOUS,
    TRAFFIC_PREVIOUS,
    REGRESSION_PREVIOUS
  ]
}

// ---------- Tabs -------------------------------------------------------------

type View = 'suites' | 'history'
const VIEWS: ReadonlyArray<{ id: View; label: string; description: string }> = [
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

function isView(v: string | null): v is View {
  return v === 'suites' || v === 'history'
}

function enter(delayMs: number): CSSProperties {
  return { ['--enter-delay' as string]: `${delayMs}ms` }
}

// ---------- Shell ------------------------------------------------------------

export function RedesignEvalsDashboard() {
  const search = useSearchParams()
  const initialView: View = isView(search.get('view'))
    ? (search.get('view') as View)
    : 'suites'
  const [view, setViewState] = useState<View>(initialView)

  // Keep the URL in sync with the chosen view, but don't push history entries
  // — refresh-safe and shareable, but back-button still leaves the dashboard.
  const setView = useCallback((next: View) => {
    setViewState(next)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('view', next)
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [])

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <Header view={view} onChange={setView} />

          {view === 'suites' ? <SuitesView /> : null}
          {view === 'history' ? <HistoryView /> : null}

          <DemoFootnote view={view} />
        </div>
      </div>
    </TooltipProvider>
  )
}

// ---------- Header & functional ViewSwitcher ---------------------------------

function Header({
  view,
  onChange
}: {
  view: View
  onChange: (next: View) => void
}) {
  const lastSyncIso = MOCK.trafficMonitor.lastUpdated
  const lastSync = lastSyncIso
    ? formatDistanceToNow(new Date(lastSyncIso), { addSuffix: true })
    : 'never'
  const cap = MOCK.capability.latest
  const traf = MOCK.trafficMonitor.latest
  const totalCases = (cap?.totalCases ?? 0) + (traf?.totalCases ?? 0)
  const active = VIEWS.find(v => v.id === view)!

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
          {active.description} {totalCases} cases scored in the last 48h · last
          sync {lastSync}.
        </p>
      </div>
    </header>
  )
}

function ViewSwitcher({
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

// ---------- Suites view ------------------------------------------------------

type SuiteId = 'capability' | 'trafficMonitor' | 'regression'
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

function isSuiteId(v: string | null): v is SuiteId {
  return v === 'capability' || v === 'trafficMonitor' || v === 'regression'
}

function SuitesView() {
  const search = useSearchParams()
  const initialSuite: SuiteId = isSuiteId(search.get('suite'))
    ? (search.get('suite') as SuiteId)
    : 'capability'
  const [active, setActiveState] = useState<SuiteId>(initialSuite)

  const setActive = useCallback((next: SuiteId) => {
    setActiveState(next)
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href)
      url.searchParams.set('suite', next)
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [])

  const cap = MOCK.capability.latest!
  const traf = MOCK.trafficMonitor.latest!
  const reg = MOCK.regression.latest!
  const previousMap: Record<SuiteId, EvalSummarySnapshot | null> = {
    capability: MOCK.capability.previous,
    trafficMonitor: MOCK.trafficMonitor.previous,
    regression: MOCK.regression.previous
  }
  const snapMap: Record<SuiteId, EvalSummarySnapshot> = {
    capability: cap,
    trafficMonitor: traf,
    regression: reg
  }

  return (
    <div
      className="space-y-10 motion-safe:animate-content-enter"
      style={enter(60)}
    >
      <CompactAlert data={MOCK} />

      <SuiteSelector active={active} onChange={setActive} snaps={snapMap} />

      <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ScoreFeature
            cap={snapMap[active]}
            previous={previousMap[active]}
            hideTagline
          />
        </div>
        <div className="lg:col-span-8">
          <EvaluatorBreakdown snap={snapMap[active]} />
        </div>
      </div>

      <CollapsibleComparison cap={cap} traf={traf} />
    </div>
  )
}

// ---------- Compact alert (replaces full-width AlertBanner) -----------------

function CompactAlert({ data }: { data: EvalsDashboardData }) {
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

function SuiteSelector({
  active,
  onChange,
  snaps
}: {
  active: SuiteId
  onChange: (id: SuiteId) => void
  snaps: Record<SuiteId, EvalSummarySnapshot>
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
                  s.thresholdBreached ? 'text-destructive' : 'text-foreground'
                )}
              >
                {pct(s.overallScore)}
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

// ---------- Evaluator breakdown (unifies prechecks + judges) ----------------

const DETERMINISTIC_KEYS = new Set(['deterministic_prechecks', 'tool_usage'])

// Local label override: "Deterministic Prechecks" is too long for the 2-column
// row + AUTO badge layout. Body copy already explains "deterministic rules".
const LOCAL_LABEL_OVERRIDES: Record<string, string> = {
  deterministic_prechecks: 'Prechecks'
}

function localLabel(key: string) {
  return LOCAL_LABEL_OVERRIDES[key] ?? getEvaluatorLabel(key)
}

function EvaluatorBreakdown({ snap }: { snap: EvalSummarySnapshot }) {
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

function AutoBadge() {
  return (
    <span className="inline-flex shrink-0 items-center rounded-full border border-border bg-muted/40 px-1.5 py-px font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">
      auto
    </span>
  )
}

function CollapsibleComparison({
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

// ---------- History view -----------------------------------------------------

function HistoryView() {
  return (
    <div className="motion-safe:animate-content-enter" style={enter(60)}>
      <ActivityList data={MOCK} />
    </div>
  )
}

// ---------- Footnote ---------------------------------------------------------

function DemoFootnote({ view }: { view: View }) {
  return (
    <footer
      className="mt-8 flex items-start justify-between gap-6 border-t border-border/60 pt-6 text-xs text-muted-foreground motion-safe:animate-content-enter"
      style={enter(220)}
    >
      <p className="max-w-2xl leading-relaxed">
        Demo surface — mock data, IA proposal. Tabs are functional and
        URL-driven (current view: <span className="font-mono">{view}</span>).
        Other demos: <span className="font-mono">/admin/evals/demo</span>{' '}
        (sectioned) and{' '}
        <span className="font-mono">/admin/evals/demo-mixed</span> (current
        dashboard with mock data).
      </p>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
        v4 · ia split
      </span>
    </footer>
  )
}

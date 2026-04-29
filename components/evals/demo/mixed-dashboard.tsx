'use client'

import type { CSSProperties, ReactNode } from 'react'
import { useMemo, useState } from 'react'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import { format, formatDistanceToNow } from 'date-fns'
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from 'recharts'

import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  EvalTrendPoint
} from '@/lib/evals/types'

import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent
} from '@/components/ui/chart'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/components/ui/tooltip'

const TooltipPortal = TooltipPrimitive.Portal

// ---------- Mock data ---------------------------------------------------------

const NOW = Date.now()
const HOUR = 60 * 60 * 1000

function trend(seed: number, count = 14): EvalTrendPoint[] {
  const out: EvalTrendPoint[] = []
  let v = 0.78 + (seed % 7) / 100
  for (let i = count - 1; i >= 0; i -= 1) {
    v = Math.max(0.55, Math.min(0.97, v + Math.sin(seed + i) * 0.04))
    out.push({
      createdAt: new Date(NOW - i * 24 * HOUR).toISOString(),
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
    totalCases: 32,
    attemptedCases: 32,
    failedCases: 0,
    dropRate: 0,
    phoenixUrl: 'https://phoenix-production-c6b5.up.railway.app',
    createdAt: new Date(NOW - 2 * HOUR).toISOString(),
    ...overrides
  }
}

const MOCK: EvalsDashboardData = {
  capability: {
    latest: snap('capability', {
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
    }),
    previous: snap('capability', {
      passRate: 0.91,
      overallScore: 0.88,
      createdAt: new Date(NOW - 26 * HOUR).toISOString()
    }),
    trend: trend(11),
    lastUpdated: new Date(NOW - 2 * HOUR).toISOString()
  },
  regression: {
    latest: snap('regression', {
      passRate: 0.96,
      overallScore: 0.93,
      totalCases: 18
    }),
    previous: snap('regression', {
      passRate: 0.95,
      overallScore: 0.93,
      createdAt: new Date(NOW - 50 * HOUR).toISOString()
    }),
    trend: trend(7, 10),
    lastUpdated: new Date(NOW - 8 * HOUR).toISOString()
  },
  trafficMonitor: {
    latest: snap('traffic-monitor', {
      passRate: 0.81,
      overallScore: 0.78,
      totalCases: 47,
      threshold: 0.85,
      thresholdBreached: true,
      failedEvaluators: ['citation_accuracy'],
      evaluatorScores: {
        faithfulness: 0.86,
        relevance: 0.82,
        safety: 0.99,
        response_quality: 0.79,
        citation_accuracy: 0.62,
        tool_usage: 0.85,
        deterministic_prechecks: 1.0
      }
    }),
    previous: snap('traffic-monitor', {
      passRate: 0.84,
      overallScore: 0.82,
      createdAt: new Date(NOW - 50 * HOUR).toISOString()
    }),
    trend: trend(3),
    lastUpdated: new Date(NOW - 4 * HOUR).toISOString()
  }
}

// ---------- Helpers -----------------------------------------------------------

const pct = (v: number) => `${Math.round(v * 100)}%`
const deltaPts = (n: number | null) => {
  if (n == null) return null
  const r = Math.round(n * 100)
  if (r === 0) return '·'
  return `${r > 0 ? '+' : ''}${r}`
}

type Severity = 'ok' | 'watch' | 'alarm'
function severityForScore(v: number, healthy = 0.85, warn = 0.7): Severity {
  if (v >= healthy) return 'ok'
  if (v >= warn) return 'watch'
  return 'alarm'
}

function severityText(s: Severity) {
  switch (s) {
    case 'ok':
      return 'text-foreground'
    case 'watch':
      return 'text-accent-amber'
    case 'alarm':
      return 'text-destructive'
  }
}

function enter(delayMs: number): CSSProperties {
  return { ['--enter-delay' as string]: `${delayMs}ms` }
}

// ---------- Term glossary (single source of truth) ---------------------------
// These power the on-hover tooltips. Keeping them in one place means the same
// definition appears everywhere a term is used — and they're cheap to update.

const DEFINITIONS = {
  capability:
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

function DefinedTerm({
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
      <TooltipPortal>
        <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
          {def}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  )
}

function JudgeLabel({ judgeKey }: { judgeKey: string }) {
  const def = JUDGE_DEFINITIONS[judgeKey]
  const label = getEvaluatorLabel(judgeKey)
  if (!def) return <>{label}</>
  return <DefinedTerm def={def}>{label}</DefinedTerm>
}

// ---------- Per-score insight data + component ------------------------------
// These power the "why is this score what it is?" tooltips. Real implementation
// would derive these from the failing-case audit pipeline; demo uses fixed
// fixtures keyed by suite × judge.

type SuiteKey = 'capability' | 'trafficMonitor' | 'regression'

type FailureMode = { count: number; description: string }
type ScoreInsight = {
  passed: number
  total: number
  threshold?: number
  failureModes?: FailureMode[]
  note?: string
}

const SCORE_INSIGHTS: Record<SuiteKey, Record<string, ScoreInsight>> = {
  capability: {
    faithfulness: {
      passed: 23,
      total: 24,
      threshold: 0.9,
      failureModes: [
        {
          count: 1,
          description: 'Summarised three sources but only cited two of them.'
        }
      ]
    },
    relevance: {
      passed: 22,
      total: 24,
      failureModes: [
        {
          count: 2,
          description: 'Over-explained when the user asked for a brief answer.'
        }
      ]
    },
    safety: {
      passed: 24,
      total: 24,
      note: 'No safety flags. Every case in the curated set is intentionally benign.'
    },
    response_quality: {
      passed: 21,
      total: 24,
      failureModes: [
        { count: 3, description: 'Verbose intros that buried the answer.' }
      ]
    },
    citation_accuracy: {
      passed: 21,
      total: 24,
      failureModes: [
        { count: 2, description: 'Linked URLs that returned 404.' },
        { count: 1, description: 'Cited the wrong source for a numeric claim.' }
      ]
    },
    tool_usage: {
      passed: 22,
      total: 24,
      failureModes: [
        {
          count: 2,
          description:
            'Reached for web search when in-memory knowledge was sufficient.'
        }
      ]
    },
    deterministic_prechecks: {
      passed: 24,
      total: 24,
      note: 'All cases passed schema, format, and length checks.'
    }
  },
  trafficMonitor: {
    faithfulness: {
      passed: 40,
      total: 47,
      threshold: 0.85,
      failureModes: [
        {
          count: 4,
          description: 'Added details not present in the supplied sources.'
        },
        {
          count: 2,
          description: 'Hallucinated specific dates or version numbers.'
        },
        {
          count: 1,
          description: 'Stated a causal claim without source support.'
        }
      ]
    },
    relevance: {
      passed: 39,
      total: 47,
      failureModes: [
        {
          count: 5,
          description:
            'Drifted into adjacent topics the user did not ask about.'
        },
        {
          count: 3,
          description: 'Answered a slightly different question than was asked.'
        }
      ]
    },
    safety: {
      passed: 46,
      total: 47,
      failureModes: [
        {
          count: 1,
          description:
            'Continued an off-policy roleplay request after a refusal was warranted.'
        }
      ]
    },
    response_quality: {
      passed: 37,
      total: 47,
      failureModes: [
        { count: 6, description: 'Verbose; answer buried in throat-clearing.' },
        {
          count: 4,
          description:
            'Structural issues — missing headings or inconsistent ordering.'
        }
      ]
    },
    citation_accuracy: {
      passed: 29,
      total: 47,
      threshold: 0.85,
      failureModes: [
        {
          count: 11,
          description: 'Citation did not support the claim it followed.'
        },
        { count: 4, description: 'Linked URLs that returned 404.' },
        {
          count: 3,
          description: 'Fabricated citation IDs that resolve to nothing.'
        }
      ],
      note: 'This is the breach driving the Traffic Monitor alarm.'
    },
    tool_usage: {
      passed: 40,
      total: 47,
      failureModes: [
        {
          count: 7,
          description:
            'Skipped a tool call when one would have produced a better answer.'
        }
      ]
    },
    deterministic_prechecks: {
      passed: 47,
      total: 47,
      note: 'All 47 live cases passed mechanical checks.'
    }
  },
  regression: {
    faithfulness: { passed: 17, total: 18 },
    relevance: { passed: 17, total: 18 },
    safety: { passed: 18, total: 18 },
    response_quality: { passed: 16, total: 18 },
    citation_accuracy: { passed: 16, total: 18 },
    tool_usage: { passed: 17, total: 18 },
    deterministic_prechecks: { passed: 18, total: 18 }
  }
}

function getScoreInsight(suite: SuiteKey, judgeKey: string) {
  return SCORE_INSIGHTS[suite]?.[judgeKey] ?? null
}

function AggregateBreakdown({
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
      {lowest && lowestInsight ? (
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

function ScoreCell({
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
  if (!insight) return <>{children}</>

  const judgeLabel = getEvaluatorLabel(judgeKey)
  const pctValue = Math.round(value * 100)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-full cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipPortal>
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
            <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
              {insight.passed}/{insight.total} passed
            </span>
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
            <p className="text-muted-foreground italic">{insight.note}</p>
          ) : null}
        </TooltipContent>
      </TooltipPortal>
    </Tooltip>
  )
}

// ---------- Layout shell ------------------------------------------------------

export function MixedEvalsDashboard() {
  const cap = MOCK.capability.latest!
  const traf = MOCK.trafficMonitor.latest!
  const reg = MOCK.regression.latest!

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
          <div className="motion-safe:animate-content-enter" style={enter(0)}>
            <Header />
          </div>

          <div className="motion-safe:animate-content-enter" style={enter(60)}>
            <KpiStrip data={MOCK} />
          </div>

          <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
            <div
              className="motion-safe:animate-content-enter lg:col-span-4"
              style={enter(120)}
            >
              <ScoreFeature
                label="Benchmarks"
                cap={cap}
                previous={MOCK.capability.previous}
              />
            </div>

            <div
              className="motion-safe:animate-content-enter lg:col-span-8"
              style={enter(180)}
            >
              <CombinedTrend
                capability={MOCK.capability.trend}
                traffic={MOCK.trafficMonitor.trend}
                regression={MOCK.regression.trend}
              />
            </div>
          </div>

          <div className="motion-safe:animate-content-enter" style={enter(240)}>
            <ComparisonTable cap={cap} traf={traf} />
          </div>

          <div className="motion-safe:animate-content-enter" style={enter(300)}>
            <ActivityList cap={cap} reg={reg} traf={traf} />
          </div>

          <DemoFootnote />
        </div>
      </div>
    </TooltipProvider>
  )
}

// ---------- Header (no card) --------------------------------------------------

function Header() {
  const lastSync = formatDistanceToNow(
    new Date(MOCK.trafficMonitor.lastUpdated!),
    { addSuffix: true }
  )

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
    {
      id: 'glance' as const,
      label: 'At a glance',
      hint: 'Current state of all suites'
    },
    {
      id: 'sidebyside' as const,
      label: 'Curated vs live',
      hint: 'Benchmarks against Traffic Monitor, judge by judge'
    },
    {
      id: 'history' as const,
      label: 'Run history',
      hint: 'Every recent run, newest first'
    }
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
            aria-label={`${it.label} — ${it.hint}`}
            title={it.hint}
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

// ---------- KPI strip (rolls up across suites) -------------------------------

function KpiStrip({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest!
  const prev = data.capability.previous!
  const traf = data.trafficMonitor.latest!

  const overallSeverity: Severity = traf.thresholdBreached
    ? 'alarm'
    : severityForScore(cap.passRate, 0.9, 0.8)
  const statusLabel =
    overallSeverity === 'alarm'
      ? 'Alarm'
      : overallSeverity === 'watch'
        ? 'Watch'
        : 'Healthy'
  const statusHint = traf.thresholdBreached
    ? `Traffic Monitor below ${pct(traf.threshold ?? 0.85)} threshold`
    : 'No suites are below threshold'

  const tiles: Array<{
    labelNode: ReactNode
    value: string
    delta?: string | null
    severity?: Severity
    hint?: string
    isText?: boolean
  }> = [
    {
      labelNode: <DefinedTerm def={DEFINITIONS.status}>Status</DefinedTerm>,
      value: statusLabel,
      severity: overallSeverity,
      hint: statusHint,
      isText: true
    },
    {
      labelNode: (
        <span>
          <DefinedTerm def={DEFINITIONS.passRate}>Pass rate</DefinedTerm>
          {' · curated'}
        </span>
      ),
      value: pct(cap.passRate),
      delta: deltaPts(cap.passRate - prev.passRate),
      severity: 'ok',
      hint: `Across the last ${cap.totalCases} cases`
    },
    {
      labelNode: (
        <DefinedTerm def={DEFINITIONS.aggregateScore}>
          Aggregate score
        </DefinedTerm>
      ),
      value: cap.overallScore.toFixed(2),
      delta: deltaPts(cap.overallScore - prev.overallScore),
      severity: severityForScore(cap.overallScore, 0.85, 0.7),
      hint: '0–1 scale · higher is better'
    },
    {
      labelNode: <span>Cases scored · 48h</span>,
      value: String(cap.totalCases + traf.totalCases),
      severity: 'ok',
      hint: `${cap.totalCases} curated · ${traf.totalCases} live`
    }
  ]

  return (
    <section
      aria-label="Status overview"
      className="grid grid-cols-2 gap-y-6 lg:grid-cols-4 lg:divide-x lg:divide-border/60"
    >
      {tiles.map((t, i) => (
        <div
          key={i}
          className={[
            'flex flex-col gap-2',
            i === 0 ? 'lg:pr-8' : 'lg:px-8',
            i === tiles.length - 1 ? 'lg:pl-8 lg:pr-0' : ''
          ].join(' ')}
        >
          <span className="text-xs font-medium text-muted-foreground">
            {t.labelNode}
          </span>
          <div className="flex items-baseline gap-3">
            <span
              className={[
                t.isText
                  ? 'font-semibold tracking-tight text-3xl sm:text-4xl'
                  : 'font-mono font-semibold tabular-nums text-4xl sm:text-[2.75rem]',
                severityText(t.severity ?? 'ok')
              ].join(' ')}
            >
              {t.value}
            </span>
            {t.delta ? (
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {t.delta}
              </span>
            ) : null}
          </div>
          {t.hint ? (
            <span className="text-xs leading-snug text-muted-foreground">
              {t.hint}
            </span>
          ) : null}
        </div>
      ))}
    </section>
  )
}

// ---------- Score feature (Benchmarks — no card) -----------------------------

function ScoreFeature({
  label,
  cap,
  previous
}: {
  label: string
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  const score = Math.max(0, Math.min(1, cap.overallScore))
  const r = 80
  const C = 2 * Math.PI * r
  const offset = C * (1 - score)
  const delta = previous ? cap.overallScore - previous.overallScore : null
  const suiteKey = snapshotSuiteKey(cap)

  return (
    <section className="flex h-full flex-col gap-6">
      <div className="space-y-1">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold tracking-tight">
            <DefinedTerm def={DEFINITIONS.capability}>{label}</DefinedTerm>
          </h2>
          <span className="text-xs italic text-muted-foreground">
            on demand
          </span>
        </div>
        <p className="text-xs leading-snug text-muted-foreground">
          Curated test prompts · the model under controlled inputs.
        </p>
      </div>

      <Tooltip>
        <TooltipTrigger asChild>
          <div className="relative mx-auto flex h-56 w-56 cursor-help items-center justify-center transition-opacity hover:opacity-90">
            <svg
              className="h-full w-full -rotate-90"
              viewBox="0 0 200 200"
              aria-label={`${label} score: ${pct(score)}. Hover for per-judge breakdown.`}
              role="img"
            >
              <circle
                cx="100"
                cy="100"
                r={r}
                stroke="currentColor"
                strokeWidth="10"
                className="text-border"
                fill="none"
              />
              <circle
                cx="100"
                cy="100"
                r={r}
                style={{ stroke: 'var(--accent-blue)' }}
                strokeWidth="10"
                strokeDasharray={C}
                strokeDashoffset={offset}
                strokeLinecap="round"
                fill="none"
                className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono text-5xl font-semibold tabular-nums">
                {pct(score)}
              </span>
              <span className="mt-1 text-xs text-muted-foreground">
                aggregate
              </span>
            </div>
          </div>
        </TooltipTrigger>
        <TooltipPortal>
          <TooltipContent
            side="right"
            align="center"
            sideOffset={12}
            collisionPadding={16}
            className="max-w-xs space-y-2 text-xs leading-relaxed"
          >
            <AggregateBreakdown
              suiteLabel={label}
              suite={suiteKey}
              snap={cap}
              score={score}
            />
          </TooltipContent>
        </TooltipPortal>
      </Tooltip>

      <dl className="grid grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Pass rate</dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {pct(cap.passRate)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Change · 48h</dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {deltaPts(delta) ?? '—'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="text-xs text-muted-foreground">Cases</dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {cap.totalCases}
          </dd>
        </div>
      </dl>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="truncate">
          Experiment <span className="font-mono">{cap.experimentName}</span>
        </p>
        <p className="truncate">
          Dataset <span className="font-mono">{cap.datasetName}</span>
        </p>
      </div>
    </section>
  )
}

// ---------- Combined trend chart (all 3 suites overlaid) ---------------------

function CombinedTrend({
  capability,
  traffic,
  regression
}: {
  capability: EvalTrendPoint[]
  traffic: EvalTrendPoint[]
  regression: EvalTrendPoint[]
}) {
  const series = useMemo(() => {
    const byDate = new Map<
      string,
      { createdAt: string; cap?: number; traf?: number; reg?: number }
    >()
    for (const p of capability) {
      const k = p.createdAt.slice(0, 10)
      const row = byDate.get(k) ?? { createdAt: p.createdAt }
      row.cap = p.overallScore
      byDate.set(k, row)
    }
    for (const p of traffic) {
      const k = p.createdAt.slice(0, 10)
      const row = byDate.get(k) ?? { createdAt: p.createdAt }
      row.traf = p.overallScore
      byDate.set(k, row)
    }
    for (const p of regression) {
      const k = p.createdAt.slice(0, 10)
      const row = byDate.get(k) ?? { createdAt: p.createdAt }
      row.reg = p.overallScore
      byDate.set(k, row)
    }
    return Array.from(byDate.values()).sort((a, b) =>
      a.createdAt.localeCompare(b.createdAt)
    )
  }, [capability, traffic, regression])

  return (
    <section className="flex h-full flex-col gap-5 rounded-2xl border border-border/60 bg-background p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            <DefinedTerm def={DEFINITIONS.aggregateScore}>
              Aggregate score
            </DefinedTerm>{' '}
            · 14d
          </h2>
          <p className="text-xs leading-snug text-muted-foreground">
            One line per suite. Higher is better.
          </p>
        </div>
        <Legend
          items={[
            {
              label: 'Benchmarks — curated tests',
              color: 'var(--accent-blue)',
              def: DEFINITIONS.capability,
              solid: true
            },
            {
              label: 'Regression — pinned cases',
              color: 'var(--muted-foreground)',
              def: DEFINITIONS.regression,
              dashed: true
            },
            {
              label: 'Traffic — live users',
              color: 'var(--accent-amber)',
              def: DEFINITIONS.trafficMonitor,
              dotted: true
            }
          ]}
        />
      </div>
      <ChartContainer
        config={{
          cap: { label: 'Benchmarks', color: 'var(--accent-blue)' },
          reg: { label: 'Regression', color: 'var(--muted-foreground)' },
          traf: { label: 'Traffic', color: 'var(--accent-amber)' }
        }}
        className="h-[260px] w-full"
      >
        <AreaChart data={series}>
          <defs>
            <linearGradient id="capFillMixed" x1="0" x2="0" y1="0" y2="1">
              <stop
                offset="0%"
                stopColor="var(--accent-blue)"
                stopOpacity={0.18}
              />
              <stop
                offset="100%"
                stopColor="var(--accent-blue)"
                stopOpacity={0}
              />
            </linearGradient>
          </defs>
          <CartesianGrid
            vertical={false}
            stroke="var(--border)"
            strokeDasharray="2 4"
          />
          <XAxis
            dataKey="createdAt"
            tickFormatter={v => format(new Date(v), 'MMM d')}
            tickLine={false}
            axisLine={false}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <YAxis
            domain={[0.5, 1]}
            tickFormatter={v => `${Math.round(Number(v) * 100)}`}
            tickLine={false}
            axisLine={false}
            width={32}
            tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          />
          <ChartTooltip
            content={
              <ChartTooltipContent
                formatter={v => `${Math.round(Number(v) * 100)}%`}
                labelFormatter={v =>
                  format(new Date(String(v)), 'MMM d, h:mm a')
                }
              />
            }
          />
          <Area
            type="monotone"
            dataKey="cap"
            stroke="var(--accent-blue)"
            strokeWidth={2}
            fill="url(#capFillMixed)"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="reg"
            stroke="var(--muted-foreground)"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeDasharray="3 4"
            fill="none"
            connectNulls
          />
          <Area
            type="monotone"
            dataKey="traf"
            stroke="var(--accent-amber)"
            strokeWidth={1.5}
            strokeDasharray="1 4"
            fill="none"
            connectNulls
          />
        </AreaChart>
      </ChartContainer>
    </section>
  )
}

function Legend({
  items
}: {
  items: Array<{
    label: string
    color: string
    def?: string
    solid?: boolean
    dashed?: boolean
    dotted?: boolean
  }>
}) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
      {items.map(it => {
        const swatch = (
          <span
            aria-hidden
            className="inline-block h-px w-5"
            style={{
              borderTop: `${
                it.dotted
                  ? '1.5px dotted'
                  : it.dashed
                    ? '1.5px dashed'
                    : '2px solid'
              } ${it.color}`
            }}
          />
        )
        const labelEl = it.def ? (
          <DefinedTerm def={it.def}>{it.label}</DefinedTerm>
        ) : (
          <span>{it.label}</span>
        )
        return (
          <span key={it.label} className="inline-flex items-center gap-1.5">
            {swatch}
            {labelEl}
          </span>
        )
      })}
    </div>
  )
}

// ---------- Comparison table (no side stripes, alarm-only row tint) ----------

function ComparisonTable({
  cap,
  traf
}: {
  cap: EvalSummarySnapshot
  traf: EvalSummarySnapshot
}) {
  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Where curated and live diverge
          </h2>
          <p className="max-w-xl text-xs leading-snug text-muted-foreground">
            One row per judge. Bars show each judge&apos;s score for{' '}
            <DefinedTerm def={DEFINITIONS.capability}>
              curated test prompts
            </DefinedTerm>{' '}
            vs{' '}
            <DefinedTerm def={DEFINITIONS.trafficMonitor}>
              live user chats
            </DefinedTerm>
            . <DefinedTerm def={DEFINITIONS.delta}>Δ</DefinedTerm> flags judges
            where live underperforms curated by &gt;7 points.
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
        <div className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_64px] items-center gap-4 border-b border-border/60 px-5 py-3 text-xs font-medium text-muted-foreground">
          <span>Judge</span>
          <span>Curated prompts</span>
          <span>Live chats</span>
          <span className="text-right">Δ pts</span>
        </div>

        <ul className="divide-y divide-border/60">
          {EVALUATOR_DISPLAY_ORDER.map(key => {
            const c = cap.evaluatorScores[key]
            const t = traf.evaluatorScores[key]
            if (c == null || t == null) return null
            const delta = c - t
            const sev: Severity =
              delta >= 0.15 ? 'alarm' : delta >= 0.07 ? 'watch' : 'ok'

            return (
              <li
                key={key}
                className={[
                  'grid grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,1fr)_64px] items-center gap-4 px-5 py-3 text-sm transition-colors',
                  sev === 'alarm' ? 'bg-destructive/5' : 'hover:bg-muted/40'
                ].join(' ')}
              >
                <div className="flex items-center gap-2.5 truncate">
                  {sev === 'alarm' ? (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-destructive"
                    />
                  ) : sev === 'watch' ? (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-accent-amber"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="size-1.5 rounded-full bg-transparent"
                    />
                  )}
                  <span className="truncate">
                    <JudgeLabel judgeKey={key} />
                  </span>
                </div>
                <ScoreCell suite="capability" judgeKey={key} value={c}>
                  <Bar value={c} tone="primary" />
                </ScoreCell>
                <ScoreCell suite="trafficMonitor" judgeKey={key} value={t}>
                  <Bar value={t} tone="secondary" />
                </ScoreCell>
                <span
                  className={[
                    'text-right font-mono text-xs font-medium tabular-nums',
                    severityText(sev)
                  ].join(' ')}
                >
                  {deltaPts(-delta) ?? '·'}
                </span>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function Bar({
  value,
  tone
}: {
  value: number
  tone: 'primary' | 'secondary'
}) {
  return (
    <div className="flex items-center gap-3">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
        <div
          className={[
            'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700',
            tone === 'primary' ? 'bg-accent-blue' : 'bg-foreground/35'
          ].join(' ')}
          style={{ width: `${Math.max(0, Math.min(value, 1)) * 100}%` }}
        />
      </div>
      <span className="w-9 text-right font-mono text-xs tabular-nums text-muted-foreground">
        {pct(value)}
      </span>
    </div>
  )
}

// ---------- Activity list (chronological, all suites) ------------------------

function ActivityList({
  cap,
  reg,
  traf
}: {
  cap: EvalSummarySnapshot
  reg: EvalSummarySnapshot
  traf: EvalSummarySnapshot
}) {
  const rows = [
    {
      suite: 'Benchmarks',
      def: DEFINITIONS.capability,
      snap: cap,
      deltaPct: 3
    },
    {
      suite: 'Traffic Monitor',
      def: DEFINITIONS.trafficMonitor,
      snap: traf,
      deltaPct: -3
    },
    {
      suite: 'Regression',
      def: DEFINITIONS.regression,
      snap: reg,
      deltaPct: 0
    }
  ] as const

  const [expanded, setExpanded] = useState<string | null>(traf.id)

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Recent runs
          </h2>
          <p className="text-xs leading-snug text-muted-foreground">
            One row per eval run across all three suites. Click a row to expand
            its per-judge breakdown.
          </p>
        </div>
        <span className="text-xs italic text-muted-foreground">
          newest first
        </span>
      </div>
      <div className="overflow-hidden rounded-2xl border border-border/60 bg-background">
        <div className="hidden grid-cols-[140px_minmax(0,1fr)_96px_120px_72px_24px] gap-4 border-b border-border/60 bg-muted/20 px-5 py-2 text-xs font-medium text-muted-foreground sm:grid">
          <span>When</span>
          <span>Suite</span>
          <span className="text-right">Score</span>
          <span className="text-right">Pass rate</span>
          <span className="text-right">Δ pts</span>
          <span aria-hidden />
        </div>
        <ul className="divide-y divide-border/60">
          {rows.map(({ suite, def, snap, deltaPct }) => {
            const open = expanded === snap.id
            return (
              <li key={snap.id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : snap.id)}
                  className="grid w-full grid-cols-[140px_minmax(0,1fr)_96px_120px_72px_24px] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/40"
                  aria-expanded={open}
                >
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {format(new Date(snap.createdAt), 'MMM d · HH:mm')}
                  </span>
                  <span className="truncate text-sm">
                    <DefinedTerm def={def}>{suite}</DefinedTerm>
                  </span>
                  <span className="text-right font-mono text-sm font-semibold tabular-nums">
                    {pct(snap.overallScore)}
                  </span>
                  <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {pct(snap.passRate)}
                  </span>
                  <span
                    className={[
                      'text-right font-mono text-xs font-medium tabular-nums',
                      deltaPct < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    ].join(' ')}
                  >
                    {deltaPct === 0
                      ? '·'
                      : `${deltaPct > 0 ? '+' : ''}${deltaPct}`}
                  </span>
                  <span
                    aria-hidden
                    className={[
                      'inline-flex size-5 items-center justify-center text-muted-foreground transition-transform',
                      open ? 'rotate-90' : ''
                    ].join(' ')}
                  >
                    ›
                  </span>
                </button>
                {open ? <ExpandedRow snap={snap} /> : null}
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}

function snapshotSuiteKey(snap: EvalSummarySnapshot): SuiteKey {
  return snap.suite === 'traffic-monitor'
    ? 'trafficMonitor'
    : (snap.suite as SuiteKey)
}

function ExpandedRow({ snap }: { snap: EvalSummarySnapshot }) {
  const suiteKey = snapshotSuiteKey(snap)
  return (
    <div className="border-t border-border/60 bg-muted/20 px-5 py-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Per-judge scores · hover any row for the failure-mode breakdown
      </p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const v = snap.evaluatorScores[key]
          if (v == null) return null
          return (
            <ScoreCell key={key} suite={suiteKey} judgeKey={key} value={v}>
              <div className="flex items-center gap-3 text-xs hover:bg-background/60 -mx-2 px-2 py-1 rounded-md transition-colors">
                <span className="w-32 truncate text-muted-foreground">
                  {getEvaluatorLabel(key)}
                </span>
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-accent-blue/70"
                    style={{ width: `${v * 100}%` }}
                  />
                </div>
                <span className="w-9 text-right font-mono tabular-nums">
                  {pct(v)}
                </span>
              </div>
            </ScoreCell>
          )
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
        <span>
          Dataset <span className="font-mono">{snap.datasetName}</span>
        </span>
        <span>
          Cases <span className="font-mono">{snap.totalCases}</span>
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
    </div>
  )
}

// ---------- Demo footnote -----------------------------------------------------

function DemoFootnote() {
  return (
    <footer
      className="mt-4 flex items-start justify-between gap-6 border-t border-border/60 pt-6 text-xs text-muted-foreground motion-safe:animate-content-enter"
      style={enter(360)}
    >
      <p className="max-w-2xl leading-relaxed">
        Demo surface — mock data. Hover any underlined term for its definition.
        The sectioned alternative lives at{' '}
        <span className="font-mono">/admin/evals/demo</span>.
      </p>
      <span className="font-mono text-[11px] text-muted-foreground">
        v3.6 · tooltip-portal
      </span>
    </footer>
  )
}

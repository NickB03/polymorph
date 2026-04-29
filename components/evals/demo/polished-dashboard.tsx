'use client'

import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'

import { format, formatDistanceToNow } from 'date-fns'
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis
} from 'recharts'

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
        ? 'rehearsed-v4'
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
        citation_accuracy: 0.62, // alarm divergence vs capability
        tool_usage: 0.85,
        deterministic_prechecks: 0.96
      }
    }),
    previous: snap('traffic-monitor', {
      passRate: 0.84,
      overallScore: 0.82,
      createdAt: new Date(NOW - 50 * HOUR).toISOString()
    }),
    trend: trend(3),
    lastUpdated: new Date(NOW - 4 * HOUR).toISOString()
  },
  recentRuns: []
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

// ---------- Layout shell ------------------------------------------------------

export function PolishedEvalsDashboard() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col px-4 pb-20 pt-12 sm:px-8 lg:px-12">
        <div className="motion-safe:animate-content-enter" style={enter(0)}>
          <Header />
        </div>

        <div
          className="motion-safe:animate-content-enter mt-10"
          style={enter(60)}
        >
          <SystemHealthStrip data={MOCK} />
        </div>

        <SectionDivider />

        <div className="motion-safe:animate-content-enter" style={enter(140)}>
          <CapabilitySection data={MOCK} />
        </div>

        <SectionDivider />

        <div className="motion-safe:animate-content-enter" style={enter(220)}>
          <TrafficMonitorSection data={MOCK} />
        </div>

        <SectionDivider />

        <div className="motion-safe:animate-content-enter" style={enter(300)}>
          <RegressionSection data={MOCK} />
        </div>

        <DemoFootnote />
      </div>
    </div>
  )
}

function SectionDivider() {
  return (
    <div
      aria-hidden
      className="my-16 h-px w-full bg-gradient-to-r from-transparent via-border/70 to-transparent"
    />
  )
}

// ---------- Header ------------------------------------------------------------

function Header() {
  const lastSync = formatDistanceToNow(
    new Date(MOCK.trafficMonitor.lastUpdated!),
    { addSuffix: true }
  )

  return (
    <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          Polymorph · Admin
        </p>
        <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">
          Evals
        </h1>
        <p className="text-sm text-muted-foreground">
          Last sync {lastSync} · Three suites, three jobs.
        </p>
      </div>
      <ViewSwitcher />
    </header>
  )
}

function ViewSwitcher() {
  const [active, setActive] = useState<'health' | 'compare' | 'activity'>(
    'health'
  )
  const items = [
    { id: 'health' as const, label: 'Health' },
    { id: 'compare' as const, label: 'Compare' },
    { id: 'activity' as const, label: 'Activity' }
  ]
  return (
    <div
      role="radiogroup"
      aria-label="Evals layout"
      className="inline-flex items-center gap-1 rounded-full border border-border bg-background p-1 shadow-xs"
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

// ---------- System Health strip (suite-agnostic rollup) ----------------------

function SystemHealthStrip({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest!
  const prev = data.capability.previous!
  const traf = data.trafficMonitor.latest!

  const tiles: Array<{
    label: string
    value: string
    delta?: string | null
    severity?: Severity
    hint?: string
  }> = [
    {
      label: 'System health',
      value: pct(cap.passRate),
      severity: severityForScore(cap.passRate, 0.9, 0.8),
      delta: deltaPts(cap.passRate - prev.passRate),
      hint: 'rolled up across suites'
    },
    {
      label: 'Open alarms',
      value: traf.thresholdBreached ? '1' : '0',
      severity: traf.thresholdBreached ? 'alarm' : 'ok',
      hint: traf.thresholdBreached
        ? `traffic monitor below threshold`
        : 'within thresholds'
    },
    {
      label: 'Total samples · 48h',
      value: String(cap.totalCases + traf.totalCases),
      severity: 'ok',
      hint: `${cap.totalCases} cap · ${traf.totalCases} traffic`
    },
    {
      label: 'Last suite run',
      value: formatDistanceToNow(new Date(cap.createdAt)).replace('about ', ''),
      severity: 'ok',
      hint: 'capability'
    }
  ]

  return (
    <section
      aria-label="System health"
      className="grid grid-cols-2 gap-y-6 lg:grid-cols-4 lg:divide-x lg:divide-border/60"
    >
      {tiles.map((t, i) => (
        <div
          key={t.label}
          className={[
            'flex flex-col gap-2',
            i === 0 ? 'lg:pr-8' : 'lg:px-8',
            i === tiles.length - 1 ? 'lg:pl-8 lg:pr-0' : ''
          ].join(' ')}
        >
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            {t.label}
          </span>
          <div className="flex items-baseline gap-3">
            <span
              className={[
                'font-mono text-3xl font-semibold tabular-nums sm:text-4xl',
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
            <span className="text-xs text-muted-foreground">{t.hint}</span>
          ) : null}
        </div>
      ))}
    </section>
  )
}

// ---------- Section heading helper -------------------------------------------

function SectionHeading({
  number,
  title,
  subtitle,
  accentVar,
  badge
}: {
  number: string
  title: string
  subtitle: string
  accentVar: string
  badge?: { label: string; severity: Severity }
}) {
  return (
    <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="flex items-end gap-5">
        <div
          className="flex size-12 shrink-0 items-center justify-center rounded-full font-mono text-sm font-semibold tabular-nums"
          style={{
            color: `var(${accentVar})`,
            background: `color-mix(in oklch, var(${accentVar}) 10%, transparent)`,
            border: `1px solid color-mix(in oklch, var(${accentVar}) 25%, transparent)`
          }}
          aria-hidden
        >
          {number}
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
            {title}
          </h2>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>
      </div>
      {badge ? (
        <span
          className={[
            'inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1 font-mono text-[10px] uppercase tracking-[0.16em]',
            severityText(badge.severity)
          ].join(' ')}
        >
          <span
            aria-hidden
            className={[
              'size-1.5 rounded-full',
              badge.severity === 'alarm'
                ? 'bg-destructive'
                : badge.severity === 'watch'
                  ? 'bg-accent-amber'
                  : 'bg-foreground/40'
            ].join(' ')}
          />
          {badge.label}
        </span>
      ) : null}
    </div>
  )
}

// ---------- 01 · Capability section ------------------------------------------

function CapabilitySection({ data }: { data: EvalsDashboardData }) {
  const cap = data.capability.latest!
  const prev = data.capability.previous
  const sev = severityForScore(cap.overallScore, 0.85, 0.7)

  return (
    <section aria-label="Capability suite">
      <SectionHeading
        number="01"
        title="Capability"
        subtitle="Rehearsed fixtures · on-demand · the model's best self"
        accentVar="--accent-blue"
        badge={{ label: stateLabel(sev), severity: sev }}
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-4">
          <ScoreFeature
            cap={cap}
            previous={prev}
            accent="var(--accent-blue)"
            tone="primary"
          />
        </div>

        <div className="lg:col-span-8">
          <SuiteTrendChart
            trend={data.capability.trend}
            color="var(--accent-blue)"
            label="Capability"
          />
        </div>
      </div>

      <div className="mt-10">
        <EvaluatorRail
          scores={cap.evaluatorScores}
          accent="var(--accent-blue)"
        />
      </div>
    </section>
  )
}

// ---------- 02 · Traffic Monitor section -------------------------------------

function TrafficMonitorSection({ data }: { data: EvalsDashboardData }) {
  const traf = data.trafficMonitor.latest!
  const prev = data.trafficMonitor.previous
  const cap = data.capability.latest!

  // For traffic, severity is driven by threshold breach, not absolute score
  const sev: Severity = traf.thresholdBreached
    ? 'alarm'
    : severityForScore(traf.overallScore, 0.85, 0.75)

  // Top divergences vs Capability (this is where the divergence data lives now)
  const divergences = useMemo(() => {
    return EVALUATOR_DISPLAY_ORDER.map(key => {
      const c = cap.evaluatorScores[key]
      const t = traf.evaluatorScores[key]
      if (c == null || t == null) return null
      const delta = c - t
      return { key, capValue: c, trafValue: t, delta }
    })
      .filter((x): x is NonNullable<typeof x> => x != null)
      .sort((a, b) => b.delta - a.delta)
      .slice(0, 4)
  }, [cap.evaluatorScores, traf.evaluatorScores])

  return (
    <section aria-label="Traffic Monitor suite">
      <SectionHeading
        number="02"
        title="Traffic Monitor"
        subtitle="Real user chats · cron + manual · what's actually shipping"
        accentVar="--accent-amber"
        badge={{ label: stateLabel(sev), severity: sev }}
      />

      <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
        <div className="lg:col-span-8 space-y-10">
          <ThresholdGauge
            passRate={traf.passRate}
            threshold={traf.threshold ?? 0.85}
            previousPassRate={prev?.passRate ?? null}
            severity={sev}
          />

          <SuiteTrendChart
            trend={data.trafficMonitor.trend}
            color="var(--accent-amber)"
            label="Traffic"
            showThreshold={traf.threshold ?? 0.85}
          />
        </div>

        <div className="lg:col-span-4">
          <DivergencePanel divergences={divergences} />
        </div>
      </div>

      <div className="mt-10">
        <EvaluatorRail
          scores={traf.evaluatorScores}
          accent="var(--accent-amber)"
          highlightFailed={traf.failedEvaluators}
        />
      </div>
    </section>
  )
}

// ---------- 03 · Regression section (compact strip) --------------------------

function RegressionSection({ data }: { data: EvalsDashboardData }) {
  const reg = data.regression.latest!
  const prev = data.regression.previous
  const sev = severityForScore(reg.overallScore, 0.9, 0.75)
  const delta = prev ? reg.overallScore - prev.overallScore : null

  return (
    <section aria-label="Regression suite">
      <SectionHeading
        number="03"
        title="Regression"
        subtitle="Fixture exercises · guard against drift · silent unless it isn't"
        accentVar="--muted-foreground"
        badge={{ label: stateLabel(sev), severity: sev }}
      />

      <div className="grid grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2 lg:grid-cols-[260px_1fr_220px]">
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Pass rate
          </span>
          <div className="flex items-baseline gap-3">
            <span
              className={[
                'font-mono text-5xl font-semibold tabular-nums',
                severityText(sev)
              ].join(' ')}
            >
              {pct(reg.passRate)}
            </span>
            {delta != null ? (
              <span className="font-mono text-xs text-muted-foreground tabular-nums">
                {deltaPts(delta) ?? '·'}
              </span>
            ) : null}
          </div>
          <p className="text-xs text-muted-foreground">
            {reg.totalCases} fixture cases · last run{' '}
            {formatDistanceToNow(new Date(reg.createdAt), { addSuffix: true })}
          </p>
        </div>

        <div className="self-center">
          <Sparkline
            trend={data.regression.trend}
            color="var(--muted-foreground)"
          />
          <p className="mt-2 font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            10-day overall score
          </p>
        </div>

        <div className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between gap-3">
            <span className="font-mono uppercase tracking-[0.14em]">exp</span>
            <span className="truncate text-foreground">
              {reg.experimentName}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="font-mono uppercase tracking-[0.14em]">
              dataset
            </span>
            <span className="truncate text-foreground">{reg.datasetName}</span>
          </div>
          {reg.phoenixUrl ? (
            <a
              href={reg.phoenixUrl}
              rel="noreferrer"
              target="_blank"
              className="block text-right text-accent-blue underline-offset-4 hover:underline"
            >
              Phoenix →
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}

// ---------- Score feature (capability hero) ----------------------------------

function ScoreFeature({
  cap,
  previous,
  accent,
  tone
}: {
  cap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
  accent: string
  tone: 'primary' | 'amber'
}) {
  const score = Math.max(0, Math.min(1, cap.overallScore))
  const r = 80
  const C = 2 * Math.PI * r
  const offset = C * (1 - score)
  const delta = previous ? cap.overallScore - previous.overallScore : null
  void tone

  return (
    <div className="flex h-full flex-col gap-6">
      <div className="relative mx-auto flex h-56 w-56 items-center justify-center">
        <svg
          className="h-full w-full -rotate-90"
          viewBox="0 0 200 200"
          aria-label={`Capability overall score: ${pct(score)}`}
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
            style={{ stroke: accent }}
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
          <span className="mt-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            overall
          </span>
        </div>
      </div>

      <dl className="grid grid-cols-3 gap-4 text-xs">
        <div className="space-y-1">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Pass
          </dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {pct(cap.passRate)}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Δ 48h
          </dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {deltaPts(delta) ?? '—'}
          </dd>
        </div>
        <div className="space-y-1">
          <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Cases
          </dt>
          <dd className="font-mono text-sm font-medium tabular-nums">
            {cap.totalCases}
          </dd>
        </div>
      </dl>

      <div className="space-y-1 text-xs text-muted-foreground">
        <p className="truncate">
          <span className="font-mono uppercase tracking-[0.14em]">exp</span>{' '}
          {cap.experimentName}
        </p>
        <p className="truncate">
          <span className="font-mono uppercase tracking-[0.14em]">dataset</span>{' '}
          {cap.datasetName}
        </p>
        {cap.phoenixUrl ? (
          <a
            href={cap.phoenixUrl}
            rel="noreferrer"
            target="_blank"
            className="text-accent-blue underline-offset-4 hover:underline"
          >
            Phoenix →
          </a>
        ) : null}
      </div>
    </div>
  )
}

// ---------- Threshold gauge (traffic monitor hero) ---------------------------

function ThresholdGauge({
  passRate,
  threshold,
  previousPassRate,
  severity
}: {
  passRate: number
  threshold: number
  previousPassRate: number | null
  severity: Severity
}) {
  const delta = previousPassRate != null ? passRate - previousPassRate : null

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-6">
        <div className="space-y-2">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            Pass rate · vs threshold
          </span>
          <div className="flex items-baseline gap-3">
            <span
              className={[
                'font-mono text-6xl font-semibold tabular-nums leading-none',
                severityText(severity)
              ].join(' ')}
            >
              {pct(passRate)}
            </span>
            {delta != null ? (
              <span className="font-mono text-sm text-muted-foreground tabular-nums">
                {deltaPts(delta) ?? '·'}
              </span>
            ) : null}
          </div>
        </div>
        <div className="text-right text-xs text-muted-foreground">
          <p className="font-mono uppercase tracking-[0.14em]">Threshold</p>
          <p className="font-mono text-base text-foreground">
            {pct(threshold)}
          </p>
        </div>
      </div>

      <div className="relative">
        <div className="h-2 overflow-hidden rounded-full bg-muted/60">
          <div
            className={[
              'h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700',
              severity === 'alarm'
                ? 'bg-destructive'
                : severity === 'watch'
                  ? 'bg-accent-amber'
                  : 'bg-accent-amber'
            ].join(' ')}
            style={{ width: `${Math.max(0, Math.min(passRate, 1)) * 100}%` }}
          />
        </div>
        <div
          className="absolute -top-1 h-4 w-px bg-foreground/70"
          style={{ left: `${threshold * 100}%` }}
          aria-hidden
        />
        <div
          className="absolute -bottom-5 -translate-x-1/2 font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground"
          style={{ left: `${threshold * 100}%` }}
          aria-hidden
        >
          ↑ threshold
        </div>
      </div>
    </div>
  )
}

// ---------- Suite trend chart (per-suite, single series) ---------------------

function SuiteTrendChart({
  trend,
  color,
  label,
  showThreshold
}: {
  trend: EvalTrendPoint[]
  color: string
  label: string
  showThreshold?: number
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          {label} · 14d trend
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          overall score
        </span>
      </div>
      <ChartContainer
        config={{ overall: { label, color } }}
        className="h-[220px] w-full"
      >
        <AreaChart data={trend}>
          <defs>
            <linearGradient id={`fill-${label}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.16} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
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
            dataKey="overallScore"
            stroke={color}
            strokeWidth={2}
            fill={`url(#fill-${label})`}
            connectNulls
          />
        </AreaChart>
      </ChartContainer>
      {showThreshold != null ? (
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Threshold {pct(showThreshold)} — breached when line falls below.
        </p>
      ) : null}
    </div>
  )
}

// ---------- Sparkline (regression) -------------------------------------------

function Sparkline({
  trend,
  color
}: {
  trend: EvalTrendPoint[]
  color: string
}) {
  return (
    <ChartContainer
      config={{ overall: { label: 'score', color } }}
      className="h-12 w-full"
    >
      <LineChart data={trend}>
        <Line
          type="monotone"
          dataKey="overallScore"
          stroke={color}
          strokeWidth={1.75}
          dot={false}
          isAnimationActive={false}
        />
      </LineChart>
    </ChartContainer>
  )
}

// ---------- Evaluator rail (per-suite, horizontal bars) ----------------------

function EvaluatorRail({
  scores,
  accent,
  highlightFailed
}: {
  scores: Record<string, number | null>
  accent: string
  highlightFailed?: string[]
}) {
  const failed = new Set(highlightFailed ?? [])
  return (
    <div className="space-y-3">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
        Evaluators
      </span>
      <ul className="grid grid-cols-1 gap-x-10 gap-y-3 sm:grid-cols-2">
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const v = scores[key]
          if (v == null) return null
          const isFailed = failed.has(key)
          return (
            <li
              key={key}
              className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)_44px] items-center gap-3 text-sm"
            >
              <span
                className={[
                  'truncate',
                  isFailed ? 'text-destructive' : 'text-muted-foreground'
                ].join(' ')}
              >
                {getEvaluatorLabel(key)}
              </span>
              <div className="h-1 overflow-hidden rounded-full bg-muted/60">
                <div
                  className="h-full rounded-full motion-safe:transition-[width] motion-safe:duration-700"
                  style={{
                    width: `${Math.max(0, Math.min(v, 1)) * 100}%`,
                    background: isFailed ? 'var(--destructive)' : accent
                  }}
                />
              </div>
              <span
                className={[
                  'text-right font-mono text-xs tabular-nums',
                  isFailed ? 'text-destructive' : 'text-foreground'
                ].join(' ')}
              >
                {pct(v)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- Divergence panel (Traffic vs Capability) -------------------------

function DivergencePanel({
  divergences
}: {
  divergences: Array<{
    key: string
    capValue: number
    trafValue: number
    delta: number
  }>
}) {
  if (divergences.length === 0) {
    return (
      <div className="flex h-full flex-col gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          vs Capability
        </span>
        <p className="text-sm text-muted-foreground">
          Traffic Monitor matches Capability across all evaluators.
        </p>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col gap-3">
      <div className="flex items-baseline justify-between">
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
          vs Capability
        </span>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
          Δ pts
        </span>
      </div>
      <ul className="space-y-2.5">
        {divergences.map(d => {
          const sev: Severity =
            d.delta >= 0.15 ? 'alarm' : d.delta >= 0.07 ? 'watch' : 'ok'
          return (
            <li
              key={d.key}
              className={[
                'grid grid-cols-[1fr_auto] items-center gap-3 rounded-lg px-3 py-2.5 transition-colors',
                sev === 'alarm'
                  ? 'bg-destructive/5'
                  : sev === 'watch'
                    ? 'bg-accent-amber/5'
                    : 'hover:bg-muted/40'
              ].join(' ')}
            >
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm">{getEvaluatorLabel(d.key)}</p>
                <p className="font-mono text-[11px] tabular-nums text-muted-foreground">
                  cap {pct(d.capValue)} · traf {pct(d.trafValue)}
                </p>
              </div>
              <span
                className={[
                  'font-mono text-base font-semibold tabular-nums',
                  severityText(sev)
                ].join(' ')}
              >
                −{Math.round(d.delta * 100)}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

// ---------- Misc --------------------------------------------------------------

function stateLabel(s: Severity) {
  return s === 'ok' ? 'Healthy' : s === 'watch' ? 'Watch' : 'Alarm'
}

function DemoFootnote() {
  return (
    <footer
      className="mt-20 flex items-start justify-between gap-6 border-t border-border/60 pt-6 text-xs text-muted-foreground motion-safe:animate-content-enter"
      style={enter(380)}
    >
      <p className="max-w-2xl leading-relaxed">
        Demo surface — mock data, redesigned widgets. The original dashboard
        lives at <span className="font-mono">/admin/evals</span>. Each suite is
        its own zone now: Capability owns blue and the score ring; Traffic
        Monitor owns amber and a threshold gauge with divergences pulled inline;
        Regression is a quiet horizontal strip — louder only when it breaks.
      </p>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em]">
        v3.1 · sectioned
      </span>
    </footer>
  )
}

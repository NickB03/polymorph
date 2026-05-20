'use client'

import { useState } from 'react'

import { format } from 'date-fns'

import {
  caseResultsForEvaluator,
  failureModeCounts
} from '@/lib/evals/diagnostics'
import { formatAppModelSummary, getSuiteLabel } from '@/lib/evals/display'
import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import { snapshotSuiteKey } from '@/lib/evals/glossary'
import { buildTrendSeries } from '@/lib/evals/helpers/trend'
import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { Area, AreaChart } from '@/components/charts/area-chart'
import { Grid } from '@/components/charts/grid'
import { ChartTooltip } from '@/components/charts/tooltip'
import { XAxis } from '@/components/charts/x-axis'
import { ScoreBar } from '@/components/evals/dashboard/score-bar'
import { pct } from '@/components/evals/dashboard/shared'
import { ScoreCell } from '@/components/evals/glossary'

type Row = {
  id: string
  suite: string
  snap: EvalSummarySnapshot
  deltaPct: number
}

function buildRows(data: EvalsDashboardData): Row[] {
  // recentRuns arrives newest-first. Walk oldest→newest so each row's
  // delta is against the next-older same-suite snapshot we've seen.
  const previousBySuite = new Map<
    PersistedDashboardSuite,
    EvalSummarySnapshot
  >()
  const rows: Row[] = []

  for (let i = data.recentRuns.length - 1; i >= 0; i--) {
    const snap = data.recentRuns[i]
    const older = previousBySuite.get(snap.suite)
    rows.push({
      id: snap.id,
      suite: getSuiteLabel(snap.suite),
      snap,
      deltaPct: older
        ? Math.round((snap.overallScore - older.overallScore) * 100)
        : 0
    })
    previousBySuite.set(snap.suite, snap)
  }
  return rows.reverse()
}

export function ActivityList({ data }: { data: EvalsDashboardData }) {
  const rows = buildRows(data)
  const trendPoints = buildTrendSeries(data.recentRuns)
  const [expanded, setExpanded] = useState<string | null>(rows[0]?.id ?? null)

  if (rows.length === 0) return null

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1.5 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h2 className="text-base font-semibold tracking-tight">
            Recent runs
          </h2>
          <p className="text-xs leading-snug text-muted-foreground">
            Latest 10 eval runs across all three suites. Click a row to expand
            its per-judge breakdown and run metadata.
          </p>
        </div>
        <span className="text-xs italic text-muted-foreground">
          newest first
        </span>
      </div>
      {trendPoints.length > 1 ? (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            Score trend · last {trendPoints.length} runs
          </p>
          <AreaChart
            data={trendPoints as unknown as Record<string, unknown>[]}
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
            <Area
              dataKey="regression"
              fill="var(--success)"
              fillOpacity={0.35}
            />
            <XAxis />
            <ChartTooltip
              rows={point => {
                const p = point as {
                  createdAt: Date
                  capability: number | null
                  trafficMonitor: number | null
                  regression: number | null
                }
                const out: Array<{
                  color: string
                  label: string
                  value: string
                }> = []
                if (p.capability != null)
                  out.push({
                    color: 'var(--accent-blue)',
                    label: 'Capability',
                    value: `${p.capability}%`
                  })
                if (p.trafficMonitor != null)
                  out.push({
                    color: 'var(--warning)',
                    label: 'Traffic Monitor',
                    value: `${p.trafficMonitor}%`
                  })
                if (p.regression != null)
                  out.push({
                    color: 'var(--success)',
                    label: 'Regression',
                    value: `${p.regression}%`
                  })
                return out
              }}
            />
          </AreaChart>
        </div>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card">
        <div className="hidden grid-cols-[140px_minmax(0,1fr)_96px_120px_120px_72px_24px] gap-4 border-b border-border bg-muted/30 px-5 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground sm:grid">
          <span>When</span>
          <span>Suite</span>
          <span className="text-right">Score</span>
          <span className="text-right">Pass rate</span>
          <span className="text-right">App model</span>
          <span className="text-right">Δ pts</span>
          <span aria-hidden />
        </div>
        <ul className="divide-y divide-border">
          {rows.map(({ id, suite, snap, deltaPct }) => {
            const open = expanded === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : id)}
                  className="grid w-full grid-cols-[140px_minmax(0,1fr)_96px_120px_120px_72px_24px] items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  aria-expanded={open}
                >
                  <span className="font-mono text-xs text-muted-foreground tabular-nums">
                    {format(new Date(snap.createdAt), 'MMM d · HH:mm')}
                  </span>
                  <span className="truncate text-sm">{suite}</span>
                  <span className="text-right font-mono text-sm font-semibold tabular-nums">
                    {pct(snap.overallScore)}
                  </span>
                  <span className="text-right font-mono text-xs text-muted-foreground tabular-nums">
                    {pct(snap.passRate)}
                  </span>
                  <span className="truncate text-right text-xs text-muted-foreground">
                    {formatAppModelSummary(snap)}
                  </span>
                  <span
                    className={cn(
                      'text-right font-mono text-xs font-medium tabular-nums',
                      deltaPct < 0
                        ? 'text-destructive'
                        : 'text-muted-foreground'
                    )}
                  >
                    {deltaPct === 0
                      ? '·'
                      : `${deltaPct > 0 ? '+' : ''}${deltaPct}`}
                  </span>
                  <span
                    aria-hidden
                    className={cn(
                      'inline-flex size-5 items-center justify-center text-muted-foreground transition-transform',
                      open && 'rotate-90'
                    )}
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

function ExpandedRow({ snap }: { snap: EvalSummarySnapshot }) {
  const suiteKey = snapshotSuiteKey(snap)
  return (
    <div className="border-t border-border bg-muted/40 px-5 py-4">
      <p className="mb-3 text-xs font-medium text-muted-foreground">
        Per-judge scores · failure-mode signals
      </p>
      <div className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const v = snap.evaluatorScores[key]
          if (v == null) return null
          const observedFailureModes = failureModeCounts(
            caseResultsForEvaluator(snap, key)
          )
          return (
            <ScoreCell
              key={key}
              suite={suiteKey}
              judgeKey={key}
              value={v}
              caseCount={snap.totalCases}
              threshold={snap.threshold}
              failed={snap.failedEvaluators.includes(key)}
              observedFailureModes={observedFailureModes}
            >
              <span className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-xs transition-colors hover:bg-background/60">
                <span className="w-32 truncate text-muted-foreground">
                  {getEvaluatorLabel(key)}
                </span>
                <ScoreBar
                  failed={snap.failedEvaluators.includes(key)}
                  threshold={snap.threshold}
                  value={v}
                />
                <span className="w-9 text-right font-mono tabular-nums">
                  {pct(v)}
                </span>
              </span>
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
        <span>
          App model{' '}
          <span className="font-mono">{formatAppModelSummary(snap)}</span>
        </span>
        <span>
          Judge model{' '}
          <span className="font-mono">{snap.judgeModel ?? 'Unknown'}</span>
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

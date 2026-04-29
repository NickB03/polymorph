'use client'

import { useState } from 'react'

import { format } from 'date-fns'

import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import { DEFINITIONS, snapshotSuiteKey } from '@/lib/evals/glossary'
import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { DefinedTerm, ScoreCell } from '@/components/evals/glossary'

import { deltaPts, pct } from './shared'

type Row = {
  id: string
  suite: 'Benchmarks' | 'Traffic Monitor' | 'Regression'
  def: string
  snap: EvalSummarySnapshot
  deltaPct: number
}

function buildRows(data: EvalsDashboardData): Row[] {
  const rows: Row[] = []
  if (data.capability.latest) {
    const cap = data.capability.latest
    const prev = data.capability.previous
    rows.push({
      id: cap.id,
      suite: 'Benchmarks',
      def: DEFINITIONS.benchmarks,
      snap: cap,
      deltaPct: prev
        ? Math.round((cap.overallScore - prev.overallScore) * 100)
        : 0
    })
  }
  if (data.trafficMonitor.latest) {
    const traf = data.trafficMonitor.latest
    const prev = data.trafficMonitor.previous
    rows.push({
      id: traf.id,
      suite: 'Traffic Monitor',
      def: DEFINITIONS.trafficMonitor,
      snap: traf,
      deltaPct: prev
        ? Math.round((traf.overallScore - prev.overallScore) * 100)
        : 0
    })
  }
  if (data.regression.latest) {
    const reg = data.regression.latest
    const prev = data.regression.previous
    rows.push({
      id: reg.id,
      suite: 'Regression',
      def: DEFINITIONS.regression,
      snap: reg,
      deltaPct: prev
        ? Math.round((reg.overallScore - prev.overallScore) * 100)
        : 0
    })
  }
  rows.sort((a, b) => b.snap.createdAt.localeCompare(a.snap.createdAt))
  return rows
}

export function ActivityList({ data }: { data: EvalsDashboardData }) {
  const rows = buildRows(data)
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
          {rows.map(({ id, suite, def, snap, deltaPct }) => {
            const open = expanded === id
            return (
              <li key={id}>
                <button
                  type="button"
                  onClick={() => setExpanded(open ? null : id)}
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
              <span className="-mx-2 flex items-center gap-3 rounded-md px-2 py-1 text-xs transition-colors hover:bg-background/60">
                <span className="w-32 truncate text-muted-foreground">
                  {getEvaluatorLabel(key)}
                </span>
                <span className="block h-1 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <span
                    className="block h-full rounded-full bg-accent-blue/70"
                    style={{ width: `${v * 100}%` }}
                  />
                </span>
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

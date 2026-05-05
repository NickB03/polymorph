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

'use client'

import { ChartLine, Gauge, type LucideIcon, ShieldCheck } from 'lucide-react'

import { getSuiteDisplayByDashboardId } from '@/lib/evals/display'
import { getSuiteStatus, type SuiteStatus } from '@/lib/evals/helpers/status'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { Delta } from './delta'
import { ScoopCard, type ScoopTint } from './scoop-card'
import type { SuiteId } from './url-state'

const TAB_META: ReadonlyArray<{
  id: SuiteId
  Icon: LucideIcon
  eyebrow: string
}> = [
  { id: 'capability', Icon: ChartLine, eyebrow: 'CAPABILITY' },
  { id: 'trafficMonitor', Icon: Gauge, eyebrow: 'TRAFFIC MONITOR' },
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
            aria-label={copy.label}
            type="button"
            onClick={() => onChange(id)}
            className="rounded-2xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <ScoopCard
              tint={TINT_FOR[status]}
              size="lg"
              active={isActive}
              icon={<Icon aria-hidden className="size-10" strokeWidth={1.5} />}
            >
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {eyebrow}
                  </span>
                  {isAttention ? (
                    <span className="rounded-full bg-warning px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-warning-foreground">
                      ATTENTION
                    </span>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'font-mono text-5xl font-semibold leading-none tabular-nums',
                    status === 'BLOCKED' && 'text-destructive',
                    status === 'WATCH' && 'text-accent-amber'
                  )}
                >
                  {snap ? snap.overallScore.toFixed(2) : '—'}
                </div>
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  {snap == null ? (
                    <span>—</span>
                  ) : delta != null ? (
                    <>
                      <Delta value={delta} />
                      <span>pts · {snap.totalCases} cases</span>
                    </>
                  ) : (
                    <span>{snap.totalCases} cases</span>
                  )}
                </div>
              </div>
            </ScoopCard>
          </button>
        )
      })}
    </div>
  )
}

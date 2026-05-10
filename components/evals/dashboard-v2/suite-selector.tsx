'use client'

import { Gauge, ListChecks, type LucideIcon, ShieldCheck } from 'lucide-react'

import { getSuiteDisplayByDashboardId } from '@/lib/evals/display'
import {
  getSuiteStatus,
  STATUS_TOKENS,
  type SuiteStatus
} from '@/lib/evals/helpers/status'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { Delta } from './delta'
import type { SuiteId } from './url-state'

const TAB_META: ReadonlyArray<{
  id: SuiteId
  Icon: LucideIcon
}> = [
  { id: 'capability', Icon: ListChecks },
  { id: 'trafficMonitor', Icon: Gauge },
  { id: 'regression', Icon: ShieldCheck }
]

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
      {TAB_META.map(({ id, Icon }) => {
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
            data-testid="suite-card"
            role="tab"
            aria-selected={isActive}
            aria-label={copy.label}
            type="button"
            onClick={() => onChange(id)}
            className={cn(
              'relative h-[160px] overflow-hidden rounded-[14px] border-2 bg-card text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              isActive ? 'border-accent-blue' : 'border-border'
            )}
          >
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute -left-[90px] top-1/2 h-[200px] w-[200px] -translate-y-1/2 rounded-full',
                STATUS_TOKENS[status].scoopBg
              )}
            />
            <div className="relative z-[1] grid h-full grid-cols-[110px_1fr] items-center">
              <div className="flex flex-col items-center justify-center gap-3">
                {isAttention ? (
                  <span
                    className={cn(
                      'text-[13px] font-bold uppercase leading-none tracking-[0.08em]',
                      STATUS_TOKENS[status].fg
                    )}
                  >
                    ATTENTION
                  </span>
                ) : null}
                <Icon
                  aria-hidden
                  className={cn('size-14', STATUS_TOKENS[status].fg)}
                  strokeWidth={1.5}
                />
              </div>
              <div className="flex flex-col items-center justify-center gap-2 px-4">
                <span className="text-[18px] font-semibold leading-none tracking-tight text-muted-foreground">
                  {copy.label}
                </span>
                <span className="font-mono text-[44px] font-extrabold leading-none tracking-tight tabular-nums text-foreground">
                  {snap ? `${Math.round(snap.overallScore * 100)}%` : '—'}
                </span>
                <div className="flex items-center gap-1.5 text-[12px] leading-none">
                  {snap == null ? (
                    <span className="text-muted-foreground">—</span>
                  ) : (
                    <>
                      <span
                        aria-hidden
                        className={cn(
                          'inline-block size-1.5 rounded-full',
                          STATUS_TOKENS[status].dot
                        )}
                      />
                      <span
                        className={cn('font-medium', STATUS_TOKENS[status].fg)}
                      >
                        {STATUS_TOKENS[status].label}
                      </span>
                      {delta != null ? (
                        <>
                          <span className="text-muted-foreground">·</span>
                          <Delta value={delta} />
                        </>
                      ) : null}
                      <span className="text-muted-foreground">·</span>
                      <span className="text-muted-foreground tabular-nums">
                        {snap.totalCases} cases
                      </span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

import { type ReactNode } from 'react'

import { Activity, CircleCheckBig, Layers, type LucideIcon } from 'lucide-react'

import { getSuiteStatus, STATUS_TOKENS } from '@/lib/evals/helpers/status'
import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

import { Delta } from './delta'

type ItemTone = 'success' | 'warning' | 'info'

const BADGE_TINT: Record<ItemTone, string> = {
  success: 'border-success bg-success/15',
  warning: 'border-warning bg-warning/15',
  info: 'border-accent-blue bg-accent-blue/15'
}

export function KpiStrip({
  snap,
  previous
}: {
  snap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  const delta =
    previous == null ? null : snap.overallScore - previous.overallScore

  const suiteStatus = getSuiteStatus(snap, previous)
  const passColor =
    suiteStatus === 'READY' ? undefined : STATUS_TOKENS[suiteStatus].fg

  return (
    <div className="grid grid-cols-3 gap-3">
      <Item
        Icon={CircleCheckBig}
        tone="success"
        label="PASS"
        value={pct(snap.passRate)}
        valueClass={passColor}
      />
      <Item
        Icon={Activity}
        tone="warning"
        label="Δ 48H"
        value={<Delta value={delta} />}
      />
      <Item
        Icon={Layers}
        tone="info"
        label="CASES"
        value={String(snap.totalCases)}
      />
    </div>
  )
}

function Item({
  Icon,
  tone,
  label,
  value,
  valueClass
}: {
  Icon: LucideIcon
  tone: ItemTone
  label: string
  value: ReactNode
  valueClass?: string
}) {
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div
        className={cn(
          'flex size-14 items-center justify-center rounded-full border-2',
          BADGE_TINT[tone]
        )}
      >
        <Icon
          aria-hidden
          className="size-6 text-foreground"
          strokeWidth={2.25}
        />
      </div>
      <span className="text-sm font-bold uppercase tracking-wider text-foreground">
        {label}
      </span>
      <span
        className={cn(
          'text-base font-medium tabular-nums',
          valueClass ?? 'text-muted-foreground'
        )}
      >
        {value}
      </span>
    </div>
  )
}

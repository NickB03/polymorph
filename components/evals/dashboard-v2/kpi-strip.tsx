import { type ReactNode } from 'react'

import {
  CircleCheckBig,
  Layers,
  type LucideIcon,
  TrendingDown
} from 'lucide-react'

import type { EvalSummarySnapshot } from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { pct } from '@/components/evals/dashboard/shared'

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

  const deltaInfo = formatDelta(delta)

  return (
    <div className="grid grid-cols-3 gap-3">
      <Item
        Icon={CircleCheckBig}
        tone="success"
        label="PASS"
        value={pct(snap.passRate)}
        valueClass={snap.thresholdBreached ? 'text-destructive' : undefined}
      />
      <Item
        Icon={TrendingDown}
        tone="warning"
        label="Δ 48H"
        value={deltaInfo.text}
        valueClass={deltaInfo.color}
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

function formatDelta(value: number | null): { text: string; color: string } {
  if (value == null) return { text: '—', color: 'text-muted-foreground' }
  const r = Math.round(value * 100)
  if (r === 0) return { text: '0 pts', color: 'text-muted-foreground' }
  return {
    text: `${r > 0 ? '+' : ''}${r} pts`,
    color: r > 0 ? 'text-success' : 'text-destructive'
  }
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

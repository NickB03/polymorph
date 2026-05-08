import { type ReactNode } from 'react'

import { CircleCheckBig, Layers, TrendingDown } from 'lucide-react'

import type { EvalSummarySnapshot } from '@/lib/evals/types'

import { pct } from '@/components/evals/dashboard/shared'

import { Delta } from './delta'
import { ScoopCard, type ScoopTint } from './scoop-card'

export function KpiStrip({
  snap,
  previous
}: {
  snap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  const delta =
    previous == null ? null : snap.overallScore - previous.overallScore
  const deltaTint: ScoopTint =
    delta == null ? 'neutral' : delta < 0 ? 'blocked' : 'ready'

  return (
    <div className="grid grid-cols-3 gap-3">
      <ScoopCard
        size="sm"
        tint={snap.thresholdBreached ? 'blocked' : 'ready'}
        icon={<CircleCheckBig aria-hidden className="size-5" />}
      >
        <Tile label="PASS" value={pct(snap.passRate)} />
      </ScoopCard>

      <ScoopCard
        size="sm"
        tint={deltaTint}
        icon={<TrendingDown aria-hidden className="size-5" />}
      >
        <Tile label="Δ 48H" value={<Delta value={delta} />} />
      </ScoopCard>

      <ScoopCard
        size="sm"
        tint="neutral"
        icon={<Layers aria-hidden className="size-5" />}
      >
        <Tile label="CASES" value={String(snap.totalCases)} />
      </ScoopCard>
    </div>
  )
}

function Tile({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-lg font-semibold leading-tight tabular-nums">
        {value}
      </span>
    </div>
  )
}

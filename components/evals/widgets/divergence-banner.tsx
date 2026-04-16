import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { computeDivergences } from '@/lib/evals/helpers/divergences'

import { Card, CardContent } from '@/components/ui/card'

import { fmtDeltaPts } from './shared/format'
import type { WidgetProps } from './shared/widget-props'

type Config = {
  topN?: number
}

export function DivergenceBanner({ data, config }: WidgetProps<Config>) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  if (!cap || !traf) return null
  const divergences = computeDivergences(
    cap.evaluatorScores,
    traf.evaluatorScores
  )
  if (divergences.length === 0) return null
  const topN = config.topN ?? 3

  return (
    <Card className="border-rose-500/40 bg-rose-500/5">
      <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="font-semibold text-rose-600 dark:text-rose-400">
          ⚠ Divergence ({divergences.length})
        </span>
        {divergences.slice(0, topN).map(d => (
          <span key={d.evaluator} className="tabular-nums">
            <span className="text-muted-foreground">
              {getEvaluatorLabel(d.evaluator)}
            </span>{' '}
            <span
              className={
                d.severity === 'alarm'
                  ? 'font-semibold text-rose-600 dark:text-rose-400'
                  : 'font-medium text-amber-600 dark:text-amber-400'
              }
            >
              {fmtDeltaPts(-d.delta)}
            </span>
          </span>
        ))}
      </CardContent>
    </Card>
  )
}

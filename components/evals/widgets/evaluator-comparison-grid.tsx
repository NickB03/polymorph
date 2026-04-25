import { Rows3 } from 'lucide-react'

import {
  EVALUATOR_DISPLAY_ORDER,
  getEvaluatorColor,
  getEvaluatorLabel
} from '@/lib/evals/evaluator-labels'
import { computeDivergences } from '@/lib/evals/helpers/divergences'
import { stateColor } from '@/lib/evals/helpers/health-state'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

import { percent } from './shared/format'
import type { WidgetProps } from './shared/widget-props'

function fmtDeltaShort(n: number) {
  const rounded = Math.round(n * 100)
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : ''}${rounded}`
}

export function EvaluatorComparisonGrid({ data }: WidgetProps) {
  const cap = data.capability.latest
  const traf = data.trafficMonitor.latest
  if (!cap || !traf) {
    const missing =
      !cap && !traf ? 'Neither' : !cap ? 'Capability' : 'Traffic Monitor'
    return (
      <Card className="flex h-full flex-col border-dashed bg-muted/10">
        <CardHeader>
          <CardTitle className="text-base">Evaluator comparison</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-1 flex-col items-center justify-center gap-4 py-10 text-center">
          <div className="rounded-full border border-dashed border-muted-foreground/30 p-3 text-muted-foreground">
            <Rows3 aria-hidden className="h-5 w-5" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Comparison unavailable</p>
            <p className="max-w-sm text-xs text-muted-foreground">
              {missing === 'Neither'
                ? 'Neither suite has run yet. Both are required to compute divergences.'
                : `${missing} has no runs yet. Both suites are required to compute divergences.`}
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }
  const divergences = computeDivergences(
    cap.evaluatorScores,
    traf.evaluatorScores
  )

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Evaluator comparison</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_60px] gap-4 border-b pb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          <span>Evaluator</span>
          <span>Capability</span>
          <span>Traffic Monitor</span>
          <span className="text-right">Δ</span>
        </div>
        {EVALUATOR_DISPLAY_ORDER.map(key => {
          const capValue = cap.evaluatorScores[key]
          const trafValue = traf.evaluatorScores[key]
          if (capValue == null || trafValue == null) return null
          const delta = capValue - trafValue
          const div = divergences.find(d => d.evaluator === key)
          const rowAccent =
            div?.severity === 'alarm'
              ? 'border-l-4 border-rose-500 pl-3'
              : div?.severity === 'warn'
                ? 'border-l-4 border-amber-500 pl-3'
                : 'pl-4'
          return (
            <div
              key={key}
              className={`grid grid-cols-[180px_minmax(0,1fr)_minmax(0,1fr)_60px] items-center gap-4 text-sm ${rowAccent}`}
            >
              <span className="truncate text-muted-foreground">
                {getEvaluatorLabel(key)}
              </span>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${capValue * 100}%`,
                      backgroundColor: getEvaluatorColor(key)
                    }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums">
                  {percent(capValue)}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full opacity-80"
                    style={{
                      width: `${trafValue * 100}%`,
                      backgroundColor: getEvaluatorColor(key)
                    }}
                  />
                </div>
                <span className="w-10 text-right text-xs tabular-nums">
                  {percent(trafValue)}
                </span>
              </div>
              <span
                className={`text-right text-xs font-medium tabular-nums ${
                  div?.severity === 'alarm'
                    ? stateColor('critical')
                    : div?.severity === 'warn'
                      ? stateColor('warning')
                      : 'text-muted-foreground'
                }`}
              >
                {fmtDeltaShort(-delta)}
              </span>
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}

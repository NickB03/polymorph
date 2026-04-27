'use client'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import {
  healthForScore,
  stateBg,
  stateColor
} from '@/lib/evals/helpers/health-state'

import type { WidgetProps } from './shared/widget-props'

type Config = {
  suite: 'capability' | 'regression' | 'trafficMonitor'
}

export function EvaluatorChipGrid({ data, config }: WidgetProps<Config>) {
  const latest = data[config.suite].latest
  if (!latest) return null
  return (
    <div className="flex flex-wrap gap-2">
      {Object.entries(latest.evaluatorScores)
        .filter((entry): entry is [string, number] => entry[1] != null)
        .map(([key, value]) => {
          const state = healthForScore(value, 0.85, 0.7)
          return (
            <button
              key={key}
              type="button"
              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition hover:bg-muted/60 ${stateBg(state)}`}
            >
              <span className={stateColor(state)}>●</span>
              <span>{getEvaluatorLabel(key)}</span>
              <span className="tabular-nums text-muted-foreground">
                {Math.round(value * 100)}%
              </span>
            </button>
          )
        })}
    </div>
  )
}

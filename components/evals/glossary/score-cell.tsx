'use client'

import type { ReactNode } from 'react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import { getScoreInsight, type SuiteKey } from '@/lib/evals/glossary'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

export function ScoreCell({
  suite,
  judgeKey,
  value,
  children
}: {
  suite: SuiteKey
  judgeKey: string
  value: number
  children: ReactNode
}) {
  const insight = getScoreInsight(suite, judgeKey)
  const failureModes = insight?.failureModes?.filter(m => m.count > 0) ?? []
  if (!insight || (insight.total === 0 && failureModes.length === 0)) {
    return <>{children}</>
  }

  const judgeLabel = getEvaluatorLabel(judgeKey)
  const pctValue = Math.round(value * 100)

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex w-full cursor-help">{children}</span>
      </TooltipTrigger>
      <TooltipContent
        side="top"
        align="end"
        sideOffset={6}
        collisionPadding={16}
        className="max-w-sm space-y-2 text-xs leading-relaxed"
      >
        <div className="flex items-baseline justify-between gap-3">
          <span className="font-semibold text-foreground">
            {judgeLabel} · {pctValue}%
          </span>
          {insight.total > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {insight.passed}/{insight.total} passed
            </span>
          ) : null}
        </div>
        {failureModes.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">Top failure modes</p>
            <ul className="space-y-1">
              {failureModes.map(mode => (
                <li
                  key={mode.description}
                  className="grid grid-cols-[20px_1fr] gap-2"
                >
                  <span className="font-mono font-medium tabular-nums text-foreground">
                    {mode.count}
                  </span>
                  <span className="text-muted-foreground">
                    {mode.description}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {insight.note ? (
          <p className="italic text-muted-foreground">{insight.note}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

'use client'

import type { ReactNode } from 'react'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import {
  getJudgeDefinition,
  getScoreInsight,
  type SuiteKey
} from '@/lib/evals/glossary'

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip'

import {
  clampScore,
  getScoreStatus,
  getScoreStatusLabel
} from '@/components/evals/dashboard/score-bar'

export function ScoreCell({
  suite,
  judgeKey,
  value,
  caseCount,
  threshold,
  failed,
  observedFailureModes,
  onActivate,
  selected,
  children
}: {
  suite: SuiteKey
  judgeKey: string
  value: number
  caseCount?: number
  threshold?: number | null
  failed?: boolean
  observedFailureModes?: Array<{ count: number; description: string }>
  onActivate?: () => void
  selected?: boolean
  children: ReactNode
}) {
  const insight = getScoreInsight(suite, judgeKey)
  const definition = getJudgeDefinition(judgeKey)
  const failureModes =
    observedFailureModes && observedFailureModes.length > 0
      ? observedFailureModes
      : (insight?.failureModes?.filter(m => m.count > 0) ?? [])
  const modeGuidance = insight?.failureModes ?? []
  if (!insight && !definition) {
    return <>{children}</>
  }

  const judgeLabel = getEvaluatorLabel(judgeKey)
  const clampedValue = clampScore(value)
  const pctValue = Math.round(clampedValue * 100)
  const effectiveThreshold = threshold ?? insight?.threshold ?? null
  const status = getScoreStatus({
    value: clampedValue,
    threshold: effectiveThreshold,
    failed
  })
  const statusLabel = getScoreStatusLabel(status)
  const thresholdPct =
    effectiveThreshold == null
      ? null
      : Math.round(clampScore(effectiveThreshold) * 100)
  const ariaValueText = [
    `${judgeLabel} score ${pctValue}%`,
    statusLabel.toLowerCase(),
    thresholdPct != null ? `${thresholdPct}% threshold` : null,
    caseCount != null ? `${caseCount} cases` : null
  ]
    .filter(Boolean)
    .join(', ')

  const thresholdSentence =
    thresholdPct == null ? '' : ` Run threshold is ${thresholdPct}%.`

  const breachSentence =
    failed == null
      ? ''
      : ` This judge ${failed ? 'appears' : 'does not appear'} in the run's threshold-breach list.`

  const triggerClassName =
    'block w-full cursor-help rounded-md focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background focus-visible:outline-none'

  const trigger = onActivate ? (
    <button
      type="button"
      aria-label={`${ariaValueText}. Open diagnostic details.`}
      aria-pressed={selected}
      onClick={onActivate}
      className={`${triggerClassName} appearance-none border-0 bg-transparent p-0 text-left font-[inherit] text-inherit`}
    >
      {children}
    </button>
  ) : (
    <span
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={pctValue}
      aria-valuetext={ariaValueText}
      className={triggerClassName}
      role="meter"
      tabIndex={0}
    >
      {children}
    </span>
  )

  return (
    <Tooltip>
      <TooltipTrigger asChild>{trigger}</TooltipTrigger>
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
          {caseCount != null ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {caseCount} cases
            </span>
          ) : insight && insight.total > 0 ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
              {insight.passed}/{insight.total} passed
            </span>
          ) : null}
        </div>
        {definition ? (
          <p className="text-muted-foreground">{definition}</p>
        ) : null}
        <p className="text-muted-foreground">
          Score shown is the mean of this judge&apos;s recorded outputs for the
          run.{thresholdSentence}
        </p>
        <p className="text-muted-foreground">
          Threshold status: {statusLabel}.{breachSentence}
        </p>
        {failureModes.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">Observed failure modes</p>
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
        ) : modeGuidance.length > 0 ? (
          <div className="space-y-1.5">
            <p className="text-muted-foreground">What lowers this score</p>
            <ul className="space-y-1">
              {modeGuidance.map(mode => (
                <li key={mode.description} className="text-muted-foreground">
                  {mode.description}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
        {insight?.note ? (
          <p className="italic text-muted-foreground">{insight.note}</p>
        ) : null}
      </TooltipContent>
    </Tooltip>
  )
}

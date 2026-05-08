'use client'

import { type ReactNode, useMemo, useState } from 'react'

import {
  caseResultsForEvaluator,
  failedCaseResultsForEvaluator,
  FAILURE_MODE_LABELS,
  failureKey,
  failureModeCounts,
  scoreAscending
} from '@/lib/evals/diagnostics'
import { formatAppModelSummary } from '@/lib/evals/display'
import { EVALUATOR_DISPLAY_ORDER } from '@/lib/evals/evaluator-labels'
import { snapshotSuiteKey } from '@/lib/evals/glossary'
import { getSuiteStatus, type SuiteStatus } from '@/lib/evals/helpers/status'
import type {
  EvalCaseResultSnapshot,
  EvalSummarySnapshot
} from '@/lib/evals/types'
import { cn } from '@/lib/utils'

import { ScoreBar } from '@/components/evals/dashboard/score-bar'
import { deltaPts, pct } from '@/components/evals/dashboard/shared'
import { ScoreCell } from '@/components/evals/glossary'

import { AutoBadge } from './auto-badge'
import { localLabel } from './local-labels'

const DETERMINISTIC_KEYS = new Set(['deterministic_prechecks', 'tool_usage'])
type EvaluatorName = (typeof EVALUATOR_DISPLAY_ORDER)[number]

export function EvaluatorBreakdown({
  snap,
  previous
}: {
  snap: EvalSummarySnapshot
  previous?: EvalSummarySnapshot | null
}) {
  const failed = new Set(snap.failedEvaluators)
  const suiteKey = snapshotSuiteKey(snap)
  const evaluators = EVALUATOR_DISPLAY_ORDER.filter(
    key => snap.evaluatorScores[key] != null
  )
  const defaultEvaluator =
    evaluators.find(key => failed.has(key)) ?? evaluators[0] ?? null
  const [selectedEvaluator, setSelectedEvaluator] = useState<{
    evaluatorName: EvaluatorName
    snapId: string
  } | null>(null)
  const selectedKey =
    selectedEvaluator?.snapId === snap.id &&
    evaluators.includes(selectedEvaluator.evaluatorName)
      ? selectedEvaluator.evaluatorName
      : defaultEvaluator

  const overview = useMemo(
    () => buildDiagnosticOverview(snap, previous ?? null),
    [snap, previous]
  )

  return (
    <section className="flex h-full flex-col gap-5 rounded-2xl border border-border/60 bg-background p-6">
      <div className="space-y-1">
        <h3 className="text-base font-semibold tracking-tight">
          Evaluator breakdown
        </h3>
        <p className="text-xs leading-snug text-muted-foreground">
          One row per evaluator. Rows tagged <AutoBadge /> are deterministic
          rules that gate eligibility — the rest are LLM judges. Hover any row
          for the judge’s definition and threshold status.
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-x-8 gap-y-1 sm:grid-cols-2">
        {evaluators.map(key => {
          const v = snap.evaluatorScores[key]
          if (v == null) return null
          const isAuto = DETERMINISTIC_KEYS.has(key)
          const isFailed = failed.has(key)
          const observedFailureModes = failureModeCounts(
            caseResultsForEvaluator(snap, key)
          )
          const selected = key === selectedKey
          return (
            <li key={key}>
              <ScoreCell
                suite={suiteKey}
                judgeKey={key}
                value={v}
                caseCount={snap.totalCases}
                threshold={snap.threshold}
                failed={isFailed}
                observedFailureModes={observedFailureModes}
                onActivate={() =>
                  setSelectedEvaluator({ evaluatorName: key, snapId: snap.id })
                }
                selected={selected}
              >
                <span className="-mx-2 grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_44px] items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-muted/40">
                  <span className="flex min-w-0 items-center gap-2">
                    <span
                      className={cn(
                        'truncate',
                        isFailed ? 'text-destructive' : 'text-foreground',
                        selected && 'font-medium'
                      )}
                    >
                      {localLabel(key)}
                    </span>
                    {isAuto ? <AutoBadge /> : null}
                  </span>
                  <ScoreBar
                    failed={isFailed}
                    threshold={snap.threshold}
                    value={v}
                  />
                  <span
                    className={cn(
                      'text-right font-mono text-xs tabular-nums',
                      isFailed ? 'text-destructive' : 'text-foreground'
                    )}
                  >
                    {pct(v)}
                  </span>
                </span>
              </ScoreCell>
            </li>
          )
        })}
      </ul>

      <DiagnosticsOverview snap={snap} overview={overview} />

      {selectedKey ? (
        <EvaluatorDiagnosticPanel
          evaluatorName={selectedKey}
          snap={snap}
          previous={previous ?? null}
        />
      ) : null}

      <div className="mt-2 flex flex-wrap gap-x-6 gap-y-1 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span>
          Experiment <span className="font-mono">{snap.experimentName}</span>
        </span>
        <span>
          Dataset <span className="font-mono">{snap.datasetName}</span>
        </span>
        {snap.phoenixUrl ? (
          <a
            href={snap.phoenixUrl}
            rel="noreferrer"
            target="_blank"
            className="ml-auto text-accent-blue underline-offset-4 hover:underline"
          >
            Inspect in Phoenix →
          </a>
        ) : null}
      </div>
    </section>
  )
}

type DiagnosticStatus = SuiteStatus

interface DiagnosticOverview {
  status: DiagnosticStatus
  reason: string
  newFailures: number
  fixedFailures: number
  stillFailing: number
  largestDrop: {
    evaluatorName: string
    delta: number
  } | null
  worstFailures: EvalCaseResultSnapshot[]
}

function buildDiagnosticOverview(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
): DiagnosticOverview {
  const currentFailures = new Set(
    (snap.caseResults ?? []).filter(result => result.failed).map(failureKey)
  )
  const previousFailures = new Set(
    (previous?.caseResults ?? [])
      .filter(result => result.failed)
      .map(failureKey)
  )
  const newFailures = [...currentFailures].filter(
    key => !previousFailures.has(key)
  ).length
  const fixedFailures = [...previousFailures].filter(
    key => !currentFailures.has(key)
  ).length
  const stillFailing = [...currentFailures].filter(key =>
    previousFailures.has(key)
  ).length
  const largestDrop = getLargestEvaluatorDrop(snap, previous)
  const worstFailures = (snap.caseResults ?? [])
    .filter(result => result.failed)
    .sort(scoreAscending)
    .slice(0, 3)

  const status = getSuiteStatus(snap, previous)
  const reason =
    status === 'BLOCKED'
      ? 'Threshold breached'
      : status === 'WATCH'
        ? newFailures > 0
          ? 'New failures found'
          : snap.failedCases > 0
            ? 'Failures below block threshold'
            : 'Score dropped'
        : 'No blocking failures'

  return {
    status,
    reason,
    newFailures,
    fixedFailures,
    stillFailing,
    largestDrop,
    worstFailures
  }
}

function getLargestEvaluatorDrop(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
) {
  if (!previous) return null

  let largest: { evaluatorName: string; delta: number } | null = null
  for (const [evaluatorName, currentScore] of Object.entries(
    snap.evaluatorScores
  )) {
    const previousScore = previous.evaluatorScores[evaluatorName]
    if (currentScore == null || previousScore == null) continue
    const delta = currentScore - previousScore
    if (!largest || delta < largest.delta) {
      largest = { evaluatorName, delta }
    }
  }
  return largest
}

function DiagnosticsOverview({
  snap,
  overview
}: {
  snap: EvalSummarySnapshot
  overview: DiagnosticOverview
}) {
  const statusCopy = getDiagnosticStatusCopy(snap, overview)
  const statusClass =
    overview.status === 'BLOCKED'
      ? 'text-destructive'
      : overview.status === 'WATCH'
        ? 'text-accent-amber'
        : 'text-success'

  return (
    <div className="grid grid-cols-1 gap-3 border-t border-border/60 pt-4 xl:grid-cols-2">
      <PanelBlock title={statusCopy.title}>
        <div className="flex items-baseline justify-between gap-3">
          <span className={cn('font-mono text-lg font-semibold', statusClass)}>
            {statusCopy.status}
          </span>
          <span className="text-right text-xs text-muted-foreground">
            {statusCopy.reason}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {statusCopy.caseLabel}:{' '}
          <span className="font-mono text-foreground">{snap.failedCases}</span>
        </p>
      </PanelBlock>

      <PanelBlock title="What changed">
        <dl className="grid grid-cols-2 gap-3 text-xs sm:grid-cols-4">
          <Metric label="New" value={overview.newFailures} />
          <Metric label="Fixed" value={overview.fixedFailures} />
          <Metric label="Still" value={overview.stillFailing} />
          <Metric
            label="Largest drop"
            value={
              overview.largestDrop
                ? deltaPts(overview.largestDrop.delta)
                : 'Unknown'
            }
          />
        </dl>
        {overview.largestDrop ? (
          <p className="mt-2 truncate text-xs text-muted-foreground">
            {localLabel(overview.largestDrop.evaluatorName)}
          </p>
        ) : null}
      </PanelBlock>

      <PanelBlock title="Worst failing cases">
        {overview.worstFailures.length > 0 ? (
          <ul className="space-y-2">
            {overview.worstFailures.map(result => (
              <li
                key={`${result.caseId}-${result.evaluatorName}`}
                className="grid grid-cols-[minmax(0,1fr)_72px_44px_52px] gap-2 text-xs"
              >
                <span className="min-w-0 truncate font-mono">
                  {result.caseId}
                </span>
                <span className="truncate text-muted-foreground">
                  {FAILURE_MODE_LABELS[result.failureMode]}
                </span>
                <span className="text-right font-mono tabular-nums">
                  {result.score == null ? 'err' : pct(result.score)}
                </span>
                {result.phoenixUrl ? (
                  <a
                    href={result.phoenixUrl}
                    rel="noreferrer"
                    target="_blank"
                    className="text-right text-accent-blue underline-offset-4 hover:underline"
                  >
                    Phoenix
                  </a>
                ) : (
                  <span className="text-right text-muted-foreground">—</span>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">
            No failed case rows are available for this run.
          </p>
        )}
      </PanelBlock>

      <PanelBlock title="Run metadata">
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
          <Metadata label="App model" value={formatAppModelSummary(snap)} />
          <Metadata label="Judge" value={snap.judgeModel ?? 'Unknown'} />
          <Metadata label="Provider" value={snap.judgeProvider ?? 'Unknown'} />
          <Metadata
            label="Judge temp"
            value={formatJudgeSetting(snap.judgeSettings, 'temperature')}
          />
          <Metadata
            label="Template"
            value={snap.evaluatorTemplateVersion ?? 'Unknown'}
          />
          <Metadata label="Corpus" value={snap.corpusVersion ?? 'Unknown'} />
          <Metadata label="Dataset" value={snap.datasetVersion ?? 'Unknown'} />
          <Metadata label="App SHA" value={snap.appGitSha ?? 'Unknown'} />
          <Metadata label="Sample" value={formatSampleWindow(snap)} />
        </dl>
      </PanelBlock>
    </div>
  )
}

function getDiagnosticStatusCopy(
  snap: EvalSummarySnapshot,
  overview: DiagnosticOverview
) {
  if (snapshotSuiteKey(snap) === 'trafficMonitor') {
    return {
      title: 'Production status',
      status:
        overview.status === 'BLOCKED'
          ? 'ALERT'
          : overview.status === 'READY'
            ? 'HEALTHY'
            : 'WATCH',
      reason:
        overview.status === 'READY' ? 'No live breaches' : overview.reason,
      caseLabel: 'Flagged cases'
    }
  }

  return {
    title: 'Release status',
    status: overview.status,
    reason: overview.reason,
    caseLabel: 'Blocking cases'
  }
}

function EvaluatorDiagnosticPanel({
  evaluatorName,
  snap,
  previous
}: {
  evaluatorName: string
  snap: EvalSummarySnapshot
  previous: EvalSummarySnapshot | null
}) {
  const currentScore = snap.evaluatorScores[evaluatorName] ?? null
  const previousScore = previous?.evaluatorScores[evaluatorName] ?? null
  const delta =
    currentScore == null || previousScore == null
      ? null
      : currentScore - previousScore
  const failedCases = failedCaseResultsForEvaluator(snap, evaluatorName)
    .sort(scoreAscending)
    .slice(0, 2)
  const modes = failureModeCounts(caseResultsForEvaluator(snap, evaluatorName))

  return (
    <div className="rounded-lg border border-border/60 bg-muted/15 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
        <h4 className="text-sm font-semibold tracking-tight">
          {localLabel(evaluatorName)} diagnostics
        </h4>
        <span className="font-mono text-xs text-muted-foreground">
          Delta vs previous: {delta == null ? 'Unknown' : deltaPts(delta)}
        </span>
      </div>

      <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Why this score changed
          </p>
          {modes.length > 0 ? (
            <ul className="space-y-1.5">
              {modes.slice(0, 4).map(mode => (
                <li
                  key={mode.mode}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <span className="truncate">{mode.description}</span>
                  <span className="font-mono text-muted-foreground">
                    {mode.count}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No observed failure modes were recorded, so the hover glossary is
              the fallback.
            </p>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground">
            Failed examples
          </p>
          {failedCases.length > 0 ? (
            <ul className="space-y-3">
              {failedCases.map(result => (
                <li
                  key={`${result.caseId}-${result.evaluatorName}`}
                  className="rounded-md border border-border/50 bg-background/60 p-3"
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                    <span className="font-mono">{result.caseId}</span>
                    <span className="text-muted-foreground">
                      {FAILURE_MODE_LABELS[result.failureMode]}
                    </span>
                    <span className="font-mono text-muted-foreground">
                      {result.score == null ? 'error' : pct(result.score)}
                    </span>
                    {result.phoenixUrl ? (
                      <a
                        href={result.phoenixUrl}
                        rel="noreferrer"
                        target="_blank"
                        className="ml-auto text-accent-blue underline-offset-4 hover:underline"
                      >
                        Phoenix →
                      </a>
                    ) : null}
                  </div>
                  {result.error ? (
                    <p className="mt-2 text-xs text-destructive">
                      {result.error}
                    </p>
                  ) : result.explanation ? (
                    <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">
                      {result.explanation}
                    </p>
                  ) : (
                    <p className="mt-2 text-xs text-muted-foreground">
                      No judge reasoning was recorded for this case.
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
                    <span>Label {result.label ?? 'Unknown'}</span>
                    <span>App model {result.appModelId ?? 'Unknown'}</span>
                    <span>Trace {result.otelTraceId ?? 'Unknown'}</span>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-muted-foreground">
              No failed examples were recorded for this evaluator.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

function PanelBlock({
  title,
  children
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="rounded-lg border border-border/50 bg-muted/15 p-3">
      <h4 className="mb-2 text-xs font-medium text-muted-foreground">
        {title}
      </h4>
      {children}
    </div>
  )
}

function Metric({
  label,
  value
}: {
  label: string
  value: number | string | null
}) {
  return (
    <div className="space-y-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="font-mono text-sm tabular-nums text-foreground">
        {value ?? 'Unknown'}
      </dd>
    </div>
  )
}

function Metadata({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="truncate font-mono text-[11px] text-foreground">
        {value || 'Unknown'}
      </dd>
    </div>
  )
}

function formatJudgeSetting(
  settings: Record<string, unknown> | undefined,
  key: string
) {
  const value = settings?.[key]
  if (value == null) return 'Unknown'
  return typeof value === 'string' || typeof value === 'number'
    ? String(value)
    : 'Set'
}

function formatSampleWindow(snap: EvalSummarySnapshot) {
  if (snap.lookbackHours != null && snap.sampleSize != null) {
    return `${snap.sampleSize} / ${snap.lookbackHours}h`
  }
  if (snap.sampleSize != null) return `${snap.sampleSize} cases`
  if (snap.lookbackHours != null) return `${snap.lookbackHours}h`
  return 'Unknown'
}

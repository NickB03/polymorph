import {
  type DashboardAlert,
  getLatestThresholdAlert
} from '@/lib/evals/helpers/alerts'
import { getSuiteStatus, type SuiteStatus } from '@/lib/evals/helpers/status'
import type {
  EvalsDashboardData,
  EvalSummarySnapshot,
  PersistedDashboardSuite
} from '@/lib/evals/types'

import { localLabel } from './local-labels'
import type { SuiteId } from './url-state'

const DASHBOARD_SUITE_BY_PERSISTED: Record<PersistedDashboardSuite, SuiteId> = {
  capability: 'capability',
  regression: 'regression',
  'traffic-monitor': 'trafficMonitor'
}

export interface PhoenixInsight {
  alert: DashboardAlert
  suiteId: SuiteId
  summary: string
  interpretation: string
  actionLabel: string
}

export function persistedSuiteToDashboardSuite(
  suite: PersistedDashboardSuite
): SuiteId {
  return DASHBOARD_SUITE_BY_PERSISTED[suite]
}

export function getFirstAvailableSuite(data: EvalsDashboardData): SuiteId {
  if (data.capability.latest) return 'capability'
  if (data.trafficMonitor.latest) return 'trafficMonitor'
  if (data.regression.latest) return 'regression'
  return 'capability'
}

export function getDefaultSuite(data: EvalsDashboardData): SuiteId {
  return getPhoenixInsight(data)?.suiteId ?? getFirstAvailableSuite(data)
}

export function getPhoenixInsight(
  data: EvalsDashboardData
): PhoenixInsight | null {
  const alert = getLatestThresholdAlert(data)
  if (!alert) return null

  const suiteId = persistedSuiteToDashboardSuite(alert.suite)
  const previous = getPreviousSnapshot(data, suiteId)
  const latest = getLatestSnapshot(data, suiteId)
  const drop = getLargestEvaluatorDrop(latest, previous)

  const summary = drop
    ? `${localLabel(drop.evaluatorName)} on ${alert.suiteLabel} dropped ${Math.abs(Math.round(drop.delta * 100))} pts vs. previous run`
    : `${alert.suiteLabel} is below threshold.`

  const status = latest ? getSuiteStatus(latest, previous) : 'BLOCKED'

  return {
    alert,
    suiteId,
    summary,
    interpretation: getInsightInterpretation(status),
    actionLabel: 'Review'
  }
}

function getLatestSnapshot(
  data: EvalsDashboardData,
  suiteId: SuiteId
): EvalSummarySnapshot | null {
  if (suiteId === 'capability') return data.capability.latest
  if (suiteId === 'trafficMonitor') return data.trafficMonitor.latest
  return data.regression.latest
}

function getPreviousSnapshot(
  data: EvalsDashboardData,
  suiteId: SuiteId
): EvalSummarySnapshot | null {
  if (suiteId === 'capability') return data.capability.previous
  if (suiteId === 'trafficMonitor') return data.trafficMonitor.previous
  return data.regression.previous
}

function getLargestEvaluatorDrop(
  snap: EvalSummarySnapshot | null,
  previous: EvalSummarySnapshot | null
): { evaluatorName: string; delta: number } | null {
  if (!snap || !previous) return null
  let largest: { evaluatorName: string; delta: number } | null = null
  for (const [evaluatorName, currentScore] of Object.entries(
    snap.evaluatorScores
  )) {
    const previousScore = previous.evaluatorScores[evaluatorName]
    if (currentScore == null || previousScore == null) continue
    const delta = currentScore - previousScore
    if (delta < 0 && (!largest || delta < largest.delta)) {
      largest = { evaluatorName, delta }
    }
  }
  return largest
}

function getInsightInterpretation(status: SuiteStatus): string {
  if (status === 'BLOCKED') {
    return 'Threshold breached — review the worst-failing cases below.'
  }
  if (status === 'WATCH') {
    return 'Threshold not breached — keeping at WATCH. Review the worst-failing cases below.'
  }
  return 'Threshold not breached. Review the worst-failing cases below.'
}

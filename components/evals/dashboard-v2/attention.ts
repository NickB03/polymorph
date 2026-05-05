import {
  type DashboardAlert,
  getLatestThresholdAlert
} from '@/lib/evals/helpers/alerts'
import type {
  EvalsDashboardData,
  PersistedDashboardSuite
} from '@/lib/evals/types'

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
  const healthyTestSuite =
    suiteId !== 'capability' &&
    data.capability.latest !== null &&
    !data.capability.latest.thresholdBreached

  return {
    alert,
    suiteId,
    summary: healthyTestSuite
      ? `${alert.suiteLabel} is below threshold while Test Suite is healthy.`
      : `${alert.suiteLabel} is below threshold.`,
    interpretation: getInsightInterpretation(suiteId, healthyTestSuite),
    actionLabel: `Review ${alert.suiteLabel}`
  }
}

function getInsightInterpretation(suiteId: SuiteId, healthyTestSuite: boolean) {
  if (suiteId === 'trafficMonitor' && healthyTestSuite) {
    return 'This points to live-traffic drift rather than a broad baseline regression.'
  }

  if (suiteId === 'trafficMonitor') {
    return 'Start with recent production traces and failed judge examples.'
  }

  if (suiteId === 'regression') {
    return 'Known guardrail cases need attention before release.'
  }

  return 'The controlled Test Suite needs attention before shipping changes.'
}

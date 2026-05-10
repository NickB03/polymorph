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

/**
 * Returns the suite Phoenix flagged with a threshold alert, or null if no
 * alert exists. Only `.suiteId` is read by production callers; the full
 * `PhoenixInsight` shape was removed when phoenix-insight.tsx was deleted.
 */
export function getAlertedSuite(data: EvalsDashboardData): SuiteId | null {
  const alert: DashboardAlert | null = getLatestThresholdAlert(data)
  if (!alert) return null
  return persistedSuiteToDashboardSuite(alert.suite)
}

export function getDefaultSuite(data: EvalsDashboardData): SuiteId {
  return getAlertedSuite(data) ?? getFirstAvailableSuite(data)
}

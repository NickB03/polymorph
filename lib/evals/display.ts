import type { EvalSummarySnapshot, PersistedDashboardSuite } from './types'

export type DashboardSuiteId = 'capability' | 'trafficMonitor' | 'regression'

export type GlossarySuiteKey = 'benchmarks' | 'trafficMonitor' | 'regression'

export interface SuiteDisplayCopy {
  id: DashboardSuiteId
  persisted: PersistedDashboardSuite
  glossaryKey: GlossarySuiteKey
  label: string
  tagline: string
  action: string
  definition: string
}

export const SUITE_DISPLAY: Record<PersistedDashboardSuite, SuiteDisplayCopy> =
  {
    capability: {
      id: 'capability',
      persisted: 'capability',
      glossaryKey: 'benchmarks',
      label: 'Test Suite',
      tagline: 'Curated prompts · controlled inputs · baseline performance',
      action: 'Compare changes and catch regressions before they ship',
      definition:
        'A curated benchmark set run against controlled prompts to measure baseline performance before shipping changes.'
    },
    'traffic-monitor': {
      id: 'trafficMonitor',
      persisted: 'traffic-monitor',
      glossaryKey: 'trafficMonitor',
      label: 'Production Evals',
      tagline: 'Sampled user traffic · real-world behavior · drift detection',
      action: 'Catch issues in the wild and monitor live performance',
      definition:
        'A rolling sample of production chats scored on a schedule to catch live drift and real-world behavior changes.'
    },
    regression: {
      id: 'regression',
      persisted: 'regression',
      glossaryKey: 'regression',
      label: 'Regression Tests',
      tagline: 'Known risk cases · must-pass scenarios · release guardrails',
      action: 'Block bad deploys and protect critical behaviors',
      definition:
        'Saved high-risk cases and known prior failures that should remain fixed before release.'
    }
  }

export const DASHBOARD_SUITE_TO_PERSISTED: Record<
  DashboardSuiteId,
  PersistedDashboardSuite
> = {
  capability: 'capability',
  trafficMonitor: 'traffic-monitor',
  regression: 'regression'
}

export function getSuiteDisplay(suite: PersistedDashboardSuite) {
  return SUITE_DISPLAY[suite]
}

export function getSuiteDisplayByDashboardId(id: DashboardSuiteId) {
  return SUITE_DISPLAY[DASHBOARD_SUITE_TO_PERSISTED[id]]
}

export function getSuiteLabel(suite: PersistedDashboardSuite) {
  return getSuiteDisplay(suite).label
}

export function getSuiteTagline(suite: PersistedDashboardSuite) {
  return getSuiteDisplay(suite).tagline
}

export function getSuiteAction(suite: PersistedDashboardSuite) {
  return getSuiteDisplay(suite).action
}

export function getSuiteDefinition(suite: PersistedDashboardSuite) {
  return getSuiteDisplay(suite).definition
}

export function formatAppModelSummary(snap: EvalSummarySnapshot) {
  const modelIds = snap.appModelIds ?? []
  if (modelIds.length > 1) return `Mixed (${modelIds.length})`
  return snap.primaryAppModelId ?? modelIds[0] ?? 'Unknown'
}

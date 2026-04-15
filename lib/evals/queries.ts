import { desc, eq } from 'drizzle-orm'

import { evalSummaries, userEvalPreferences } from '@/lib/db/schema'
import { type TxInstance, withRLS } from '@/lib/db/with-rls'

import { DEFAULT_TEMPLATE_ID } from './layout/templates'
import type { TemplateId } from './layout/types'
import type {
  CapabilityDashboardData,
  EvalsDashboardData,
  EvalSummaryRow,
  EvalSummarySnapshot,
  TrafficMonitorDashboardData
} from './types'

function computeOverallScore(evaluatorScores: Record<string, number>) {
  const values = Object.values(evaluatorScores)
  if (values.length === 0) {
    return 0
  }

  return values.reduce((total, value) => total + value, 0) / values.length
}

function toSnapshot(row: EvalSummaryRow): EvalSummarySnapshot {
  return {
    id: row.id,
    experimentName: row.experimentName,
    datasetName: row.datasetName,
    passRate: row.passRateBps / 10000,
    overallScore: computeOverallScore(row.evaluatorScores),
    evaluatorScores: row.evaluatorScores,
    totalCases: row.totalCases,
    phoenixUrl: row.phoenixUrl,
    createdAt: row.createdAt.toISOString()
  }
}

export function buildCapabilityDashboardData(
  rows: EvalSummaryRow[]
): CapabilityDashboardData {
  const ordered = [...rows].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  )
  const snapshots = ordered.map(toSnapshot)
  const latest = snapshots[0] ?? null
  const previous = snapshots[1] ?? null

  return {
    latest,
    previous,
    trend: [...snapshots]
      .reverse()
      .map(({ createdAt, passRate, overallScore }) => ({
        createdAt,
        passRate,
        overallScore
      })),
    lastUpdated: latest?.createdAt ?? null
  }
}

export const buildTrafficMonitorDashboardData = buildCapabilityDashboardData

type SuiteValue = 'capability' | 'regression' | 'traffic-monitor'

async function selectSuiteRows(
  tx: TxInstance,
  suite: SuiteValue
): Promise<EvalSummaryRow[]> {
  return tx
    .select({
      id: evalSummaries.id,
      experimentName: evalSummaries.experimentName,
      datasetName: evalSummaries.datasetName,
      passRateBps: evalSummaries.passRateBps,
      evaluatorScores: evalSummaries.evaluatorScores,
      totalCases: evalSummaries.totalCases,
      phoenixUrl: evalSummaries.phoenixUrl,
      createdAt: evalSummaries.createdAt
    })
    .from(evalSummaries)
    .where(eq(evalSummaries.suite, suite))
    .orderBy(desc(evalSummaries.createdAt))
    .limit(12)
}

export async function getCapabilityDashboard(userId: string) {
  return withRLS(userId, async tx => {
    const rows = await selectSuiteRows(tx, 'capability')
    return buildCapabilityDashboardData(rows)
  })
}

export async function getTrafficMonitorDashboard(
  userId: string
): Promise<TrafficMonitorDashboardData> {
  return withRLS(userId, async tx => {
    const rows = await selectSuiteRows(tx, 'traffic-monitor')
    return buildTrafficMonitorDashboardData(rows)
  })
}

export async function getEvalsDashboard(
  userId: string
): Promise<EvalsDashboardData> {
  return withRLS(userId, async tx => {
    const [capabilityRows, trafficRows] = await Promise.all([
      selectSuiteRows(tx, 'capability'),
      selectSuiteRows(tx, 'traffic-monitor')
    ])
    return {
      capability: buildCapabilityDashboardData(capabilityRows),
      trafficMonitor: buildTrafficMonitorDashboardData(trafficRows)
    }
  })
}

export async function getPreferredEvalsLayout(
  userId: string
): Promise<TemplateId> {
  const rows = await withRLS(userId, tx =>
    tx
      .select({ preferredLayout: userEvalPreferences.preferredLayout })
      .from(userEvalPreferences)
      .where(eq(userEvalPreferences.userId, userId))
      .limit(1)
  )
  const value = rows[0]?.preferredLayout
  if (value === 'a' || value === 'b' || value === 'c') return value
  return DEFAULT_TEMPLATE_ID
}

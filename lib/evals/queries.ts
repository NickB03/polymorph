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
  PersistedDashboardSuite,
  RegressionDashboardData,
  TrafficMonitorDashboardData
} from './types'

function computeOverallScore(evaluatorScores: Record<string, number>): number {
  const scored = Object.values(evaluatorScores).filter(
    (value): value is number =>
      typeof value === 'number' && !Number.isNaN(value)
  )
  if (scored.length === 0) {
    return 0
  }

  return scored.reduce((total, value) => total + value, 0) / scored.length
}

function toSnapshot(row: EvalSummaryRow): EvalSummarySnapshot {
  return {
    id: row.id,
    suite: row.suite,
    experimentName: row.experimentName,
    datasetName: row.datasetName,
    passRate: row.passRateBps / 10000,
    threshold: row.thresholdBps == null ? null : row.thresholdBps / 10000,
    thresholdBreached: row.thresholdBreached,
    failedEvaluators: row.failedEvaluators,
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
export const buildRegressionDashboardData = buildCapabilityDashboardData

type SuiteValue = PersistedDashboardSuite

async function selectSuiteRows(
  tx: TxInstance,
  suite: SuiteValue
): Promise<EvalSummaryRow[]> {
  return tx
    .select({
      id: evalSummaries.id,
      suite: evalSummaries.suite,
      experimentName: evalSummaries.experimentName,
      datasetName: evalSummaries.datasetName,
      passRateBps: evalSummaries.passRateBps,
      thresholdBps: evalSummaries.thresholdBps,
      thresholdBreached: evalSummaries.thresholdBreached,
      failedEvaluators: evalSummaries.failedEvaluators,
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

export async function getRegressionDashboard(
  userId: string
): Promise<RegressionDashboardData> {
  return withRLS(userId, async tx => {
    const rows = await selectSuiteRows(tx, 'regression')
    return buildRegressionDashboardData(rows)
  })
}

export async function getEvalsDashboard(
  userId: string
): Promise<EvalsDashboardData> {
  return withRLS(userId, async tx => {
    const [capabilityRows, regressionRows, trafficRows] = await Promise.all([
      selectSuiteRows(tx, 'capability'),
      selectSuiteRows(tx, 'regression'),
      selectSuiteRows(tx, 'traffic-monitor')
    ])
    return {
      capability: buildCapabilityDashboardData(capabilityRows),
      regression: buildRegressionDashboardData(regressionRows),
      trafficMonitor: buildTrafficMonitorDashboardData(trafficRows)
    }
  })
}

function parseTemplateId(value: unknown): TemplateId {
  if (value === 'a' || value === 'b' || value === 'c') return value
  return DEFAULT_TEMPLATE_ID
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
  return parseTemplateId(rows[0]?.preferredLayout)
}

export async function getEvalsDashboardWithLayout(
  userId: string
): Promise<{ data: EvalsDashboardData; layout: TemplateId }> {
  return withRLS(userId, async tx => {
    const [capabilityRows, regressionRows, trafficRows, prefRows] =
      await Promise.all([
        selectSuiteRows(tx, 'capability'),
        selectSuiteRows(tx, 'regression'),
        selectSuiteRows(tx, 'traffic-monitor'),
        tx
          .select({ preferredLayout: userEvalPreferences.preferredLayout })
          .from(userEvalPreferences)
          .where(eq(userEvalPreferences.userId, userId))
          .limit(1)
      ])
    return {
      data: {
        capability: buildCapabilityDashboardData(capabilityRows),
        regression: buildRegressionDashboardData(regressionRows),
        trafficMonitor: buildTrafficMonitorDashboardData(trafficRows)
      },
      layout: parseTemplateId(prefRows[0]?.preferredLayout)
    }
  })
}

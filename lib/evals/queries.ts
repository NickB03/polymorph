import { desc, eq } from 'drizzle-orm'

import { evalSummaries } from '@/lib/db/schema'
import { type TxInstance, withRLS } from '@/lib/db/with-rls'

import type {
  CapabilityDashboardData,
  EvalsDashboardData,
  EvalSummaryRow,
  EvalSummarySnapshot,
  PersistedDashboardSuite,
  RegressionDashboardData,
  TrafficMonitorDashboardData
} from './types'

function computeOverallScore(
  evaluatorScores: Record<string, number | null>
): number {
  const scored = Object.values(evaluatorScores).filter(
    (value): value is number =>
      typeof value === 'number' && !Number.isNaN(value)
  )
  if (scored.length === 0) {
    return 0
  }

  return scored.reduce((total, value) => total + value, 0) / scored.length
}

export function toSnapshot(row: EvalSummaryRow): EvalSummarySnapshot {
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
    attemptedCases: row.attemptedCases,
    failedCases: row.failedCases,
    dropRate: row.attemptedCases > 0 ? row.failedCases / row.attemptedCases : 0,
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

const RECENT_RUNS_LIMIT = 10

const SUMMARY_COLUMNS = {
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
  attemptedCases: evalSummaries.attemptedCases,
  failedCases: evalSummaries.failedCases,
  phoenixUrl: evalSummaries.phoenixUrl,
  createdAt: evalSummaries.createdAt
}

async function selectSuiteRows(
  tx: TxInstance,
  suite: SuiteValue
): Promise<EvalSummaryRow[]> {
  return tx
    .select(SUMMARY_COLUMNS)
    .from(evalSummaries)
    .where(eq(evalSummaries.suite, suite))
    .orderBy(desc(evalSummaries.createdAt))
    .limit(12)
}

async function selectRecentRuns(
  tx: TxInstance,
  limit: number
): Promise<EvalSummaryRow[]> {
  return tx
    .select(SUMMARY_COLUMNS)
    .from(evalSummaries)
    .orderBy(desc(evalSummaries.createdAt))
    .limit(limit)
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
    const [capabilityRows, regressionRows, trafficRows, recentRows] =
      await Promise.all([
        selectSuiteRows(tx, 'capability'),
        selectSuiteRows(tx, 'regression'),
        selectSuiteRows(tx, 'traffic-monitor'),
        selectRecentRuns(tx, RECENT_RUNS_LIMIT)
      ])
    return {
      capability: buildCapabilityDashboardData(capabilityRows),
      regression: buildRegressionDashboardData(regressionRows),
      trafficMonitor: buildTrafficMonitorDashboardData(trafficRows),
      recentRuns: recentRows.map(toSnapshot)
    }
  })
}

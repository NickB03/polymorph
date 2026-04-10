import { desc, eq } from 'drizzle-orm'

import { evalSummaries } from '@/lib/db/schema'
import { withRLS } from '@/lib/db/with-rls'

import type {
  CapabilityDashboardData,
  EvalSummaryRow,
  EvalSummarySnapshot
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

export async function getCapabilityDashboard(userId: string) {
  return withRLS(userId, async tx => {
    const rows = await tx
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
      .where(eq(evalSummaries.suite, 'capability'))
      .orderBy(desc(evalSummaries.createdAt))
      .limit(12)

    return buildCapabilityDashboardData(rows)
  })
}

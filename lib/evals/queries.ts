import { desc, eq, inArray } from 'drizzle-orm'

import { evalCaseResults, evalSummaries } from '@/lib/db/schema'
import { type TxInstance, withRLS } from '@/lib/db/with-rls'

import type {
  CapabilityDashboardData,
  EvalCaseResultRow,
  EvalFailureMode,
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

export function toCaseResultSnapshot(row: EvalCaseResultRow) {
  return {
    id: row.id,
    evalSummaryId: row.evalSummaryId,
    suite: row.suite,
    experimentName: row.experimentName,
    experimentRunId: row.experimentRunId,
    datasetExampleId: row.datasetExampleId,
    caseId: row.caseId,
    evaluatorName: row.evaluatorName,
    annotatorKind: row.annotatorKind,
    score: row.scoreBps == null ? null : row.scoreBps / 10000,
    label: row.label,
    explanation: row.explanation,
    error: row.error,
    failed: row.failed,
    failureMode: row.failureMode,
    appModelId: row.appModelId,
    modelType: row.modelType,
    searchMode: row.searchMode,
    correlationId: row.correlationId,
    otelTraceId: row.otelTraceId,
    evaluatorTraceId: row.evaluatorTraceId,
    phoenixUrl: row.phoenixUrl,
    createdAt: row.createdAt.toISOString()
  }
}

type CaseResultMap = Map<string, EvalCaseResultRow[]>

const FAILURE_MODES = new Set<EvalFailureMode>([
  'retrieval_miss',
  'bad_citation',
  'unsafe_response',
  'tool_not_called',
  'tool_unnecessary',
  'answer_incomplete',
  'contradicts_context',
  'other'
])

function normalizeFailureMode(value: string): EvalFailureMode {
  return FAILURE_MODES.has(value as EvalFailureMode)
    ? (value as EvalFailureMode)
    : 'other'
}

export function toSnapshot(
  row: EvalSummaryRow,
  caseResultMap: CaseResultMap = new Map()
): EvalSummarySnapshot {
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
    appModelIds: row.appModelIds ?? [],
    primaryAppModelId: row.primaryAppModelId ?? null,
    judgeProvider: row.judgeProvider ?? 'openrouter',
    judgeModel: row.judgeModel ?? null,
    judgeBaseUrl: row.judgeBaseUrl ?? null,
    judgeSettings: row.judgeSettings ?? {},
    corpusVersion: row.corpusVersion ?? null,
    datasetVersion: row.datasetVersion ?? null,
    evaluatorTemplateVersion: row.evaluatorTemplateVersion ?? 'v1',
    appGitSha: row.appGitSha ?? null,
    sampleSize: row.sampleSize ?? null,
    lookbackHours: row.lookbackHours ?? null,
    phoenixUrl: row.phoenixUrl,
    createdAt: row.createdAt.toISOString(),
    caseResults: (caseResultMap.get(row.id) ?? []).map(toCaseResultSnapshot)
  }
}

export function buildCapabilityDashboardData(
  rows: EvalSummaryRow[],
  caseResultMap: CaseResultMap = new Map()
): CapabilityDashboardData {
  const ordered = [...rows].sort(
    (left, right) => right.createdAt.getTime() - left.createdAt.getTime()
  )
  const snapshots = ordered.map(row => toSnapshot(row, caseResultMap))
  const latest = snapshots[0] ?? null
  const previous = snapshots[1] ?? null
  const latestTime = latest ? new Date(latest.createdAt).getTime() : null
  const trendSnapshots =
    latestTime == null
      ? snapshots
      : snapshots.filter(
          snapshot =>
            latestTime - new Date(snapshot.createdAt).getTime() <=
            TREND_WINDOW_MS
        )

  return {
    latest,
    previous,
    trend: [...trendSnapshots]
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

const TREND_WINDOW_MS = 14 * 24 * 60 * 60 * 1000
const SUITE_RUNS_LIMIT = 60
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
  appModelIds: evalSummaries.appModelIds,
  primaryAppModelId: evalSummaries.primaryAppModelId,
  judgeProvider: evalSummaries.judgeProvider,
  judgeModel: evalSummaries.judgeModel,
  judgeBaseUrl: evalSummaries.judgeBaseUrl,
  judgeSettings: evalSummaries.judgeSettings,
  corpusVersion: evalSummaries.corpusVersion,
  datasetVersion: evalSummaries.datasetVersion,
  evaluatorTemplateVersion: evalSummaries.evaluatorTemplateVersion,
  appGitSha: evalSummaries.appGitSha,
  sampleSize: evalSummaries.sampleSize,
  lookbackHours: evalSummaries.lookbackHours,
  createdAt: evalSummaries.createdAt
}

const CASE_RESULT_COLUMNS = {
  id: evalCaseResults.id,
  evalSummaryId: evalCaseResults.evalSummaryId,
  suite: evalCaseResults.suite,
  experimentName: evalCaseResults.experimentName,
  experimentRunId: evalCaseResults.experimentRunId,
  datasetExampleId: evalCaseResults.datasetExampleId,
  caseId: evalCaseResults.caseId,
  evaluatorName: evalCaseResults.evaluatorName,
  annotatorKind: evalCaseResults.annotatorKind,
  scoreBps: evalCaseResults.scoreBps,
  label: evalCaseResults.label,
  explanation: evalCaseResults.explanation,
  error: evalCaseResults.error,
  failed: evalCaseResults.failed,
  failureMode: evalCaseResults.failureMode,
  appModelId: evalCaseResults.appModelId,
  modelType: evalCaseResults.modelType,
  searchMode: evalCaseResults.searchMode,
  correlationId: evalCaseResults.correlationId,
  otelTraceId: evalCaseResults.otelTraceId,
  evaluatorTraceId: evalCaseResults.evaluatorTraceId,
  phoenixUrl: evalCaseResults.phoenixUrl,
  createdAt: evalCaseResults.createdAt
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
    .limit(SUITE_RUNS_LIMIT)
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

async function selectCaseResultsForSummaries(
  tx: TxInstance,
  summaryIds: string[]
): Promise<CaseResultMap> {
  if (summaryIds.length === 0) return new Map()

  const rows = await tx
    .select(CASE_RESULT_COLUMNS)
    .from(evalCaseResults)
    .where(inArray(evalCaseResults.evalSummaryId, summaryIds))
    .orderBy(desc(evalCaseResults.failed), evalCaseResults.scoreBps)

  const grouped = new Map<string, EvalCaseResultRow[]>()
  for (const row of rows) {
    const typedRow: EvalCaseResultRow = {
      ...row,
      failureMode: normalizeFailureMode(row.failureMode)
    }
    const list = grouped.get(row.evalSummaryId) ?? []
    list.push(typedRow)
    grouped.set(row.evalSummaryId, list)
  }
  return grouped
}

function uniqueSummaryIds(rows: EvalSummaryRow[]) {
  return [...new Set(rows.map(row => row.id))]
}

function diagnosticRowsForSuite(rows: EvalSummaryRow[]) {
  return rows.slice(0, 2)
}

export async function getCapabilityDashboard(userId: string) {
  return withRLS(userId, async tx => {
    const rows = await selectSuiteRows(tx, 'capability')
    const details = await selectCaseResultsForSummaries(
      tx,
      uniqueSummaryIds(diagnosticRowsForSuite(rows))
    )
    return buildCapabilityDashboardData(rows, details)
  })
}

export async function getTrafficMonitorDashboard(
  userId: string
): Promise<TrafficMonitorDashboardData> {
  return withRLS(userId, async tx => {
    const rows = await selectSuiteRows(tx, 'traffic-monitor')
    const details = await selectCaseResultsForSummaries(
      tx,
      uniqueSummaryIds(diagnosticRowsForSuite(rows))
    )
    return buildTrafficMonitorDashboardData(rows, details)
  })
}

export async function getRegressionDashboard(
  userId: string
): Promise<RegressionDashboardData> {
  return withRLS(userId, async tx => {
    const rows = await selectSuiteRows(tx, 'regression')
    const details = await selectCaseResultsForSummaries(
      tx,
      uniqueSummaryIds(diagnosticRowsForSuite(rows))
    )
    return buildRegressionDashboardData(rows, details)
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
    const details = await selectCaseResultsForSummaries(
      tx,
      uniqueSummaryIds([
        ...diagnosticRowsForSuite(capabilityRows),
        ...diagnosticRowsForSuite(regressionRows),
        ...diagnosticRowsForSuite(trafficRows),
        ...recentRows
      ])
    )

    return {
      capability: buildCapabilityDashboardData(capabilityRows, details),
      regression: buildRegressionDashboardData(regressionRows, details),
      trafficMonitor: buildTrafficMonitorDashboardData(trafficRows, details),
      recentRuns: recentRows.map(row => toSnapshot(row, details))
    }
  })
}

import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

/**
 * Narrative page-level status. Distinct from `ScoreBarStatus` (single-score
 * color tier, owned by score-bar.tsx) and `Severity` (cross-suite delta
 * divergence, owned by dashboard/shared.ts). Three concepts, three enums.
 */
export type SuiteStatus = 'READY' | 'WATCH' | 'BLOCKED'

const RANK: Record<SuiteStatus, number> = {
  READY: 0,
  WATCH: 1,
  BLOCKED: 2
}

const EVALUATOR_DROP_THRESHOLD = -0.05

// Below-threshold tolerance: a suite scoring within 10 points of the threshold
// is WATCH; deeper drops are BLOCKED. The wire's reference case (−7 pts on a
// 0.85 threshold) sits inside this band.
const BLOCKED_THRESHOLD_GAP = -0.1

export function getSuiteStatus(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
): SuiteStatus {
  const thresholdGap =
    snap.threshold == null ? null : snap.overallScore - snap.threshold
  if (thresholdGap != null && thresholdGap < BLOCKED_THRESHOLD_GAP) {
    return 'BLOCKED'
  }
  if (snap.thresholdBreached && thresholdGap == null) return 'BLOCKED'

  const belowThreshold =
    (thresholdGap != null && thresholdGap < 0) || snap.thresholdBreached
  const largestDrop = getLargestEvaluatorDrop(snap, previous)
  if (
    belowThreshold ||
    snap.failedCases > 0 ||
    snap.failedEvaluators.length > 0 ||
    (largestDrop !== null && largestDrop <= EVALUATOR_DROP_THRESHOLD)
  ) {
    return 'WATCH'
  }
  return 'READY'
}

export function getOverallStatus(data: EvalsDashboardData): SuiteStatus {
  const candidates: SuiteStatus[] = []
  if (data.capability.latest) {
    candidates.push(
      getSuiteStatus(data.capability.latest, data.capability.previous)
    )
  }
  if (data.trafficMonitor.latest) {
    candidates.push(
      getSuiteStatus(data.trafficMonitor.latest, data.trafficMonitor.previous)
    )
  }
  if (data.regression.latest) {
    candidates.push(
      getSuiteStatus(data.regression.latest, data.regression.previous)
    )
  }
  if (candidates.length === 0) return 'READY'
  return candidates.reduce((worst, s) => (RANK[s] > RANK[worst] ? s : worst))
}

function getLargestEvaluatorDrop(
  snap: EvalSummarySnapshot,
  previous: EvalSummarySnapshot | null
): number | null {
  if (!previous) return null
  let smallest: number | null = null
  for (const [name, score] of Object.entries(snap.evaluatorScores)) {
    const prev = previous.evaluatorScores[name]
    if (score == null || prev == null) continue
    const delta = score - prev
    if (smallest == null || delta < smallest) smallest = delta
  }
  return smallest
}

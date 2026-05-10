import type { EvalsDashboardData, EvalSummarySnapshot } from '@/lib/evals/types'

/**
 * Narrative page-level status. Distinct from `ScoreBarStatus` (single-score
 * color tier, owned by score-bar.tsx) and `Severity` (cross-suite delta
 * divergence, owned by dashboard/shared.ts). Three concepts, three enums.
 */
export type SuiteStatus = 'READY' | 'WATCH' | 'BLOCKED'

/**
 * Canonical design tokens for each SuiteStatus. Use this map to avoid
 * duplicating status → color/label mappings across dashboard components.
 *
 * `fg`      — Tailwind text utility (e.g. 'text-success')
 * `bg`      — Tailwind bg utility for tinted surfaces (e.g. 'bg-success/10')
 * `border`  — Tailwind border utility (e.g. 'border-success/30')
 * `ring`    — Tailwind ring utility for focus rings
 * `dot`     — Tailwind bg utility for the small status dot
 * `scoopBg` — Tailwind bg for the ellipse scoop (slightly bolder alpha)
 * `pill`    — Combined bg + fg + border string for pill badges
 * `label`   — Human-readable status label
 * `cssVar`  — CSS variable reference for SVG stroke (cannot use Tailwind here)
 */
export const STATUS_TOKENS: Record<
  SuiteStatus,
  {
    fg: string
    bg: string
    border: string
    dot: string
    scoopBg: string
    pill: string
    label: string
    cssVar: string
  }
> = {
  READY: {
    fg: 'text-success',
    bg: 'bg-success/10',
    border: 'border-success/30',
    dot: 'bg-success',
    scoopBg: 'bg-success/40',
    pill: 'bg-success/10 text-success border-success/30',
    label: 'Healthy',
    cssVar: 'var(--accent-blue)'
  },
  WATCH: {
    fg: 'text-warning',
    bg: 'bg-warning/10',
    border: 'border-warning/30',
    dot: 'bg-warning',
    scoopBg: 'bg-warning/30',
    pill: 'bg-warning/10 text-warning border-warning/30',
    label: 'Caution',
    cssVar: 'var(--warning)'
  },
  BLOCKED: {
    fg: 'text-destructive',
    bg: 'bg-destructive/10',
    border: 'border-destructive/30',
    dot: 'bg-destructive',
    scoopBg: 'bg-destructive/15',
    pill: 'bg-destructive/10 text-destructive border-destructive/30',
    label: 'Failing',
    cssVar: 'var(--destructive)'
  }
}

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

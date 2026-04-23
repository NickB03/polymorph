import { format } from 'date-fns'

import { getEvaluatorLabel } from '@/lib/evals/evaluator-labels'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { buildThresholdAlerts } from './alerts'

export interface Finding {
  severity: 'critical' | 'drop' | 'improvement' | 'watch'
  text: string
  snapshotId: string
}

// Threshold in integer basis points (5 = 5% = 0.05 score delta).
// Integer comparison avoids floating-point noise at the boundary
// (e.g., 0.95 - 0.9 = 0.04999999999999998 would fail a raw >= 0.05 check).
const DELTA_THRESHOLD_BPS = 5

function toBps(delta: number) {
  return Math.round(delta * 100)
}

function fmtPts(bps: number) {
  return `${bps > 0 ? '+' : ''}${bps}`
}

export function computeFindings(data: EvalsDashboardData): Finding[] {
  const findings: Finding[] = []
  const { trafficMonitor, capability } = data

  for (const alert of buildThresholdAlerts(data)) {
    findings.push({
      severity: 'critical',
      text: `${alert.suiteLabel} pass rate below recorded threshold (${Math.round(alert.passRate * 100)}% vs ${Math.round(alert.threshold * 100)}%)`,
      snapshotId: alert.snapshotId
    })
  }

  if (trafficMonitor.latest && trafficMonitor.previous) {
    const latest = trafficMonitor.latest
    const previous = trafficMonitor.previous
    for (const key of Object.keys(latest.evaluatorScores)) {
      const previousScore = previous.evaluatorScores[key]
      // Skip evaluators that are new in `latest` — we cannot compute a real
      // delta without a baseline, and coercing missing to 0 fabricates drops.
      if (previousScore == null) continue
      const deltaBps = toBps(latest.evaluatorScores[key] - previousScore)
      if (Math.abs(deltaBps) >= DELTA_THRESHOLD_BPS) {
        findings.push({
          severity: deltaBps < 0 ? 'drop' : 'improvement',
          text: `${getEvaluatorLabel(key)} ${deltaBps > 0 ? 'improved' : 'dropped'} ${fmtPts(deltaBps)} pts on Traffic Monitor at ${format(new Date(latest.createdAt), 'HH:mm')}`,
          snapshotId: latest.id
        })
      }
    }
  }

  if (capability.latest && capability.previous) {
    const latest = capability.latest
    const previous = capability.previous
    for (const key of Object.keys(latest.evaluatorScores)) {
      const previousScore = previous.evaluatorScores[key]
      // Skip evaluators that are new in `latest` — we cannot compute a real
      // delta without a baseline, and coercing missing to 0 fabricates drops.
      if (previousScore == null) continue
      const deltaBps = toBps(latest.evaluatorScores[key] - previousScore)
      if (Math.abs(deltaBps) >= DELTA_THRESHOLD_BPS) {
        findings.push({
          severity: deltaBps < 0 ? 'drop' : 'improvement',
          text: `${getEvaluatorLabel(key)} ${deltaBps > 0 ? 'improved' : 'dropped'} ${fmtPts(deltaBps)} pts on Capability at ${format(new Date(latest.createdAt), 'HH:mm')}`,
          snapshotId: latest.id
        })
      }
    }
  }

  const rank: Record<Finding['severity'], number> = {
    critical: 0,
    drop: 1,
    watch: 2,
    improvement: 3
  }
  return findings.sort((a, b) => rank[a.severity] - rank[b.severity])
}

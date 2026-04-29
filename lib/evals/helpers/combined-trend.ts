import type { EvalsDashboardData, EvalTrendPoint } from '@/lib/evals/types'

export interface CombinedTrendPoint {
  createdAt: string
  capability: number | null
  regression: number | null
  trafficMonitor: number | null
}

export function buildCombinedTrendFromSeries({
  capability,
  regression,
  trafficMonitor
}: {
  capability: EvalTrendPoint[]
  regression: EvalTrendPoint[]
  trafficMonitor: EvalTrendPoint[]
}): CombinedTrendPoint[] {
  const map = new Map<string, CombinedTrendPoint>()
  const ensure = (iso: string) => {
    if (!map.has(iso)) {
      map.set(iso, {
        createdAt: iso,
        capability: null,
        regression: null,
        trafficMonitor: null
      })
    }
    return map.get(iso)!
  }
  capability.forEach(p => {
    ensure(p.createdAt).capability = p.overallScore
  })
  regression.forEach(p => {
    ensure(p.createdAt).regression = p.overallScore
  })
  trafficMonitor.forEach(p => {
    ensure(p.createdAt).trafficMonitor = p.overallScore
  })
  return [...map.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

export function buildCombinedTrend(
  data: EvalsDashboardData
): CombinedTrendPoint[] {
  return buildCombinedTrendFromSeries({
    capability: data.capability.trend,
    regression: data.regression.trend,
    trafficMonitor: data.trafficMonitor.trend
  })
}

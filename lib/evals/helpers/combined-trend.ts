import type { EvalsDashboardData } from '@/lib/evals/types'

export interface CombinedTrendPoint {
  createdAt: string
  capability: number | null
  trafficMonitor: number | null
}

export function buildCombinedTrend(
  data: EvalsDashboardData
): CombinedTrendPoint[] {
  const map = new Map<string, CombinedTrendPoint>()
  const ensure = (iso: string) => {
    if (!map.has(iso)) {
      map.set(iso, { createdAt: iso, capability: null, trafficMonitor: null })
    }
    return map.get(iso)!
  }
  data.capability.trend.forEach(p => {
    ensure(p.createdAt).capability = p.overallScore
  })
  data.trafficMonitor.trend.forEach(p => {
    ensure(p.createdAt).trafficMonitor = p.overallScore
  })
  return [...map.values()].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )
}

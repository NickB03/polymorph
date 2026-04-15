export const DIVERGENCE_WARN = 0.08
export const DIVERGENCE_ALARM = 0.15

export interface Divergence {
  evaluator: string
  capabilityScore: number
  trafficScore: number
  delta: number
  severity: 'warn' | 'alarm'
}

export function computeDivergences(
  capability: Record<string, number>,
  traffic: Record<string, number>
): Divergence[] {
  const out: Divergence[] = []
  for (const key of Object.keys(capability)) {
    const cap = capability[key]
    const traf = traffic[key]
    if (cap == null || traf == null) continue
    const delta = cap - traf
    if (Math.abs(delta) < DIVERGENCE_WARN) continue
    out.push({
      evaluator: key,
      capabilityScore: cap,
      trafficScore: traf,
      delta,
      severity: Math.abs(delta) >= DIVERGENCE_ALARM ? 'alarm' : 'warn'
    })
  }
  return out.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
}

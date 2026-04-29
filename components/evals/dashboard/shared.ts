export const pct = (v: number) => `${Math.round(v * 100)}%`

export const deltaPts = (n: number | null) => {
  if (n == null) return null
  const r = Math.round(n * 100)
  if (r === 0) return '·'
  return `${r > 0 ? '+' : ''}${r}`
}

export type Severity = 'ok' | 'watch' | 'alarm'

export function severityForScore(
  v: number,
  healthy = 0.85,
  warn = 0.7
): Severity {
  if (v >= healthy) return 'ok'
  if (v >= warn) return 'watch'
  return 'alarm'
}

export function severityText(s: Severity) {
  switch (s) {
    case 'ok':
      return 'text-foreground'
    case 'watch':
      return 'text-accent-amber'
    case 'alarm':
      return 'text-destructive'
  }
}

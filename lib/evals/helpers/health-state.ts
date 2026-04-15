export type HealthState = 'healthy' | 'warning' | 'critical'

export function healthForScore(
  score: number,
  healthy: number,
  warning: number
): HealthState {
  if (score >= healthy) return 'healthy'
  if (score >= warning) return 'warning'
  return 'critical'
}

export function stateColor(state: HealthState): string {
  switch (state) {
    case 'healthy':
      return 'text-emerald-600 dark:text-emerald-400'
    case 'warning':
      return 'text-amber-600 dark:text-amber-400'
    case 'critical':
      return 'text-rose-600 dark:text-rose-400'
  }
}

export function stateBg(state: HealthState): string {
  switch (state) {
    case 'healthy':
      return 'bg-emerald-500/10 border-emerald-500/30'
    case 'warning':
      return 'bg-amber-500/10 border-amber-500/30'
    case 'critical':
      return 'bg-rose-500/10 border-rose-500/30'
  }
}

export function stateLabel(state: HealthState): string {
  return state[0].toUpperCase() + state.slice(1)
}

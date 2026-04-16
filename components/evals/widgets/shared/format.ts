export function percent(v: number) {
  return `${Math.round(v * 100)}%`
}

export function fmtDeltaPts(delta: number | null) {
  if (delta == null) return null
  const rounded = Math.round(delta * 100)
  if (rounded === 0) return '0 pts'
  return `${rounded > 0 ? '+' : ''}${rounded} pts`
}

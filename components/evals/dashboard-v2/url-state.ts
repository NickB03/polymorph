export type View = 'suites' | 'history'
export type SuiteId = 'capability' | 'trafficMonitor' | 'regression'

export function isView(value: string | null): value is View {
  return value === 'suites' || value === 'history'
}

export function isSuiteId(value: string | null): value is SuiteId {
  return (
    value === 'capability' ||
    value === 'trafficMonitor' ||
    value === 'regression'
  )
}

// Update the URL search param without pushing to history. Refresh-safe
// (the value will be re-read from the URL on next mount) but back-button
// behavior stays sane (one entry per real navigation).
export function replaceSearchParam(key: string, value: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url.toString())
}

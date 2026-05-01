const VIEWS = ['suites', 'history'] as const
const SUITE_IDS = ['capability', 'trafficMonitor', 'regression'] as const

export type View = (typeof VIEWS)[number]
export type SuiteId = (typeof SUITE_IDS)[number]

export function isView(value: string | null): value is View {
  return (VIEWS as readonly string[]).includes(value ?? '')
}

export function isSuiteId(value: string | null): value is SuiteId {
  return (SUITE_IDS as readonly string[]).includes(value ?? '')
}

// Update the URL search param without pushing to history. Refresh-safe
// (the value will be re-read from the URL on next mount) but back-button
// behavior stays sane (one entry per real navigation).
export function replaceSearchParam(key: string, value: string): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  if (url.searchParams.get(key) === value) return
  url.searchParams.set(key, value)
  window.history.replaceState(window.history.state, '', url.toString())
}

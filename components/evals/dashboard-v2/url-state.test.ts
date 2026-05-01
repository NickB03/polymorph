import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { isSuiteId, isView, replaceSearchParam } from './url-state'

describe('isView', () => {
  it('accepts known view ids', () => {
    expect(isView('suites')).toBe(true)
    expect(isView('history')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isView('overview')).toBe(false)
    expect(isView('foo')).toBe(false)
    expect(isView(null)).toBe(false)
    expect(isView('')).toBe(false)
  })
})

describe('isSuiteId', () => {
  it('accepts known suite ids', () => {
    expect(isSuiteId('capability')).toBe(true)
    expect(isSuiteId('trafficMonitor')).toBe(true)
    expect(isSuiteId('regression')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isSuiteId('benchmarks')).toBe(false)
    expect(isSuiteId('traffic-monitor')).toBe(false)
    expect(isSuiteId(null)).toBe(false)
  })
})

describe('replaceSearchParam', () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    window.history.replaceState({}, '', '/admin/evals')
    replaceSpy = vi.spyOn(window.history, 'replaceState')
  })

  afterEach(() => {
    replaceSpy.mockRestore()
  })

  it('writes the param to the URL when the value changes', () => {
    replaceSearchParam('view', 'history')
    expect(window.location.search).toContain('view=history')
    expect(replaceSpy).toHaveBeenCalledTimes(1)
  })

  it('skips history.replaceState when the value is unchanged', () => {
    window.history.replaceState({}, '', '/admin/evals?view=history')
    replaceSpy.mockClear()
    replaceSearchParam('view', 'history')
    expect(replaceSpy).not.toHaveBeenCalled()
  })

  it('updates the param when the URL has a different value for the same key', () => {
    window.history.replaceState({}, '', '/admin/evals?view=suites')
    replaceSpy.mockClear()
    replaceSearchParam('view', 'history')
    expect(window.location.search).toContain('view=history')
    expect(replaceSpy).toHaveBeenCalledTimes(1)
  })
})

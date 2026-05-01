import { describe, expect, it } from 'vitest'

import { isSuiteId, isView } from './url-state'

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

import { describe, expect, it } from 'vitest'

import {
  getAllCases,
  getCasesForSuite,
  getCorpusVersion,
  getSmoketestCases
} from './corpus'

describe('corpus', () => {
  it('uses v7 after adding availableTools to Phoenix dataset inputs', () => {
    expect(getCorpusVersion()).toBe('v7')
  })

  it('returns capability cases with stable ids', () => {
    const cases = getCasesForSuite('capability')
    expect(cases.length).toBeGreaterThan(0)
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length)
    expect(cases.every(c => c.suite === 'capability')).toBe(true)
  })

  it('returns regression cases with stable ids', () => {
    const cases = getCasesForSuite('regression')
    expect(cases.length).toBeGreaterThan(0)
    expect(new Set(cases.map(c => c.id)).size).toBe(cases.length)
    expect(cases.every(c => c.suite === 'regression')).toBe(true)
  })

  it('returns a tiny smoke corpus', () => {
    const cases = getSmoketestCases()
    expect(cases.length).toBeGreaterThan(0)
    expect(cases.length).toBeLessThanOrEqual(3)
    expect(cases.every(c => c.suite === 'smoke')).toBe(true)
  })

  it('exposes all cases in suite order', () => {
    const cases = getAllCases()
    expect(cases.length).toBe(
      getCasesForSuite('capability').length +
        getCasesForSuite('regression').length +
        getCasesForSuite('smoke').length
    )
  })
})

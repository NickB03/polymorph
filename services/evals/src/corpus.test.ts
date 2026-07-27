import { describe, expect, it } from 'vitest'

import {
  getAllCases,
  getCasesForEvaluation,
  getCasesForSuite,
  getCorpusVersion,
  getSmoketestCases
} from './corpus'

describe('corpus', () => {
  it('uses v8 after promoting capability cases into the regression suite', () => {
    expect(getCorpusVersion()).toBe('v8')
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

  it('selects exact regression cases in configured order', () => {
    const cases = getCasesForEvaluation('regression', [
      'reg-follow-up',
      'reg-direct-answer'
    ])

    expect(cases.map(caseSpec => caseSpec.id)).toEqual([
      'reg-follow-up',
      'reg-direct-answer'
    ])
  })

  it('rejects unknown or cross-suite case ids', () => {
    expect(() =>
      getCasesForEvaluation('regression', [
        'reg-direct-answer',
        'cap-long-input',
        'missing-case'
      ])
    ).toThrow(
      '[evals] EVAL_CASE_IDS contains invalid regression case IDs: cap-long-input, missing-case'
    )
  })
})

describe('regression corpus v8', () => {
  it('regression suite has at least 15 cases with regression suite identity', () => {
    const cases = getCasesForEvaluation('regression')
    expect(cases.length).toBeGreaterThanOrEqual(15)
    for (const caseSpec of cases) {
      expect(caseSpec.suite).toBe('regression')
      expect(caseSpec.id).toMatch(/^reg-/)
    }
  })

  it('regression case ids are unique', () => {
    const ids = getCasesForEvaluation('regression').map(c => c.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('corpus version is v8', () => {
    expect(getCorpusVersion()).toBe('v8')
  })
})

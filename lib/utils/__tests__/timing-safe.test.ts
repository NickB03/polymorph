import { describe, expect, it } from 'vitest'

import { safeSecretCompare } from '../timing-safe'

describe('safeSecretCompare', () => {
  it('returns true for identical strings', () => {
    expect(safeSecretCompare('secret-token', 'secret-token')).toBe(true)
  })

  it('returns false for different strings', () => {
    expect(safeSecretCompare('secret-token', 'other-token')).toBe(false)
  })

  it('returns false for different lengths without throwing', () => {
    expect(safeSecretCompare('short', 'a-much-longer-secret')).toBe(false)
  })

  it('returns false for an empty provided value', () => {
    expect(safeSecretCompare('', 'expected')).toBe(false)
  })
})

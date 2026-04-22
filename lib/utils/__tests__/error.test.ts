import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '../error'

describe('getErrorMessage', () => {
  it('returns the message for Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the message for custom Error subclasses', () => {
    class MyError extends Error {}
    expect(getErrorMessage(new MyError('nested'))).toBe('nested')
  })

  it('stringifies non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string')
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(null)).toBe('null')
    expect(getErrorMessage(undefined)).toBe('undefined')
  })

  it('stringifies objects without a message field', () => {
    expect(getErrorMessage({ foo: 'bar' })).toBe('[object Object]')
  })
})

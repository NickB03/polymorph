import { describe, expect, it } from 'vitest'

import { extractHttpErrorInfo } from '../error-utils'

describe('extractHttpErrorInfo', () => {
  it('extracts status from error.status', () => {
    const err = Object.assign(new Error('bad'), { status: 429 })
    expect(extractHttpErrorInfo(err).status).toBe(429)
  })

  it('prefers statusCode over status when both are present', () => {
    const err = Object.assign(new Error('bad'), {
      status: 500,
      statusCode: 429
    })
    expect(extractHttpErrorInfo(err).status).toBe(429)
  })

  it('extracts statusText', () => {
    const err = Object.assign(new Error('bad'), {
      statusText: 'Too Many Requests'
    })
    expect(extractHttpErrorInfo(err).statusText).toBe('Too Many Requests')
  })

  it('extracts retry-after from Headers-like object', () => {
    const err = Object.assign(new Error('bad'), {
      headers: { get: (name: string) => (name === 'retry-after' ? '30' : null) }
    })
    expect(extractHttpErrorInfo(err).retryAfter).toBe('30')
  })

  it('returns undefined fields when nothing is present', () => {
    expect(extractHttpErrorInfo(new Error('bare'))).toEqual({
      status: undefined,
      statusText: undefined,
      retryAfter: undefined
    })
  })

  it('is safe for non-Error values', () => {
    expect(extractHttpErrorInfo(null)).toEqual({
      status: undefined,
      statusText: undefined,
      retryAfter: undefined
    })
    expect(extractHttpErrorInfo('oops')).toEqual({
      status: undefined,
      statusText: undefined,
      retryAfter: undefined
    })
  })
})

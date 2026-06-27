import { describe, expect, it } from 'vitest'

import { getSafeRedirectPath } from './redirect-path'

describe('getSafeRedirectPath', () => {
  it('keeps internal app paths intact', () => {
    expect(getSafeRedirectPath('/admin/evals')).toBe('/admin/evals')
    expect(getSafeRedirectPath('/admin/evals?tab=traffic')).toBe(
      '/admin/evals?tab=traffic'
    )
  })

  it('falls back to root for missing or unsafe targets', () => {
    expect(getSafeRedirectPath(null)).toBe('/')
    expect(getSafeRedirectPath('')).toBe('/')
    expect(getSafeRedirectPath('admin/evals')).toBe('/')
    expect(getSafeRedirectPath('https://example.com')).toBe('/')
    expect(getSafeRedirectPath('//example.com')).toBe('/')
  })

  it('rejects backslash and control-char authority smuggling', () => {
    // The WHATWG URL parser treats these as '//evil.com' (cross-origin).
    expect(getSafeRedirectPath('/\\evil.com')).toBe('/')
    expect(getSafeRedirectPath('/\\/evil.com')).toBe('/')
    expect(getSafeRedirectPath('/\t/evil.com')).toBe('/')
    expect(getSafeRedirectPath('/\n/evil.com')).toBe('/')
    expect(getSafeRedirectPath('/path\\with\\backslash')).toBe('/')
  })
})

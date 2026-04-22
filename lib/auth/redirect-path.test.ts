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
})

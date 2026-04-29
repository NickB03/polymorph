import { describe, expect, it } from 'vitest'

import { isPublicPath } from './middleware'

describe('isPublicPath', () => {
  it('treats only the root route as the public root path', () => {
    expect(isPublicPath('/')).toBe(true)
    expect(isPublicPath('/evals')).toBe(false)
    expect(isPublicPath('/search/123')).toBe(false)
  })

  it('keeps auth and share namespaces public', () => {
    expect(isPublicPath('/auth/login')).toBe(true)
    expect(isPublicPath('/share/abc')).toBe(true)
  })

  it('keeps api routes public', () => {
    expect(isPublicPath('/api/health')).toBe(true)
  })

  it('keeps metadata routes public', () => {
    expect(isPublicPath('/manifest.webmanifest')).toBe(true)
  })
})

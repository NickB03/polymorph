import { describe, expect, it } from 'vitest'

import { shouldSkipMigrations } from '../migrate'

describe('shouldSkipMigrations', () => {
  it('skips Vercel preview builds by default', () => {
    expect(shouldSkipMigrations({ VERCEL_ENV: 'preview' })).toBe(true)
  })

  it('runs on preview only when explicitly opted in', () => {
    expect(
      shouldSkipMigrations({
        VERCEL_ENV: 'preview',
        MIGRATE_ON_PREVIEW: 'true'
      })
    ).toBe(false)
    expect(
      shouldSkipMigrations({ VERCEL_ENV: 'preview', MIGRATE_ON_PREVIEW: '1' })
    ).toBe(true)
  })

  it('runs for production and for non-Vercel environments', () => {
    expect(shouldSkipMigrations({ VERCEL_ENV: 'production' })).toBe(false)
    expect(shouldSkipMigrations({})).toBe(false)
  })
})

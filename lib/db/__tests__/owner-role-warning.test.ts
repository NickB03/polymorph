// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'

// The postgres client is lazy, so importing the module never connects.
async function importDbWith(env: Record<string, string>) {
  vi.resetModules()
  vi.stubEnv('DATABASE_URL', 'postgres://owner:pw@localhost:5432/db')
  for (const [key, value] of Object.entries(env)) vi.stubEnv(key, value)
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  await import('@/lib/db')
  return errorSpy
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('lib/db owner-role warning', () => {
  it('logs once, without throwing, in production with no restricted URL', async () => {
    const errorSpy = await importDbWith({ NODE_ENV: 'production' })

    expect(errorSpy).toHaveBeenCalledTimes(1)
    expect(errorSpy.mock.calls[0][0]).toContain(
      'Row-Level Security is NOT enforced'
    )
  })

  it('stays quiet with a restricted URL, during build, and outside production', async () => {
    const restricted = await importDbWith({
      NODE_ENV: 'production',
      DATABASE_RESTRICTED_URL: 'postgres://app_user:pw@localhost:5432/db'
    })
    expect(restricted).not.toHaveBeenCalled()

    const build = await importDbWith({
      NODE_ENV: 'production',
      NEXT_PHASE: 'phase-production-build'
    })
    expect(build).not.toHaveBeenCalled()

    const test = await importDbWith({ NODE_ENV: 'test' })
    expect(test).not.toHaveBeenCalled()
  })
})

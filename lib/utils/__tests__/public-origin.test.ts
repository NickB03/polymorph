import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

describe('public origin helpers', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
    delete process.env.NEXT_PUBLIC_APP_URL
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  it('returns the configured public origin in production', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://polymorph-nb.vercel.app'
    }

    const { getPublicOrigin } = await import('../public-origin')

    expect(getPublicOrigin().toString()).toBe(
      'https://polymorph-nb.vercel.app/'
    )
  })

  it('throws in production when NEXT_PUBLIC_APP_URL is missing', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production'
    }

    const { getPublicOrigin } = await import('../public-origin')

    expect(() => getPublicOrigin()).toThrow(/NEXT_PUBLIC_APP_URL/)
  })

  it('falls back to localhost in development', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'development'
    }

    const { getPublicOrigin } = await import('../public-origin')

    expect(getPublicOrigin().toString()).toBe('http://localhost:43100/')
  })

  it('builds metadata with canonical image URLs from the public origin', async () => {
    process.env = {
      ...process.env,
      NODE_ENV: 'production',
      NEXT_PUBLIC_APP_URL: 'https://polymorph-nb.vercel.app'
    }

    const { createAppMetadata } = await import('../app-metadata')

    const metadata = createAppMetadata()
    const openGraphImages = metadata.openGraph?.images
    const twitterImages = metadata.twitter?.images

    expect(metadata.metadataBase?.toString()).toBe(
      'https://polymorph-nb.vercel.app/'
    )
    expect(openGraphImages).toContain(
      'https://polymorph-nb.vercel.app/opengraph-image.png'
    )
    expect(twitterImages).toContain(
      'https://polymorph-nb.vercel.app/opengraph-image.png'
    )
  })
})

import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkAndEnforceCanvasLimit } from '@/lib/rate-limit/canvas-limits'

const mockRedisIncr = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    // incrWithTtl runs INCR + EXPIRE as one Lua script
    eval: (_script: string, _keys: string[], _args: unknown[]) =>
      mockRedisIncr()
  }))
}))

describe('checkAndEnforceCanvasLimit', () => {
  beforeEach(() => {
    mockRedisIncr.mockReset()
    process.env.POLYMORPH_CLOUD_DEPLOYMENT = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
  })

  it('allows request under the draft limit', async () => {
    mockRedisIncr.mockResolvedValue(5)

    const response = await checkAndEnforceCanvasLimit('user-1', 'draft')
    expect(response).toBeNull()
  })

  it('returns 429 when draft limit is exceeded', async () => {
    mockRedisIncr.mockResolvedValue(31)

    const response = await checkAndEnforceCanvasLimit('user-1', 'draft')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.code).toBe('RATE_LIMIT')
    expect(body.limit).toBe(30)
  })

  it('returns 429 when version limit is exceeded', async () => {
    mockRedisIncr.mockResolvedValue(11)

    const response = await checkAndEnforceCanvasLimit('user-1', 'version')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.limit).toBe(10)
  })

  it('returns 429 when restore limit is exceeded', async () => {
    mockRedisIncr.mockResolvedValue(11)

    const response = await checkAndEnforceCanvasLimit('user-1', 'restore')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.limit).toBe(10)
  })

  it('returns 429 when runtime-diagnostics limit is exceeded', async () => {
    mockRedisIncr.mockResolvedValue(61)

    const response = await checkAndEnforceCanvasLimit(
      'user-1',
      'runtime-diagnostics'
    )
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.limit).toBe(60)
  })

  it('returns 429 when image-proxy limit is exceeded', async () => {
    mockRedisIncr.mockResolvedValue(61)

    const response = await checkAndEnforceCanvasLimit('user-1', 'image-proxy')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)

    const body = await response!.json()
    expect(body.limit).toBe(60)
  })

  it('allows unlimited when not in cloud deployment', async () => {
    delete process.env.POLYMORPH_CLOUD_DEPLOYMENT

    const response = await checkAndEnforceCanvasLimit('user-1', 'draft')
    expect(response).toBeNull()
  })
})

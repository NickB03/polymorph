import { beforeEach, describe, expect, it, vi } from 'vitest'

import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'

const mockRedisIncr = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    // incrWithTtl runs INCR + EXPIRE as one Lua script
    eval: (_script: string, _keys: string[], _args: unknown[]) =>
      mockRedisIncr()
  }))
}))

describe('checkAndEnforceGuestLimit', () => {
  beforeEach(() => {
    mockRedisIncr.mockReset()
    process.env.POLYMORPH_CLOUD_DEPLOYMENT = 'true'
    process.env.UPSTASH_REDIS_REST_URL = 'https://example.com'
    process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    delete process.env.GUEST_CHAT_DAILY_LIMIT
  })

  it('returns null when ip is missing', async () => {
    const response = await checkAndEnforceGuestLimit(null)
    expect(response).toBeNull()
  })

  it('returns 429 when over the default limit', async () => {
    mockRedisIncr.mockResolvedValue(11)

    const response = await checkAndEnforceGuestLimit('1.2.3.4')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)
    const body = await response!.json()
    expect(body.error).toBe(
      'You\u2019ve reached your daily search limit. Create a free account for unlimited access, or come back tomorrow.'
    )
    expect(body.limit).toBe(10)
  })

  it('uses configured limit when set', async () => {
    process.env.GUEST_CHAT_DAILY_LIMIT = '5'
    mockRedisIncr.mockResolvedValue(6)

    const response = await checkAndEnforceGuestLimit('5.6.7.8')
    expect(response).not.toBeNull()
    expect(response?.status).toBe(429)
    const body = await response!.json()
    expect(body.limit).toBe(5)
  })

  it('allows request under the limit', async () => {
    mockRedisIncr.mockResolvedValue(3)

    const response = await checkAndEnforceGuestLimit('9.9.9.9')
    expect(response).toBeNull()
  })
})

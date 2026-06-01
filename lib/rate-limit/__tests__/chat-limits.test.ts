import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetMemoryLimiter } from '../memory-limiter'

const mockGetRedis = vi.hoisted(() => vi.fn())

vi.mock('../redis', () => ({ getRedis: mockGetRedis }))

import { checkAndEnforceOverallChatLimit } from '../chat-limits'

function makeRedis() {
  return { incr: vi.fn(), expire: vi.fn() }
}

describe('checkAndEnforceOverallChatLimit', () => {
  beforeEach(() => {
    _resetMemoryLimiter()
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', 'true')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns null (unlimited) outside cloud deployments', async () => {
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', '')
    await expect(checkAndEnforceOverallChatLimit('u1')).resolves.toBeNull()
    expect(mockGetRedis).not.toHaveBeenCalled()
  })

  it('returns null (unlimited) when Redis is not configured', async () => {
    mockGetRedis.mockReturnValue(null)
    await expect(checkAndEnforceOverallChatLimit('u1')).resolves.toBeNull()
  })

  it('allows a request under the daily limit and sets the TTL on the first hit', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(1)
    mockGetRedis.mockReturnValue(redis)

    const res = await checkAndEnforceOverallChatLimit('u1')

    expect(res).toBeNull()
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('rl:chat:u1:')
    )
    expect(redis.expire).toHaveBeenCalledOnce()
  })

  it('does not reset the TTL on subsequent hits', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(2)
    mockGetRedis.mockReturnValue(redis)

    await checkAndEnforceOverallChatLimit('u1')

    expect(redis.expire).not.toHaveBeenCalled()
  })

  it('returns a 429 with rate-limit metadata when the count exceeds the limit', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(101)
    mockGetRedis.mockReturnValue(redis)

    const res = await checkAndEnforceOverallChatLimit('u1')

    expect(res?.status).toBe(429)
    const body = await res!.json()
    expect(body.code).toBe('RATE_LIMIT')
    expect(body.limit).toBe(100)
    expect(res!.headers.get('X-RateLimit-Limit')).toBe('100')
    expect(res!.headers.get('X-RateLimit-Remaining')).toBe('0')
  })

  it('honors a custom DAILY_CHAT_LIMIT', async () => {
    vi.stubEnv('DAILY_CHAT_LIMIT', '50')
    const redis = makeRedis()
    redis.incr.mockResolvedValue(51)
    mockGetRedis.mockReturnValue(redis)

    const res = await checkAndEnforceOverallChatLimit('u1')

    expect(res?.status).toBe(429)
    expect((await res!.json()).limit).toBe(50)
  })

  it('falls back to the default limit when DAILY_CHAT_LIMIT is invalid', async () => {
    vi.stubEnv('DAILY_CHAT_LIMIT', 'not-a-number')
    const redis = makeRedis()
    redis.incr.mockResolvedValue(101)
    mockGetRedis.mockReturnValue(redis)

    const res = await checkAndEnforceOverallChatLimit('u1')

    expect((await res!.json()).limit).toBe(100)
  })

  it('falls back to the in-memory limiter (1 req / 10s) when Redis throws', async () => {
    const redis = makeRedis()
    redis.incr.mockRejectedValue(new Error('redis down'))
    mockGetRedis.mockReturnValue(redis)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    // memory limiter allows the first request, blocks the second within the window
    expect(await checkAndEnforceOverallChatLimit('u-mem')).toBeNull()
    const blocked = await checkAndEnforceOverallChatLimit('u-mem')

    expect(blocked?.status).toBe(429)
    warnSpy.mockRestore()
  })
})

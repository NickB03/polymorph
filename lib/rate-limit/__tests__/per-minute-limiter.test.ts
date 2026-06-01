import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { _resetMemoryLimiter } from '../memory-limiter'

const mockGetRedis = vi.hoisted(() => vi.fn())

vi.mock('../redis', () => ({ getRedis: mockGetRedis }))

import {
  checkPerMinuteLimit,
  enforcePerMinuteLimit
} from '../per-minute-limiter'

function makeRedis() {
  return { incr: vi.fn(), expire: vi.fn() }
}

describe('checkPerMinuteLimit', () => {
  beforeEach(() => {
    _resetMemoryLimiter()
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', 'true')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('is unlimited outside cloud deployments', async () => {
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', '')
    await expect(checkPerMinuteLimit('voice', 'u1', 5)).resolves.toMatchObject({
      allowed: true,
      remaining: Infinity
    })
    expect(mockGetRedis).not.toHaveBeenCalled()
  })

  it('is unlimited when Redis is not configured', async () => {
    mockGetRedis.mockReturnValue(null)
    await expect(checkPerMinuteLimit('voice', 'u1', 5)).resolves.toMatchObject({
      allowed: true,
      remaining: Infinity
    })
  })

  it('allows requests under the limit and sets a 120s TTL on the first hit', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(1)
    mockGetRedis.mockReturnValue(redis)

    const result = await checkPerMinuteLimit('voice', 'u1', 5)

    expect(result).toMatchObject({ allowed: true, remaining: 4, limit: 5 })
    expect(redis.incr).toHaveBeenCalledWith(
      expect.stringContaining('rl:voice:u1:')
    )
    expect(redis.expire).toHaveBeenCalledWith(
      expect.stringContaining('rl:voice:u1:'),
      120
    )
  })

  it('treats a count equal to the limit as allowed with zero remaining', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(5)
    mockGetRedis.mockReturnValue(redis)

    await expect(checkPerMinuteLimit('voice', 'u1', 5)).resolves.toMatchObject({
      allowed: true,
      remaining: 0
    })
  })

  it('blocks requests over the limit', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(6)
    mockGetRedis.mockReturnValue(redis)

    await expect(checkPerMinuteLimit('voice', 'u1', 5)).resolves.toMatchObject({
      allowed: false,
      remaining: 0
    })
  })

  it('falls back to the in-memory limiter when Redis throws', async () => {
    const redis = makeRedis()
    redis.incr.mockRejectedValue(new Error('redis down'))
    mockGetRedis.mockReturnValue(redis)
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

    const first = await checkPerMinuteLimit('voice', 'u-mem', 5)
    const second = await checkPerMinuteLimit('voice', 'u-mem', 5)

    expect(first.allowed).toBe(true)
    expect(second.allowed).toBe(false)
    warnSpy.mockRestore()
  })
})

describe('enforcePerMinuteLimit', () => {
  beforeEach(() => {
    _resetMemoryLimiter()
    vi.stubEnv('POLYMORPH_CLOUD_DEPLOYMENT', 'true')
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('returns null when the request is allowed', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(1)
    mockGetRedis.mockReturnValue(redis)

    await expect(
      enforcePerMinuteLimit('voice', 'u1', 5, 'Too many voice requests')
    ).resolves.toBeNull()
  })

  it('returns a 429 carrying the supplied error message when blocked', async () => {
    const redis = makeRedis()
    redis.incr.mockResolvedValue(6)
    mockGetRedis.mockReturnValue(redis)

    const res = await enforcePerMinuteLimit(
      'voice',
      'u1',
      5,
      'Too many voice requests'
    )

    expect(res?.status).toBe(429)
    const body = await res!.json()
    expect(body.error).toBe('Too many voice requests')
    expect(body.code).toBe('RATE_LIMIT')
    expect(res!.headers.get('X-RateLimit-Remaining')).toBe('0')
  })
})

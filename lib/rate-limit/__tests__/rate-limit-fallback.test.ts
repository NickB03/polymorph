import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  _resetMemoryLimiter,
  checkMemoryLimit
} from '@/lib/rate-limit/memory-limiter'

const mockRedisIncr = vi.fn()
const mockRedisExpire = vi.fn()

vi.mock('@upstash/redis', () => ({
  Redis: vi.fn().mockImplementation(() => ({
    incr: mockRedisIncr,
    expire: mockRedisExpire
  }))
}))

describe('rate-limit fallback behavior', () => {
  beforeEach(() => {
    mockRedisIncr.mockReset()
    mockRedisExpire.mockReset()
    _resetMemoryLimiter()
  })

  afterEach(() => {
    delete process.env.POLYMORPH_CLOUD_DEPLOYMENT
    delete process.env.UPSTASH_REDIS_REST_URL
    delete process.env.UPSTASH_REDIS_REST_TOKEN
    delete process.env.DAILY_CHAT_LIMIT
    delete process.env.GUEST_CHAT_DAILY_LIMIT
    vi.resetModules()
  })

  describe('when Redis is not configured (getRedis returns null)', () => {
    it('chat-limits allows requests', async () => {
      process.env.POLYMORPH_CLOUD_DEPLOYMENT = 'true'
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const { checkAndEnforceOverallChatLimit } =
        await import('@/lib/rate-limit/chat-limits')
      const response = await checkAndEnforceOverallChatLimit('user-123')
      expect(response).toBeNull()
    })

    it('guest-limit allows requests', async () => {
      process.env.POLYMORPH_CLOUD_DEPLOYMENT = 'true'
      delete process.env.UPSTASH_REDIS_REST_URL
      delete process.env.UPSTASH_REDIS_REST_TOKEN

      const { checkAndEnforceGuestLimit } =
        await import('@/lib/rate-limit/guest-limit')
      const response = await checkAndEnforceGuestLimit('1.2.3.4')
      expect(response).toBeNull()
    })
  })

  describe('when Redis operations throw (configured but unreachable)', () => {
    beforeEach(() => {
      process.env.POLYMORPH_CLOUD_DEPLOYMENT = 'true'
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.com'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    })

    it('chat-limits activates in-memory limiter and blocks rapid requests', async () => {
      mockRedisIncr.mockRejectedValue(new Error('Connection refused'))

      const { checkAndEnforceOverallChatLimit } =
        await import('@/lib/rate-limit/chat-limits')

      // First request — in-memory limiter allows it
      const first = await checkAndEnforceOverallChatLimit('user-456')
      expect(first).toBeNull()

      // Second request within same window — in-memory limiter blocks it
      const second = await checkAndEnforceOverallChatLimit('user-456')
      expect(second).not.toBeNull()
      expect(second?.status).toBe(429)
    })

    it('guest-limit activates in-memory limiter and blocks rapid requests', async () => {
      mockRedisIncr.mockRejectedValue(new Error('Connection refused'))

      const { checkAndEnforceGuestLimit } =
        await import('@/lib/rate-limit/guest-limit')

      // First request — in-memory limiter allows it
      const first = await checkAndEnforceGuestLimit('5.6.7.8')
      expect(first).toBeNull()

      // Second request within same window — in-memory limiter blocks it
      const second = await checkAndEnforceGuestLimit('5.6.7.8')
      expect(second).not.toBeNull()
      expect(second?.status).toBe(429)
    })
  })

  describe('in-memory limiter', () => {
    it('allows first request and blocks second within window', () => {
      const first = checkMemoryLimit('test-key')
      expect(first.allowed).toBe(true)
      expect(first.remaining).toBe(0)

      const second = checkMemoryLimit('test-key')
      expect(second.allowed).toBe(false)
      expect(second.remaining).toBe(0)
    })

    it('resets after window expires', () => {
      vi.useFakeTimers()

      const first = checkMemoryLimit('expiry-key')
      expect(first.allowed).toBe(true)

      const second = checkMemoryLimit('expiry-key')
      expect(second.allowed).toBe(false)

      // Advance past the 10-second window
      vi.advanceTimersByTime(11_000)

      const third = checkMemoryLimit('expiry-key')
      expect(third.allowed).toBe(true)

      vi.useRealTimers()
    })

    it('tracks different keys independently', () => {
      const a1 = checkMemoryLimit('key-a')
      const b1 = checkMemoryLimit('key-b')
      expect(a1.allowed).toBe(true)
      expect(b1.allowed).toBe(true)

      const a2 = checkMemoryLimit('key-a')
      const b2 = checkMemoryLimit('key-b')
      expect(a2.allowed).toBe(false)
      expect(b2.allowed).toBe(false)
    })
  })

  describe('DAILY_CHAT_LIMIT env var', () => {
    beforeEach(() => {
      process.env.POLYMORPH_CLOUD_DEPLOYMENT = 'true'
      process.env.UPSTASH_REDIS_REST_URL = 'https://example.com'
      process.env.UPSTASH_REDIS_REST_TOKEN = 'token'
    })

    it('defaults to 100 when env var is not set', async () => {
      delete process.env.DAILY_CHAT_LIMIT
      mockRedisIncr.mockResolvedValue(101)
      mockRedisExpire.mockResolvedValue(1)

      const { checkAndEnforceOverallChatLimit } =
        await import('@/lib/rate-limit/chat-limits')

      const response = await checkAndEnforceOverallChatLimit('user-default')
      expect(response).not.toBeNull()
      expect(response?.status).toBe(429)
      const body = await response!.json()
      expect(body.limit).toBe(100)
    })

    it('reads custom limit from env var', async () => {
      process.env.DAILY_CHAT_LIMIT = '50'
      mockRedisIncr.mockResolvedValue(51)
      mockRedisExpire.mockResolvedValue(1)

      const { checkAndEnforceOverallChatLimit } =
        await import('@/lib/rate-limit/chat-limits')

      const response = await checkAndEnforceOverallChatLimit('user-custom')
      expect(response).not.toBeNull()
      expect(response?.status).toBe(429)
      const body = await response!.json()
      expect(body.limit).toBe(50)
    })

    it('falls back to default for invalid env var values', async () => {
      process.env.DAILY_CHAT_LIMIT = 'not-a-number'
      mockRedisIncr.mockResolvedValue(101)
      mockRedisExpire.mockResolvedValue(1)

      const { checkAndEnforceOverallChatLimit } =
        await import('@/lib/rate-limit/chat-limits')

      const response = await checkAndEnforceOverallChatLimit('user-invalid')
      expect(response).not.toBeNull()
      const body = await response!.json()
      expect(body.limit).toBe(100)
    })
  })
})

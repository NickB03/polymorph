import { isCloudDeployment } from '@/lib/utils'

import { checkMemoryLimit } from './memory-limiter'
import { getRedis } from './redis'

export interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}

/**
 * Per-minute rate limiter using Redis with in-memory fallback.
 * Allows unlimited when not in cloud deployment or Redis is unavailable.
 */
export async function checkPerMinuteLimit(
  keyPrefix: string,
  identifier: string,
  limit: number
): Promise<RateLimitResult> {
  if (!isCloudDeployment()) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit }
  }

  const redis = getRedis()
  if (!redis) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit }
  }

  try {
    const minuteKey = Math.floor(Date.now() / 60_000)
    const key = `rl:${keyPrefix}:${identifier}:${minuteKey}`

    let timeout: ReturnType<typeof setTimeout> | undefined
    const count = await Promise.race([
      redis.incr(key),
      new Promise<number>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('Redis timeout')), 3000)
      })
    ]).finally(() => {
      if (timeout) clearTimeout(timeout)
    })

    if (count === 1) {
      await redis.expire(key, 120) // 2 minutes TTL to cover edge of window
    }

    const remaining = Math.max(0, limit - count)
    const resetAt = (minuteKey + 1) * 60_000

    return { allowed: count <= limit, remaining, resetAt, limit }
  } catch (error) {
    console.warn(
      `Redis unreachable for ${keyPrefix} limit, using in-memory fallback:`,
      error
    )
    const fallback = checkMemoryLimit(`${keyPrefix}:${identifier}`)
    return {
      allowed: fallback.allowed,
      remaining: fallback.remaining,
      resetAt: fallback.resetAt,
      limit
    }
  }
}

/**
 * Check a per-minute rate limit and return a 429 Response if exceeded,
 * or null if the request is allowed.
 */
export async function enforcePerMinuteLimit(
  keyPrefix: string,
  identifier: string,
  limit: number,
  errorMessage: string
): Promise<Response | null> {
  const result = await checkPerMinuteLimit(keyPrefix, identifier, limit)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        code: 'RATE_LIMIT',
        error: errorMessage,
        remaining: 0,
        resetAt: result.resetAt,
        limit: result.limit
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(result.limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt)
        }
      }
    )
  }

  return null
}

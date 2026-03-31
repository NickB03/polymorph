import { isCloudDeployment } from '@/lib/utils'

import { checkMemoryLimit } from './memory-limiter'
import { getRedis } from './redis'

// Per-user / per-IP rate limit for voice TTS synthesis
const VOICE_SYNTHESIZE_LIMIT_PER_MINUTE = 30

async function checkVoiceLimit(identifier: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}> {
  const limit = VOICE_SYNTHESIZE_LIMIT_PER_MINUTE

  if (!isCloudDeployment()) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit }
  }

  const redis = getRedis()
  if (!redis) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit }
  }

  try {
    const minuteKey = Math.floor(Date.now() / 60_000)
    const key = `rl:voice:synthesize:${identifier}:${minuteKey}`

    const count = await Promise.race([
      redis.incr(key),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000)
      )
    ])

    if (count === 1) {
      await redis.expire(key, 120) // 2 minutes TTL to cover edge of window
    }

    const remaining = Math.max(0, limit - count)
    const resetAt = (minuteKey + 1) * 60_000

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
      limit
    }
  } catch (error) {
    console.warn(
      'Redis unreachable for voice limit, using in-memory fallback:',
      error
    )
    const fallback = checkMemoryLimit(`voice:synthesize:${identifier}`)
    return {
      allowed: fallback.allowed,
      remaining: fallback.remaining,
      resetAt: fallback.resetAt,
      limit
    }
  }
}

/**
 * Check and enforce the voice TTS rate limit.
 * Returns a 429 Response if the limit is exceeded, null if allowed.
 */
export async function checkAndEnforceVoiceLimit(
  identifier: string
): Promise<Response | null> {
  const result = await checkVoiceLimit(identifier)

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        code: 'RATE_LIMIT',
        error: 'Voice synthesis rate limit exceeded. Please try again shortly.',
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

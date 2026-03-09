import { isCloudDeployment } from '@/lib/utils'
import { perfLog } from '@/lib/utils/perf-logging'

import { checkMemoryLimit } from './memory-limiter'
import { getRedis } from './redis'

const DEFAULT_DAILY_CHAT_LIMIT = 100

function getDailyChatLimit(): number {
  const raw = process.env.DAILY_CHAT_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_DAILY_CHAT_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_DAILY_CHAT_LIMIT
  }
  return Math.floor(parsed)
}

/**
 * Get seconds until next midnight UTC
 */
function getSecondsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}

/**
 * Get timestamp of next midnight UTC
 */
function getNextMidnightTimestamp(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime()
}

async function checkOverallChatLimit(userId: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
}> {
  // If not in cloud deployment mode, allow unlimited requests
  if (!isCloudDeployment()) {
    return { allowed: true, remaining: Infinity, resetAt: 0 }
  }

  const redis = getRedis()

  // Redis not configured (e.g. local dev without Upstash) — allow all
  if (!redis) {
    return { allowed: true, remaining: Infinity, resetAt: 0 }
  }

  const limit = getDailyChatLimit()

  try {
    const dateKey = new Date().toISOString().split('T')[0] // YYYY-MM-DD
    const key = `rl:chat:${userId}:${dateKey}`

    const count = await Promise.race([
      redis.incr(key),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000)
      )
    ])

    if (count === 1) {
      const secondsUntilMidnight = getSecondsUntilMidnight()
      await redis.expire(key, secondsUntilMidnight)
    }

    const remaining = Math.max(0, limit - count)
    const resetAt = getNextMidnightTimestamp()

    return {
      allowed: count <= limit,
      remaining,
      resetAt
    }
  } catch (error) {
    // Redis configured but unreachable — fail closed with in-memory fallback
    console.warn('Redis unreachable, using in-memory rate limiter:', error)
    const fallback = checkMemoryLimit(`chat:${userId}`)
    return {
      allowed: fallback.allowed,
      remaining: fallback.remaining,
      resetAt: fallback.resetAt
    }
  }
}

/**
 * Check and enforce chat rate limit
 * Returns a 429 Response if limit is exceeded, null if allowed
 */
export async function checkAndEnforceOverallChatLimit(
  userId: string
): Promise<Response | null> {
  const result = await checkOverallChatLimit(userId)

  const limit = getDailyChatLimit()

  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        code: 'RATE_LIMIT',
        error: 'Daily chat limit reached. Please try again tomorrow.',
        remaining: 0,
        resetAt: result.resetAt,
        limit
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt)
        }
      }
    )
  }

  perfLog(`Chat usage: ${limit - result.remaining}/${limit}`)

  return null
}

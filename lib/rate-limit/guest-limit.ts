import { isCloudDeployment } from '@/lib/utils'

import { getRedis } from './redis'

const DEFAULT_GUEST_DAILY_LIMIT = 10

function getGuestDailyLimit(): number {
  const raw = process.env.GUEST_CHAT_DAILY_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_GUEST_DAILY_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_GUEST_DAILY_LIMIT
  }
  return Math.floor(parsed)
}

function getSecondsUntilMidnight(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return Math.floor((midnight.getTime() - now.getTime()) / 1000)
}

function getNextMidnightTimestamp(): number {
  const now = new Date()
  const midnight = new Date(now)
  midnight.setUTCHours(24, 0, 0, 0)
  return midnight.getTime()
}

async function checkGuestLimit(ip: string): Promise<{
  allowed: boolean
  remaining: number
  resetAt: number
  limit: number
}> {
  if (!isCloudDeployment()) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit: 0 }
  }

  const redis = getRedis()
  if (!redis) {
    return { allowed: true, remaining: Infinity, resetAt: 0, limit: 0 }
  }

  try {
    const dateKey = new Date().toISOString().split('T')[0]
    const key = `rl:guest:chat:${ip}:${dateKey}`
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

    const limit = getGuestDailyLimit()
    const remaining = Math.max(0, limit - count)
    const resetAt = getNextMidnightTimestamp()

    return {
      allowed: count <= limit,
      remaining,
      resetAt,
      limit
    }
  } catch (error) {
    console.error('Guest rate limit check failed:', error)
    return { allowed: true, remaining: Infinity, resetAt: 0, limit: 0 }
  }
}

export async function checkAndEnforceGuestLimit(
  ip: string | null
): Promise<Response | null> {
  if (!ip) return null

  const result = await checkGuestLimit(ip)
  if (!result.allowed) {
    return new Response(
      JSON.stringify({
        code: 'GUEST_LIMIT',
        error:
          'You\u2019ve reached your daily search limit. Create a free account for unlimited access, or come back tomorrow.',
        remaining: 0,
        resetAt: result.resetAt,
        limit: result.limit
      }),
      {
        status: 429,
        statusText: 'Too Many Requests',
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

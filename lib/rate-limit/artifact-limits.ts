import { isCloudDeployment } from '@/lib/utils'

import { checkMemoryLimit } from './memory-limiter'
import { getRedis } from './redis'

/** Default: 10 artifact creations per hour per guest session. */
const DEFAULT_CREATE_LIMIT = 10
/** Default: 30 artifact actions (refresh/retry) per hour per session. */
const DEFAULT_ACTION_LIMIT = 30
/** Sliding window: 1 hour in seconds. */
const WINDOW_SECONDS = 3600

/**
 * Result of an artifact rate-limit check.
 *
 * Security invariant: when `allowed` is false the caller MUST reject the
 * request. No user-facing quota UI is shown — this is an invisible guardrail.
 */
export interface ArtifactRateLimitResult {
  allowed: boolean
  remaining?: number
}

function getLimitForType(type: 'create' | 'action'): number {
  if (type === 'create') {
    const raw = process.env.ARTIFACT_CREATE_HOURLY_LIMIT
    const parsed = raw ? Number(raw) : DEFAULT_CREATE_LIMIT
    if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_CREATE_LIMIT
    return Math.floor(parsed)
  }
  const raw = process.env.ARTIFACT_ACTION_HOURLY_LIMIT
  const parsed = raw ? Number(raw) : DEFAULT_ACTION_LIMIT
  if (!Number.isFinite(parsed) || parsed <= 0) return DEFAULT_ACTION_LIMIT
  return Math.floor(parsed)
}

/**
 * Check whether an artifact operation is allowed under rate limits.
 *
 * Uses the same Upstash Redis pattern as the existing chat rate limiter
 * with an in-memory fallback when Redis is unreachable.
 *
 * Security invariants:
 * - Non-cloud deployments are always allowed (development convenience).
 * - When Redis is configured but unreachable, falls back to the
 *   conservative in-memory limiter (1 req / 10 s per key).
 * - Returns a structured result — callers decide how to surface errors.
 *
 * @param type - `'create'` for new artifact creation, `'action'` for
 *   refresh, retry, or other artifact interactions.
 * @param identifier - Opaque key identifying the session (IP, guest token
 *   fingerprint, or userId).
 */
export async function checkArtifactRateLimit(
  type: 'create' | 'action',
  identifier: string
): Promise<ArtifactRateLimitResult> {
  if (!isCloudDeployment()) {
    return { allowed: true }
  }

  const redis = getRedis()
  if (!redis) {
    return { allowed: true }
  }

  const limit = getLimitForType(type)

  try {
    // Hourly sliding window keyed by the current UTC hour
    const hourKey = new Date().toISOString().slice(0, 13) // YYYY-MM-DDTHH
    const key = `rl:artifact:${type}:${identifier}:${hourKey}`

    const count = await Promise.race([
      redis.incr(key),
      new Promise<number>((_, reject) =>
        setTimeout(() => reject(new Error('Redis timeout')), 3000)
      )
    ])

    // Set expiry on first increment so the key auto-cleans
    if (count === 1) {
      await redis.expire(key, WINDOW_SECONDS)
    }

    const remaining = Math.max(0, limit - count)

    return {
      allowed: count <= limit,
      remaining
    }
  } catch {
    // Redis unreachable — conservative in-memory fallback
    const fallback = checkMemoryLimit(`artifact:${type}:${identifier}`)
    return {
      allowed: fallback.allowed,
      remaining: fallback.remaining
    }
  }
}

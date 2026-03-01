import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

/**
 * Lazy singleton for the Upstash Redis client used by rate-limit modules.
 * Returns null when the required env vars are missing.
 */
export function getRedis(): Redis | null {
  if (
    !process.env.UPSTASH_REDIS_REST_URL ||
    !process.env.UPSTASH_REDIS_REST_TOKEN
  ) {
    return null
  }
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    })
  }
  return _redis
}

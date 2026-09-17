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

// INCR and EXPIRE in one atomic server-side step. Done as two round trips the
// counter can survive a failure between them (the INCR lands, the EXPIRE never
// runs) and the key then never expires, locking the identifier out forever.
const INCR_WITH_TTL_SCRIPT = `
local count = redis.call('INCR', KEYS[1])
if count == 1 then
  redis.call('EXPIRE', KEYS[1], ARGV[1])
end
return count
`

export async function incrWithTtl(
  redis: Redis,
  key: string,
  ttlSeconds: number
): Promise<number> {
  return redis.eval(INCR_WITH_TTL_SCRIPT, [key], [ttlSeconds])
}

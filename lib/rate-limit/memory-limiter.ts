/**
 * Simple in-memory rate limiter used as a fallback when Redis is configured
 * but unreachable. Conservative limit: 1 request per 10 seconds per key.
 */

interface Entry {
  count: number
  resetAt: number
}

const WINDOW_MS = 10_000 // 10 seconds
const MAX_REQUESTS = 1

const store = new Map<string, Entry>()

let cleanupTimer: ReturnType<typeof setInterval> | null = null

function ensureCleanupTimer() {
  if (cleanupTimer) return
  cleanupTimer = setInterval(() => {
    const now = Date.now()
    for (const [key, entry] of store) {
      if (now >= entry.resetAt) {
        store.delete(key)
      }
    }
    if (store.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer)
      cleanupTimer = null
    }
  }, 30_000) // cleanup every 30 seconds
  // Allow the process to exit even if the timer is still running
  if (
    cleanupTimer &&
    typeof cleanupTimer === 'object' &&
    'unref' in cleanupTimer
  ) {
    cleanupTimer.unref()
  }
}

/**
 * Check whether a request should be allowed under the in-memory fallback
 * rate limiter. Returns { allowed, remaining, resetAt }.
 */
export function checkMemoryLimit(key: string): {
  allowed: boolean
  remaining: number
  resetAt: number
} {
  const now = Date.now()
  const existing = store.get(key)

  // Window expired or no entry — start a fresh window
  if (!existing || now >= existing.resetAt) {
    const resetAt = now + WINDOW_MS
    store.set(key, { count: 1, resetAt })
    ensureCleanupTimer()
    return { allowed: true, remaining: MAX_REQUESTS - 1, resetAt }
  }

  // Within window — increment
  existing.count += 1
  const allowed = existing.count <= MAX_REQUESTS
  const remaining = Math.max(0, MAX_REQUESTS - existing.count)

  return { allowed, remaining, resetAt: existing.resetAt }
}

/**
 * Reset the in-memory store. Exposed for testing only.
 */
export function _resetMemoryLimiter() {
  store.clear()
  if (cleanupTimer) {
    clearInterval(cleanupTimer)
    cleanupTimer = null
  }
}

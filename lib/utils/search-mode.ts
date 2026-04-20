import type { UserMode } from '@/lib/types/search'
import { isValidUserMode } from '@/lib/types/search'
import { getCookie, setCookie } from '@/lib/utils/cookies'

const SEARCH_MODE_COOKIE = 'searchMode'

/**
 * Atomically update the searchMode cookie and notify listeners.
 * This ensures the cookie and the CustomEvent dispatch are never out of sync.
 *
 * The cookie stores the UI-facing `UserMode` ('search' | 'research' | 'build').
 * Backend code is responsible for deriving the `SearchMode` via
 * `toSearchMode()` when it reads the cookie.
 */
export function syncSearchMode(mode: UserMode) {
  setCookie(SEARCH_MODE_COOKIE, mode)
  window.dispatchEvent(new CustomEvent('searchModeChanged'))
}

/**
 * Read the `searchMode` cookie and coerce it into a `UserMode`, mapping
 * legacy values written by prior versions of the selector.
 *
 * Legacy mappings:
 *   - 'quick'    → 'search'
 *   - 'chat'     → 'search'
 *   - 'adaptive' → 'research'
 *
 * Unrecognized or missing values fall back to 'search'.
 */
export function readSearchModeCookie(): UserMode {
  const raw = getCookie(SEARCH_MODE_COOKIE)
  return mapSearchModeCookieValue(raw)
}

/**
 * Pure mapper exposed for consumers that already have the cookie value in
 * hand (e.g. server-side `cookies().get('searchMode')`).
 */
export function mapSearchModeCookieValue(
  raw: string | null | undefined
): UserMode {
  if (!raw) return 'search'
  if (raw === 'quick' || raw === 'chat') return 'search'
  if (raw === 'adaptive') return 'research'
  if (isValidUserMode(raw)) return raw
  return 'search'
}

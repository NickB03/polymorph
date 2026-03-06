import type { SearchMode } from '@/lib/types/search'
import { setCookie } from '@/lib/utils/cookies'

/**
 * Atomically update the searchMode cookie and notify listeners.
 * This ensures the cookie and the CustomEvent dispatch are never out of sync.
 */
export function syncSearchMode(mode: SearchMode) {
  setCookie('searchMode', mode)
  window.dispatchEvent(new CustomEvent('searchModeChanged'))
}

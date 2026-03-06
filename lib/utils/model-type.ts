import type { ModelType } from '@/lib/types/model-type'
import { setCookie } from '@/lib/utils/cookies'

/**
 * Atomically update the modelType cookie and notify listeners.
 * This ensures the cookie and the CustomEvent dispatch are never out of sync.
 */
export function syncModelType(type: ModelType) {
  setCookie('modelType', type)
  window.dispatchEvent(new CustomEvent('modelTypeChanged'))
}

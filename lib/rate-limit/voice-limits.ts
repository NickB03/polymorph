import { enforcePerMinuteLimit } from './per-minute-limiter'

const VOICE_SYNTHESIZE_LIMIT_PER_MINUTE = 30

/**
 * Check and enforce the voice TTS rate limit.
 * Returns a 429 Response if the limit is exceeded, null if allowed.
 */
export async function checkAndEnforceVoiceLimit(
  identifier: string
): Promise<Response | null> {
  return enforcePerMinuteLimit(
    'voice:synthesize',
    identifier,
    VOICE_SYNTHESIZE_LIMIT_PER_MINUTE,
    'Voice synthesis rate limit exceeded. Please try again shortly.'
  )
}

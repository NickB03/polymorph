import { checkPerMinuteLimit, RateLimitResult } from './per-minute-limiter'

const FEEDBACK_SUBMIT_LIMIT_PER_MINUTE = 5
const MESSAGE_FEEDBACK_LIMIT_PER_MINUTE = 30

/**
 * Check the site-feedback submission rate limit. Returns the raw result
 * because the caller is a server action and cannot return a Response.
 */
export async function checkFeedbackLimit(
  identifier: string
): Promise<RateLimitResult> {
  return checkPerMinuteLimit(
    'feedback:submit',
    identifier,
    FEEDBACK_SUBMIT_LIMIT_PER_MINUTE
  )
}

/**
 * Check the per-message thumbs up/down rate limit. Separate bucket from the
 * site-feedback form: rating many messages quickly is normal.
 */
export async function checkMessageFeedbackLimit(
  identifier: string
): Promise<RateLimitResult> {
  return checkPerMinuteLimit(
    'feedback:message',
    identifier,
    MESSAGE_FEEDBACK_LIMIT_PER_MINUTE
  )
}

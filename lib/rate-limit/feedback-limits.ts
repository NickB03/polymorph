import { checkPerMinuteLimit, RateLimitResult } from './per-minute-limiter'

const FEEDBACK_SUBMIT_LIMIT_PER_MINUTE = 5

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

import { enforcePerMinuteLimit } from './per-minute-limiter'

const CANVAS_DRAFT_LIMIT_PER_MINUTE = 30
const CANVAS_VERSION_LIMIT_PER_MINUTE = 10
const CANVAS_RESTORE_LIMIT_PER_MINUTE = 10
const CANVAS_DIAGNOSTICS_LIMIT_PER_MINUTE = 60
const CANVAS_IMAGE_PROXY_LIMIT_PER_MINUTE = 60

type CanvasRateLimitKind =
  | 'draft'
  | 'version'
  | 'restore'
  | 'runtime-diagnostics'
  | 'image-proxy'

function getLimitForKind(kind: CanvasRateLimitKind): number {
  switch (kind) {
    case 'draft':
      return CANVAS_DRAFT_LIMIT_PER_MINUTE
    case 'version':
      return CANVAS_VERSION_LIMIT_PER_MINUTE
    case 'restore':
      return CANVAS_RESTORE_LIMIT_PER_MINUTE
    case 'runtime-diagnostics':
      return CANVAS_DIAGNOSTICS_LIMIT_PER_MINUTE
    case 'image-proxy':
      return CANVAS_IMAGE_PROXY_LIMIT_PER_MINUTE
  }
}

/**
 * Check and enforce a canvas rate limit.
 * Returns a 429 Response if the limit is exceeded, null if allowed.
 */
export async function checkAndEnforceCanvasLimit(
  identifier: string,
  kind: CanvasRateLimitKind
): Promise<Response | null> {
  return enforcePerMinuteLimit(
    `canvas:${kind}`,
    identifier,
    getLimitForKind(kind),
    `Canvas ${kind} rate limit exceeded. Please try again shortly.`
  )
}

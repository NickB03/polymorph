/**
 * Artifact-specific error codes.
 *
 * These map to structured error responses in the chat API route.
 * Each code has a corresponding HTTP status:
 * - `build-failed` (502) — artifact build step failed in the sandbox.
 * - `runtime-unavailable` (503) — E2B runtime could not be reached.
 * - `preview-expired` (410) — preview URL is no longer valid.
 */
export type ArtifactErrorCode =
  | 'build-failed'
  | 'runtime-unavailable'
  | 'preview-expired'

const ERROR_STATUS_MAP: Record<ArtifactErrorCode, number> = {
  'build-failed': 502,
  'runtime-unavailable': 503,
  'preview-expired': 410
}

/**
 * Structured error for artifact-specific failures.
 *
 * Thrown from the streaming layer and caught by the chat API route
 * to return the appropriate HTTP status and error code.
 *
 * Security invariant: error messages are safe to return to clients.
 * Internal details (stack traces, sandbox IDs) are NOT included in
 * the message — use `cause` for internal diagnostics.
 */
export class ArtifactError extends Error {
  readonly artifactErrorCode: ArtifactErrorCode
  readonly httpStatus: number

  constructor(
    code: ArtifactErrorCode,
    message: string,
    options?: { cause?: unknown }
  ) {
    super(message, options)
    this.name = 'ArtifactError'
    this.artifactErrorCode = code
    this.httpStatus = ERROR_STATUS_MAP[code]
  }
}

/**
 * Type guard for ArtifactError instances.
 *
 * Checks both `instanceof` and the presence of `artifactErrorCode`
 * to handle cross-realm or serialization edge cases.
 */
export function isArtifactError(error: unknown): error is ArtifactError {
  if (error instanceof ArtifactError) return true
  return (
    error instanceof Error &&
    'artifactErrorCode' in error &&
    typeof (error as ArtifactError).artifactErrorCode === 'string'
  )
}

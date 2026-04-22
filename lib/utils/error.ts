/**
 * Coerce an unknown value (typically a caught error) to a string message.
 * Mirrors the `error instanceof Error ? error.message : String(error)` pattern
 * duplicated across the codebase.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

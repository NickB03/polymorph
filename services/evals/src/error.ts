/**
 * Coerce an unknown value (typically a caught error) to a string message.
 *
 * Mirrors `lib/utils/error.ts` at the repo root. Duplicated here because the
 * evals service has its own tsconfig with `rootDir: "src"` and cannot import
 * from outside its own source tree.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

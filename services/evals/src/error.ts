import type { SuiteRunResult } from './types'

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

/**
 * Carries the SuiteRunResult through a DB-write failure so the orchestrator
 * can still apply threshold-breach exit logic. Without this the breach signal
 * is lost when persistEvalSummary throws — see `.claude/rules/operations.md`.
 */
export class EvalSummaryPersistError extends Error {
  readonly result: SuiteRunResult

  constructor(message: string, result: SuiteRunResult) {
    super(message)
    this.name = 'EvalSummaryPersistError'
    this.result = result
  }
}

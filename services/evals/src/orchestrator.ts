import { runCapabilitySuite } from './runners/capability'
import { runRegressionSuite } from './runners/regression'
import { assertSmokeHealthy, runSmokeSuite } from './runners/smoke'
import { runTrafficMonitorSuite } from './runners/traffic-monitor'
import { config } from './config'
import { EvalSummaryPersistError } from './error'
import type { SuiteRunResult } from './types'

function maybeAddResult(
  results: SuiteRunResult[],
  result: SuiteRunResult | null | undefined
) {
  if (result) {
    results.push(result)
  }
}

function formatThresholdBreachExitMessage(results: SuiteRunResult[]) {
  const summaries = results
    .filter(result => result.status === 'threshold_breached')
    .map(
      result =>
        `${result.suite} ${(result.passRate * 100).toFixed(1)}% < ${(result.threshold * 100).toFixed(1)}%`
    )

  return `[evals] Threshold breach exit requested: ${summaries.join('; ')}`
}

// Collapse N persist errors into a single value safe to use as Error.cause or to
// throw directly: undefined when there are none, the lone error when there is
// exactly one, or an AggregateError preserving every entry when there are more.
// AggregateError is the standard JS construct for "multiple errors that all
// caused this," so callers can enumerate via `.errors` instead of walking a
// hand-built cause chain.
function buildPersistCause(
  persistErrors: EvalSummaryPersistError[]
): EvalSummaryPersistError | AggregateError | undefined {
  if (persistErrors.length === 0) return undefined
  if (persistErrors.length === 1) return persistErrors[0]
  return new AggregateError(
    persistErrors,
    `[evals] ${persistErrors.length} eval summary persistence failures`
  )
}

export async function runConfiguredModes(): Promise<SuiteRunResult[]> {
  const results: SuiteRunResult[] = []
  const persistErrors: EvalSummaryPersistError[] = []

  async function runAndRecord(
    runner: () => Promise<SuiteRunResult | null | undefined>
  ) {
    try {
      maybeAddResult(results, await runner())
    } catch (error) {
      if (error instanceof EvalSummaryPersistError) {
        results.push(error.result)
        persistErrors.push(error)
        return
      }
      throw error
    }
  }

  switch (config.evalRunMode) {
    case 'capability':
      await runAndRecord(runCapabilitySuite)
      break
    case 'regression':
      await runAndRecord(runRegressionSuite)
      break
    case 'traffic-monitor':
      await runAndRecord(runTrafficMonitorSuite)
      break
    case 'smoke':
      assertSmokeHealthy(await runSmokeSuite())
      break
    case 'all':
      await runAndRecord(runCapabilitySuite)
      await runAndRecord(runRegressionSuite)
      await runAndRecord(runTrafficMonitorSuite)
      await runAndRecord(async () => {
        assertSmokeHealthy(await runSmokeSuite())
        return null
      })
      break
  }

  if (
    config.exitOnThresholdBreach &&
    results.some(result => result.status === 'threshold_breached')
  ) {
    if (persistErrors.length > 0) {
      console.error(
        `[evals] Threshold breach AND ${persistErrors.length} DB-write failure(s) attached as cause`
      )
    }
    throw new Error(formatThresholdBreachExitMessage(results), {
      cause: buildPersistCause(persistErrors)
    })
  }

  if (persistErrors.length === 1) {
    throw persistErrors[0]
  }
  if (persistErrors.length > 1) {
    console.error(
      `[evals] ${persistErrors.length} DB-write failures occurred; throwing AggregateError`
    )
    throw new AggregateError(
      persistErrors,
      `[evals] ${persistErrors.length} eval summary persistence failures`
    )
  }

  return results
}

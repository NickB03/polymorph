import { runCapabilitySuite } from './runners/capability'
import { runRegressionSuite } from './runners/regression'
import { runSmokeSuite } from './runners/smoke'
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
      await runSmokeSuite()
      break
    case 'all':
      await runAndRecord(runCapabilitySuite)
      await runAndRecord(runRegressionSuite)
      await runAndRecord(runTrafficMonitorSuite)
      await runSmokeSuite()
      break
  }

  if (
    config.exitOnThresholdBreach &&
    results.some(result => result.status === 'threshold_breached')
  ) {
    if (persistErrors.length > 0) {
      console.error(
        `[evals] Threshold breach AND ${persistErrors.length} DB-write failure(s) — see cause chain`
      )
    }
    throw new Error(formatThresholdBreachExitMessage(results), {
      cause: persistErrors[0]
    })
  }

  if (persistErrors.length > 0) {
    if (persistErrors.length > 1) {
      console.error(
        `[evals] ${persistErrors.length} DB-write failures occurred; first is thrown, rest on cause chain`
      )
      // Chain subsequent errors onto the first via cause.
      let head: Error = persistErrors[0]
      for (let i = 1; i < persistErrors.length; i++) {
        const next: Error = persistErrors[i]
        ;(next as Error & { cause?: unknown }).cause = undefined
        ;(head as Error & { cause?: unknown }).cause = next
        head = next
      }
    }
    throw persistErrors[0]
  }

  return results
}

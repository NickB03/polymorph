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
    throw new Error(formatThresholdBreachExitMessage(results))
  }

  if (persistErrors.length > 0) {
    throw persistErrors[0]
  }

  return results
}

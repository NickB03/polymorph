import { runCapabilitySuite } from './runners/capability'
import { runRegressionSuite } from './runners/regression'
import { runSmokeSuite } from './runners/smoke'
import { runTrafficMonitorSuite } from './runners/traffic-monitor'
import { config } from './config'
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

  switch (config.evalRunMode) {
    case 'capability':
      maybeAddResult(results, await runCapabilitySuite())
      break
    case 'regression':
      maybeAddResult(results, await runRegressionSuite())
      break
    case 'traffic-monitor':
      maybeAddResult(results, await runTrafficMonitorSuite())
      break
    case 'smoke':
      await runSmokeSuite()
      break
    case 'all':
      maybeAddResult(results, await runCapabilitySuite())
      maybeAddResult(results, await runRegressionSuite())
      maybeAddResult(results, await runTrafficMonitorSuite())
      await runSmokeSuite()
      break
  }

  if (
    config.exitOnThresholdBreach &&
    results.some(result => result.status === 'threshold_breached')
  ) {
    throw new Error(formatThresholdBreachExitMessage(results))
  }

  return results
}

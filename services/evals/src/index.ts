import { closeDb } from './db'
import { validateJudgeCredentials } from './judge-config'
import { runConfiguredModes } from './orchestrator'
import type { SuiteRunResult } from './types'

export async function main(): Promise<SuiteRunResult[]> {
  const startTime = Date.now()
  console.log(`[evals] Starting evaluation run at ${new Date().toISOString()}`)

  // Fail fast if judge credentials are missing or invalid
  validateJudgeCredentials()
  console.log('[evals] Config loaded, credentials validated')

  try {
    const results = await runConfiguredModes()
    const thresholdBreaches = results.filter(
      result => result.status === 'threshold_breached'
    )
    if (thresholdBreaches.length > 0) {
      console.warn(
        `[evals] Completed with ${thresholdBreaches.length} threshold breach alert(s)`
      )
    }
    return results
  } finally {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[evals] Done in ${elapsed}s`)
    await closeDb().catch(() => {})
  }
}

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main().catch(async err => {
    console.error('[evals] Fatal error:', err)
    await closeDb().catch(() => {})
    process.exit(1)
  })
}

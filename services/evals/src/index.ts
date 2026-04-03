import { formatContext } from './runners/traffic-monitor'
import { closeDb } from './db'
import { runConfiguredModes } from './orchestrator'

export async function main() {
  const startTime = Date.now()
  console.log(`[evals] Starting evaluation run at ${new Date().toISOString()}`)
  console.log('[evals] Config loaded')

  try {
    await runConfiguredModes()
  } finally {
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
    console.log(`[evals] Done in ${elapsed}s`)
    await closeDb().catch(() => {})
  }
}

export { formatContext }

if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  main().catch(async err => {
    console.error('[evals] Fatal error:', err)
    await closeDb().catch(() => {})
    process.exit(1)
  })
}

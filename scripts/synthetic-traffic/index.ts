import { chromium } from 'playwright'

import { runSession } from './runner'
import { pickDailyScenarios } from './scenarios'

async function main() {
  const scenarios = pickDailyScenarios()

  console.log(`=== Synthetic traffic — ${new Date().toISOString()} ===`)
  console.log(`URL: ${process.env.POLYMORPH_URL ?? 'https://polymorph.fyi'}`)
  console.log(
    `Auth: ${process.env.SYNTHETIC_USER_EMAIL ? 'credentials' : 'guest mode'}`
  )
  console.log(`Scenarios: ${scenarios.map(s => s.name).join(', ')}\n`)

  const browser = await chromium.launch({ headless: true })
  let passed = 0
  let failed = 0

  try {
    for (let i = 0; i < scenarios.length; i++) {
      try {
        await runSession(browser, scenarios[i], i)
        passed++
      } catch {
        failed++
        console.error(
          `Session ${i + 1} failed — continuing with remaining sessions\n`
        )
      }

      if (i < scenarios.length - 1) {
        const delay = 5_000 + Math.random() * 10_000
        console.log(
          `Waiting ${Math.round(delay / 1000)}s before next session…\n`
        )
        await new Promise(r => setTimeout(r, delay))
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\n=== Done — ${new Date().toISOString()} ===`)
  console.log(`Passed: ${passed}  Failed: ${failed}`)

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})

import type { Browser } from 'playwright'

import type { Scenario } from './scenarios'

const BASE_URL = process.env.POLYMORPH_URL ?? 'https://polymorph.fyi'
const EMAIL = process.env.SYNTHETIC_USER_EMAIL
const PASSWORD = process.env.SYNTHETIC_USER_PASSWORD

// Per-response timeout — research mode can be slow
const RESPONSE_TIMEOUT_MS = 120_000

async function login(page: import('playwright').Page) {
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' })
  await page.fill('input#email', EMAIL!)
  await page.fill('input#password', PASSWORD!)
  await page.click('button:has-text("Sign In")')
  await page.waitForURL(`${BASE_URL}/`, { timeout: 20_000 })
}

export async function runSession(
  browser: Browser,
  scenario: Scenario,
  sessionIndex: number
): Promise<void> {
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()

  try {
    console.log(`[${sessionIndex + 1}] Starting: ${scenario.name}`)

    if (EMAIL && PASSWORD) {
      await login(page)
    } else {
      // Guest mode — requires ENABLE_GUEST_CHAT=true on the server
      await page.goto(BASE_URL, { waitUntil: 'networkidle' })
    }

    // Confirm the chat input is present (if redirected to /auth/login, credentials are needed)
    const inputVisible = await page
      .waitForSelector('textarea[name="input"]', { timeout: 15_000 })
      .then(() => true)
      .catch(() => false)

    if (!inputVisible) {
      throw new Error(
        `Chat input not found at ${page.url()} — guest mode may be disabled; set SYNTHETIC_USER_EMAIL + SYNTHETIC_USER_PASSWORD`
      )
    }

    for (let t = 0; t < scenario.turns.length; t++) {
      const message = scenario.turns[t]
      console.log(
        `[${sessionIndex + 1}]  turn ${t + 1}: ${message.slice(0, 72)}`
      )

      // Small pre-type pause (more human-like)
      await page.waitForTimeout(400 + Math.random() * 600)
      await page.fill('textarea[name="input"]', message)
      await page.waitForTimeout(200 + Math.random() * 300)

      // Submit via Enter key (matches normal user behaviour)
      await page.keyboard.press('Enter')

      // Wait for streaming to start — button switches to "Stop generating"
      await page.waitForSelector('button[aria-label="Stop generating"]', {
        timeout: 15_000
      })

      // Wait for streaming to finish — button switches back to "Send message"
      await page.waitForSelector('button[aria-label="Send message"]', {
        timeout: RESPONSE_TIMEOUT_MS
      })

      console.log(`[${sessionIndex + 1}]  turn ${t + 1} done`)

      // Pause between turns (reading time)
      if (t < scenario.turns.length - 1) {
        await page.waitForTimeout(2_000 + Math.random() * 3_000)
      }
    }

    console.log(`[${sessionIndex + 1}] Complete: ${scenario.name}`)
  } catch (err) {
    console.error(`[${sessionIndex + 1}] Failed (url=${page.url()}):`, err)
    throw err
  } finally {
    await context.close()
  }
}

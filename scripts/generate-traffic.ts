#!/usr/bin/env bun
/**
 * Synthetic traffic generator — opens a real Chromium browser, logs in to
 * polymorph.fyi, and runs 3 scripted research sessions to seed the production
 * evals pipeline with live traffic.
 *
 * Required env vars:
 *   TRAFFIC_BOT_EMAIL     email of the dedicated bot account
 *   TRAFFIC_BOT_PASSWORD  password of the dedicated bot account
 *
 * Optional:
 *   POLYMORPH_URL  target origin (default: https://polymorph.fyi)
 */

import { chromium, type Page } from 'playwright'

const BASE_URL = (process.env.POLYMORPH_URL ?? 'https://polymorph.fyi').replace(
  /\/$/,
  ''
)
const BOT_EMAIL = process.env.TRAFFIC_BOT_EMAIL
const BOT_PASSWORD = process.env.TRAFFIC_BOT_PASSWORD

// Research mode can take a while — be generous
const RESPONSE_TIMEOUT_MS = 180_000
const BETWEEN_TURNS_MS = 4_000

type Session = {
  name: string
  turns: string[]
}

// Three sessions that cover different use-case vectors the evals care about:
// multi-source research, conceptual explanation, and practical tool comparison.
const SESSIONS: Session[] = [
  {
    name: 'superconductor-research',
    turns: [
      'What is the current scientific consensus on room-temperature superconductors? Are there any credible recent developments worth following?',
      'How does this compare to the LK-99 claims from 2023? What did the peer review process ultimately conclude about those results?'
    ]
  },
  {
    name: 'transformer-attention',
    turns: [
      'Give me an intuitive explanation of how attention mechanisms work in transformer models — no math, just conceptual.',
      'What are the fundamental limits on context window length? Is it purely an engineering tradeoff or are there theoretical ceilings?'
    ]
  },
  {
    name: 'ai-agent-frameworks',
    turns: [
      'What are the most actively maintained open-source frameworks for building AI agents in 2025? How do their tool-calling approaches compare?',
      'What are the common failure modes when chaining multiple tool calls in an agent loop? How are teams handling this in production systems?'
    ]
  }
]

async function login(page: Page): Promise<void> {
  if (!BOT_EMAIL || !BOT_PASSWORD) {
    console.log(
      '[traffic] No credentials set — proceeding as guest (chats may not persist to DB)'
    )
    return
  }

  console.log('[traffic] Navigating to login...')
  await page.goto(`${BASE_URL}/auth/login`, { waitUntil: 'networkidle' })

  // Selectors from components/login-form.tsx: id="email", id="password"
  await page.locator('#email').fill(BOT_EMAIL)
  await page.locator('#password').fill(BOT_PASSWORD)
  await page.getByRole('button', { name: 'Sign In' }).click()

  // Wait for redirect away from /auth/*
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
    timeout: 20_000
  })
  console.log('[traffic] Logged in — now at', page.url())
}

async function sendTurn(page: Page, text: string): Promise<void> {
  // Selectors from components/chat-panel.tsx
  const textarea = page.locator('textarea[aria-label="Message input"]')
  await textarea.waitFor({ state: 'visible', timeout: 15_000 })
  // Textarea is disabled while isLoading; wait for it to be ready
  await page.waitForFunction(
    () => {
      const el = document.querySelector('textarea[aria-label="Message input"]')
      return el !== null && !(el as HTMLTextAreaElement).disabled
    },
    { timeout: 15_000 }
  )

  await textarea.click()
  // fill() sets value and dispatches input/change events React picks up
  await textarea.fill(text)
  await textarea.press('Enter')

  // Wait for the stop button to appear (streaming started)
  await page
    .locator('[aria-label="Stop generating"]')
    .waitFor({ state: 'visible', timeout: 15_000 })

  // Wait for streaming to finish (send button reappears and is enabled)
  await page
    .locator('[aria-label="Send message"]')
    .waitFor({ state: 'visible', timeout: RESPONSE_TIMEOUT_MS })
}

async function runSession(
  page: Page,
  session: Session,
  index: number
): Promise<void> {
  console.log(`\n[traffic] Session ${index + 1}/3: ${session.name}`)

  // Navigate to root to start a fresh chat
  await page.goto(BASE_URL, { waitUntil: 'networkidle' })

  for (let i = 0; i < session.turns.length; i++) {
    const turn = session.turns[i]
    console.log(`[traffic]   turn ${i + 1}: "${turn.slice(0, 72)}…"`)
    await sendTurn(page, turn)
    console.log('[traffic]   response complete')
    if (i < session.turns.length - 1) {
      await page.waitForTimeout(BETWEEN_TURNS_MS)
    }
  }

  console.log(`[traffic] Session "${session.name}" done`)
}

async function main(): Promise<void> {
  const runStart = Date.now()
  console.log(`[traffic] Run started — ${new Date().toISOString()}`)
  console.log(`[traffic] Target: ${BASE_URL}`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: 1280, height: 900 },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  })
  const page = await context.newPage()

  let passed = 0
  let failed = 0
  const errors: string[] = []

  try {
    await login(page)

    for (let i = 0; i < SESSIONS.length; i++) {
      const session = SESSIONS[i]
      try {
        await runSession(page, session, i)
        passed++
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error(`[traffic] ✗ "${session.name}" failed: ${msg}`)
        errors.push(`${session.name}: ${msg}`)
        failed++
        // Best-effort failure screenshot for debugging
        try {
          const screenshotPath = `/tmp/traffic-fail-${session.name}.png`
          await page.screenshot({ path: screenshotPath, fullPage: true })
          console.error(`[traffic]   Screenshot: ${screenshotPath}`)
        } catch {
          // ignore
        }
      }
    }
  } finally {
    await browser.close()
  }

  const elapsed = ((Date.now() - runStart) / 1000).toFixed(1)
  console.log(
    `\n[traffic] Complete — ${passed} passed, ${failed} failed (${elapsed}s)`
  )

  if (errors.length) {
    console.error(
      '[traffic] Failures:\n' + errors.map(e => `  • ${e}`).join('\n')
    )
    process.exit(1)
  }
}

main().catch(err => {
  console.error('[traffic] Fatal:', err)
  process.exit(1)
})

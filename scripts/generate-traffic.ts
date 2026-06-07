#!/usr/bin/env tsx

/**
 * Simulate 3 realistic user sessions against polymorph.fyi (or TRAFFIC_TARGET_URL)
 * to generate production traffic for the eval traffic-monitor suite.
 *
 * Usage:
 *   bun run generate-traffic
 *
 * Environment variables:
 *   TRAFFIC_TARGET_URL   Target site URL (default: https://polymorph.fyi)
 *   POLYMORPH_COOKIES    Auth cookie string — required for sessions to persist
 *                        to the messages table and be sampled by the eval system
 */

import { config as dotenvConfig } from 'dotenv'
import type { BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'

dotenvConfig({ path: '.env.local' })

const TARGET_URL = process.env.TRAFFIC_TARGET_URL ?? 'https://polymorph.fyi'
const SESSION_PAUSE_MS = Number(process.env.SESSION_PAUSE_MS ?? 10_000)
const RESPONSE_TIMEOUT_MS = 120_000

interface Session {
  name: string
  searchMode: 'research' | 'chat'
  modelType: 'speed' | 'quality'
  turns: [string, string]
}

const SESSIONS: Session[] = [
  {
    name: 'Research',
    searchMode: 'research',
    modelType: 'quality',
    turns: [
      'What are the latest breakthroughs in nuclear fusion energy research, and when might commercial fusion power realistically become viable?',
      'What are the main remaining engineering challenges preventing commercial fusion reactors from being deployed at scale?'
    ]
  },
  {
    name: 'Technical',
    searchMode: 'chat',
    modelType: 'speed',
    turns: [
      'Explain the key architectural differences between React Server Components and Client Components, and describe the decision criteria for choosing one over the other.',
      'How does streaming SSR differ from traditional SSR in Next.js, and what are the concrete performance tradeoffs?'
    ]
  },
  {
    name: 'Curiosity',
    searchMode: 'research',
    modelType: 'speed',
    turns: [
      'What does current scientific research say about the relationship between sleep quality and long-term cognitive health?',
      'Which evidence-based practices most reliably improve deep sleep according to recent studies?'
    ]
  }
]

function parseCookies(raw: string, hostname: string) {
  return raw
    .split(';')
    .map(pair => pair.trim())
    .filter(Boolean)
    .map(pair => {
      const eqIdx = pair.indexOf('=')
      if (eqIdx === -1) return null
      return {
        name: pair.slice(0, eqIdx).trim(),
        value: pair.slice(eqIdx + 1).trim(),
        domain: hostname,
        path: '/'
      }
    })
    .filter((c): c is NonNullable<typeof c> => c !== null && c.name.length > 0)
}

async function buildContext(session: Session): Promise<BrowserContext> {
  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36'
  })

  const { hostname } = new URL(TARGET_URL)

  const rawCookies = process.env.POLYMORPH_COOKIES
  if (rawCookies) {
    const authCookies = parseCookies(rawCookies, hostname)
    if (authCookies.length > 0) await context.addCookies(authCookies)
  }

  // Inject preference cookies so the backend picks up the intended mode
  await context.addCookies([
    {
      name: 'modelType',
      value: session.modelType,
      domain: hostname,
      path: '/'
    },
    {
      name: 'searchMode',
      value: session.searchMode,
      domain: hostname,
      path: '/'
    }
  ])

  return context
}

// Wait for streaming to finish by polling for the submit arrow button to be
// re-enabled. During streaming the stop (Square) button is shown instead.
// Falls back to a fixed timeout if the selector never appears.
async function waitForResponseComplete(page: Page): Promise<void> {
  // Brief wait for the request to actually start
  await page.waitForTimeout(2000)

  try {
    // The textarea is re-enabled once streaming finishes
    await page.waitForFunction(
      () => {
        const ta = document.querySelector('textarea')
        return ta !== null && !ta.disabled
      },
      { timeout: RESPONSE_TIMEOUT_MS, polling: 1500 }
    )
  } catch {
    console.warn('  [warn] response wait timed out — continuing')
  }

  // Small trailing delay to let React commit the final state
  await page.waitForTimeout(800)
}

async function sendTurn(page: Page, query: string): Promise<void> {
  const textarea = await page.waitForSelector('textarea', { timeout: 15_000 })
  await textarea.click()
  await textarea.fill(query)
  await page.keyboard.press('Enter')
  await waitForResponseComplete(page)
}

async function runSession(session: Session): Promise<string | null> {
  console.log(`\n[${new Date().toISOString()}] Session: ${session.name}`)

  const context = await buildContext(session)
  const page = await context.newPage()
  let chatId: string | null = null

  try {
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    })

    // Capture the chat ID from the URL after first navigation (it may update)
    page.on('framenavigated', frame => {
      if (frame === page.mainFrame()) {
        const url = new URL(frame.url())
        const pathMatch = url.pathname.match(/\/([a-z0-9_]+)$/)
        if (pathMatch) chatId = pathMatch[1]
      }
    })

    for (let i = 0; i < session.turns.length; i++) {
      const query = session.turns[i]
      console.log(`  Turn ${i + 1}: ${query.slice(0, 70)}…`)
      await sendTurn(page, query)
      console.log(`  Turn ${i + 1} complete`)

      if (i < session.turns.length - 1) {
        await page.waitForTimeout(2000)
      }
    }

    // Pick up the final chat ID from the URL
    const finalUrl = page.url()
    const match = finalUrl.match(/\/([a-z0-9_]+)$/)
    if (match) chatId = match[1]

    console.log(`  Done — chatId: ${chatId ?? '(not captured)'}`)
  } finally {
    await context.close()
  }

  return chatId
}

async function main(): Promise<void> {
  console.log('[generate-traffic] Starting')
  console.log(`  Target:   ${TARGET_URL}`)
  console.log(
    `  Auth:     ${process.env.POLYMORPH_COOKIES ? 'cookies provided' : 'guest (sessions may not be sampled by evals)'}`
  )
  console.log(`  Sessions: ${SESSIONS.length}`)

  const results: Array<{ session: string; chatId: string | null }> = []

  for (const session of SESSIONS) {
    const chatId = await runSession(session)
    results.push({ session: session.name, chatId })

    if (session !== SESSIONS[SESSIONS.length - 1]) {
      console.log(`  Waiting ${SESSION_PAUSE_MS / 1000}s before next session…`)
      await new Promise(resolve => setTimeout(resolve, SESSION_PAUSE_MS))
    }
  }

  console.log('\n[generate-traffic] Complete')
  console.log('  Chat IDs:')
  for (const { session, chatId } of results) {
    console.log(`    ${session.padEnd(12)} ${chatId ?? '(not captured)'}`)
  }
}

main().catch(error => {
  console.error('[generate-traffic] Fatal:', error)
  process.exit(1)
})

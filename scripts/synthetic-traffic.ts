#!/usr/bin/env bun

/**
 * Synthetic traffic generator for polymorph.fyi eval baseline.
 *
 * Runs 3 browser sessions (research / chat / build) and reports results.
 * Reads POLYMORPH_COOKIES and SYNTHETIC_TARGET from env / .env.local.
 */

import { config as dotenvConfig } from 'dotenv'
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page
} from 'playwright'

dotenvConfig({ path: '.env.local' })

const TARGET = process.env.SYNTHETIC_TARGET ?? 'https://polymorph.fyi'
const RESPONSE_TIMEOUT_MS = 90_000

// ---------------------------------------------------------------------------
// Query banks — one is picked at random per session to vary the eval dataset
// ---------------------------------------------------------------------------

const RESEARCH_QUERIES = [
  'What are the most significant AI safety research developments in the past year?',
  'Explain the current state of nuclear fusion energy and the latest commercial milestones',
  'How have transformer architecture improvements evolved since the original attention paper?',
  'What does recent empirical research say about the effectiveness of remote work?'
]

const RESEARCH_FOLLOWUP =
  'What are the practical implications of this for the next 3–5 years?'

const CHAT_QUERIES = [
  'Explain the CAP theorem and the trade-offs it forces in distributed system design',
  "What's the difference between TCP and UDP, and when would a modern application use each?",
  'Why do some languages use garbage collection while others require manual memory management?',
  'Walk me through how public-key cryptography works, assuming I know basic math'
]

const BUILD_QUERIES = [
  'Write a TypeScript function that implements an LRU cache with O(1) get and put',
  'Write a Python script that reads a CSV and prints summary statistics for each numeric column',
  'Design a minimal REST API for a task management system: endpoints, request/response shapes, and status codes',
  'Write a regex to extract all URLs from a block of text and explain each part of the pattern'
]

// ---------------------------------------------------------------------------

interface SessionResult {
  type: string
  query: string
  chatId: string | null
  ok: boolean
  error?: string
  ms: number
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function parsedHost(): string {
  return new URL(TARGET).hostname
}

async function buildContext(
  browser: Browser,
  searchMode: string
): Promise<BrowserContext> {
  const ctx = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  })

  const host = parsedHost()
  const baseCookies = [
    { name: 'searchMode', value: searchMode, domain: host, path: '/' },
    { name: 'modelType', value: 'speed', domain: host, path: '/' }
  ]

  // Inject auth cookies if provided
  const rawCookies = process.env.POLYMORPH_COOKIES
  if (rawCookies) {
    const authCookies = rawCookies
      .split(';')
      .map(pair => pair.trim())
      .filter(Boolean)
      .map(pair => {
        const eq = pair.indexOf('=')
        return {
          name: pair.slice(0, eq).trim(),
          value: pair.slice(eq + 1).trim(),
          domain: host,
          path: '/'
        }
      })
    await ctx.addCookies([...baseCookies, ...authCookies])
  } else {
    await ctx.addCookies(baseCookies)
  }

  return ctx
}

// Wait until the chat input is re-enabled (streaming finished)
async function waitForIdle(page: Page): Promise<void> {
  await page.waitForSelector('textarea[name="input"]:not([disabled])', {
    timeout: RESPONSE_TIMEOUT_MS
  })
}

// Returns the chatId from the URL after navigation (e.g. /search/<chatId>)
function extractChatId(url: string): string | null {
  const m = url.match(/\/search\/([^/?#]+)/)
  return m ? m[1] : null
}

async function typeAndSubmit(page: Page, text: string): Promise<void> {
  const ta = await page.waitForSelector('textarea[name="input"]', {
    timeout: 10_000
  })
  await ta.click()
  // Type with a small delay to mimic human input
  await page.keyboard.type(text, { delay: 25 })
  await page.keyboard.press('Enter')
}

// ---------------------------------------------------------------------------
// Session runners
// ---------------------------------------------------------------------------

async function runResearchSession(browser: Browser): Promise<SessionResult> {
  const query = pick(RESEARCH_QUERIES)
  const t0 = Date.now()
  const ctx = await buildContext(browser, 'research')
  const page = await ctx.newPage()

  try {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
    await typeAndSubmit(page, query)

    // Wait for the URL to include /search/ (chat created) then wait for idle
    await page.waitForURL(/\/search\//, { timeout: 30_000 })
    await waitForIdle(page)

    const chatId = extractChatId(page.url())

    // Multi-turn follow-up
    await typeAndSubmit(page, RESEARCH_FOLLOWUP)
    await waitForIdle(page)

    return { type: 'research', query, chatId, ok: true, ms: Date.now() - t0 }
  } catch (err) {
    return {
      type: 'research',
      query,
      chatId: extractChatId(page.url()),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0
    }
  } finally {
    await ctx.close()
  }
}

async function runChatSession(browser: Browser): Promise<SessionResult> {
  const query = pick(CHAT_QUERIES)
  const t0 = Date.now()
  const ctx = await buildContext(browser, 'chat')
  const page = await ctx.newPage()

  try {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
    await typeAndSubmit(page, query)
    await page.waitForURL(/\/search\//, { timeout: 30_000 })
    await waitForIdle(page)

    return {
      type: 'chat',
      query,
      chatId: extractChatId(page.url()),
      ok: true,
      ms: Date.now() - t0
    }
  } catch (err) {
    return {
      type: 'chat',
      query,
      chatId: extractChatId(page.url()),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0
    }
  } finally {
    await ctx.close()
  }
}

async function runBuildSession(browser: Browser): Promise<SessionResult> {
  const query = pick(BUILD_QUERIES)
  const t0 = Date.now()
  const ctx = await buildContext(browser, 'chat')
  const page = await ctx.newPage()

  try {
    await page.goto(TARGET, { waitUntil: 'domcontentloaded' })
    await typeAndSubmit(page, query)
    await page.waitForURL(/\/search\//, { timeout: 30_000 })
    await waitForIdle(page)

    return {
      type: 'build',
      query,
      chatId: extractChatId(page.url()),
      ok: true,
      ms: Date.now() - t0
    }
  } catch (err) {
    return {
      type: 'build',
      query,
      chatId: extractChatId(page.url()),
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      ms: Date.now() - t0
    }
  } finally {
    await ctx.close()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log(`\n🚀 Synthetic traffic  →  ${TARGET}`)
  console.log(
    `Auth: ${process.env.POLYMORPH_COOKIES ? '✓ POLYMORPH_COOKIES set' : '⚠  no cookies — using guest mode'}\n`
  )

  const browser = await chromium.launch({
    headless: process.env.HEADLESS !== 'false',
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  })

  const results: SessionResult[] = []

  try {
    const runners = [runResearchSession, runChatSession, runBuildSession]

    for (let i = 0; i < runners.length; i++) {
      process.stdout.write(
        `[${i + 1}/3] running ${['research', 'chat', 'build'][i]} session... `
      )
      const r = await runners[i](browser)
      results.push(r)
      console.log(r.ok ? `✓  (${r.ms}ms)` : `✗  ${r.error}`)

      if (i < runners.length - 1) {
        await new Promise(res => setTimeout(res, 3_000))
      }
    }
  } finally {
    await browser.close()
  }

  // Summary table
  console.log('\n─────────────────────────────────────────────────────────────')
  console.log('Session    Status  Chat ID                  Query (truncated)')
  console.log('─────────────────────────────────────────────────────────────')
  for (const r of results) {
    const status = r.ok ? '✓ ok  ' : '✗ fail'
    const id = r.chatId ?? 'n/a                     '
    const q = r.query.slice(0, 40) + (r.query.length > 40 ? '…' : '')
    console.log(`${r.type.padEnd(10)} ${status}  ${id.padEnd(24)} ${q}`)
  }
  console.log('─────────────────────────────────────────────────────────────')

  const passed = results.filter(r => r.ok).length
  console.log(`\n${passed}/${results.length} sessions succeeded\n`)

  if (passed < results.length) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

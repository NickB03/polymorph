#!/usr/bin/env bun
/**
 * Simulates N guest/authenticated user sessions on a Polymorph deployment
 * to build eval traffic baseline.
 *
 * Two modes (auto-selected, or forced via --mode):
 *
 *  browser   Opens a real headless Chromium browser (Playwright), navigates the
 *            UI, sets the searchMode cookie, types a query, and waits for the
 *            full streaming response.  Most realistic — requires a non-
 *            container environment or CHROMIUM_PATH to a local Chromium binary.
 *
 *  api       POSTs directly to /api/chat with the same cookie approach used by
 *            scripts/chat-cli.ts.  Works from anywhere — including GitHub
 *            Actions and remote containers — as long as POLYMORPH_COOKIES is
 *            set with a valid session cookie string OR the site allows guest
 *            requests.
 *
 * Environment variables:
 *   SIMULATE_URL       Target base URL (default: https://polymorph.fyi)
 *   SIMULATE_SESSIONS  Number of sessions (default: 3, max 10)
 *   SIMULATE_MODE      Force "browser" or "api" (default: auto)
 *   CHROMIUM_PATH      Override Chromium executable path
 *   POLYMORPH_COOKIES          Session cookie string passed as Cookie header (api mode)
 *   POLYMORPH_BYPASS_SECRET    Vercel Deployment Protection bypass secret
 *                              (Settings → Deployment Protection → Bypass for Automation)
 *
 * Usage:
 *   bun run scripts/simulate-traffic.ts
 *   SIMULATE_MODE=api bun run scripts/simulate-traffic.ts
 *   SIMULATE_URL=http://localhost:43100 bun run scripts/simulate-traffic.ts
 */

import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'

const TARGET_URL = process.env.SIMULATE_URL ?? 'https://polymorph.fyi'
const SESSION_COUNT = Math.min(
  parseInt(process.env.SIMULATE_SESSIONS ?? '3', 10),
  10
)
const FORCE_MODE = process.env.SIMULATE_MODE as 'browser' | 'api' | undefined

// Seconds to pause between sessions (realistic pacing)
const PAUSE_MIN_MS = 20_000
const PAUSE_MAX_MS = 45_000

type SearchMode = 'search' | 'research' | 'build'
type Session = { mode: SearchMode; query: string }

// Varied queries across all three modes so Phoenix gets diverse spans to eval
const QUERY_POOL: Session[] = [
  {
    mode: 'search',
    query:
      'What are the main differences between React Server Components and Client Components?'
  },
  {
    mode: 'search',
    query:
      'How does rate limiting work in Next.js API routes using Upstash Redis?'
  },
  {
    mode: 'search',
    query: 'What is Tailwind CSS v4 and what changed from v3?'
  },
  {
    mode: 'search',
    query:
      'Explain how React 19 concurrent features like useTransition improve UX'
  },
  {
    mode: 'research',
    query:
      'What are the best open-source project management tools for small engineering teams in 2025?'
  },
  {
    mode: 'research',
    query:
      'Compare Supabase, PlanetScale, and Neon for a Next.js SaaS product with low traffic'
  },
  {
    mode: 'research',
    query:
      'What are current best practices for RAG pipeline design with large document sets?'
  },
  {
    mode: 'research',
    query:
      'Analyze the tradeoffs between Pinecone, Qdrant, and pgvector for semantic search'
  },
  {
    mode: 'build',
    query:
      'Write a TypeScript utility for rate-limiting async calls with exponential backoff and jitter'
  },
  {
    mode: 'build',
    query:
      'Create a React hook for infinite scroll with cursor-based pagination and suspense support'
  },
  {
    mode: 'build',
    query:
      'Build a Zod schema for validating a webhook payload with discriminated unions and nested objects'
  },
  {
    mode: 'build',
    query:
      'Write a Drizzle ORM query that does a paginated join across three tables with full-text search'
  }
]

function pickSessions(n: number): Session[] {
  const pool = [...QUERY_POOL]
  const picked: Session[] = []
  while (picked.length < n && pool.length > 0) {
    const idx = Math.floor(Math.random() * pool.length)
    picked.push(...pool.splice(idx, 1))
  }
  return picked
}

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

// ---------------------------------------------------------------------------
// API mode — direct POST to /api/chat, streams and discards response
// ---------------------------------------------------------------------------

async function runApiSession(
  session: Session,
  index: number,
  total: number
): Promise<{ success: boolean; error?: string }> {
  const cookies = process.env.POLYMORPH_COOKIES ?? ''
  const searchModeValue = session.mode
  const cookieString = cookies
    ? `${cookies}; searchMode=${searchModeValue}; modelType=speed`
    : `searchMode=${searchModeValue}; modelType=speed`

  const chatId = generateId()
  const msgId = generateId()
  const payload = {
    chatId,
    trigger: 'submit-message',
    isNewChat: true,
    messages: [
      {
        id: msgId,
        role: 'user',
        content: session.query,
        parts: [{ type: 'text', text: session.query }],
        createdAt: new Date()
      }
    ]
  }

  try {
    const bypassSecret = process.env.POLYMORPH_BYPASS_SECRET
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      Cookie: cookieString,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
    }
    if (bypassSecret) {
      headers['x-vercel-protection-bypass'] = bypassSecret
    }

    const res = await fetch(`${TARGET_URL}/api/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify(payload)
    })

    if (!res.ok) {
      const text = await res.text()
      return {
        success: false,
        error: `HTTP ${res.status}: ${text.slice(0, 200)}`
      }
    }

    if (!res.body) return { success: false, error: 'No response body' }

    // Drain the SSE stream so the server finishes writing to the DB
    const webStream = res.body as unknown as NodeReadableStream<any>
    const nodeReadable = Readable.fromWeb(webStream)
    let done = false
    nodeReadable.on('data', () => {}) // consume
    await new Promise<void>((resolve, reject) => {
      nodeReadable.on('end', () => {
        done = true
        resolve()
      })
      nodeReadable.on('error', reject)
      // Safety timeout — 2 minutes
      setTimeout(() => {
        if (!done) resolve()
      }, 120_000)
    })

    return { success: true }
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

// ---------------------------------------------------------------------------
// Browser mode — headless Chromium via Playwright
// ---------------------------------------------------------------------------

async function runBrowserSession(
  session: Session,
  index: number,
  total: number,
  launchOptions: Record<string, unknown>
): Promise<{ success: boolean; error?: string }> {
  // Dynamic import so the module isn't loaded at all in api-only runs
  const { chromium } = await import('playwright')
  const browser = await (chromium as any).launch({
    headless: true,
    ...launchOptions
  })

  try {
    const context = await browser.newContext({
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
        '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      locale: 'en-US',
      timezoneId: 'America/New_York',
      ignoreHTTPSErrors: true
    })

    try {
      const hostname = new URL(TARGET_URL).hostname
      await context.addCookies([
        { name: 'searchMode', value: session.mode, domain: hostname, path: '/' }
      ])

      const page = await context.newPage()
      try {
        await page.goto(TARGET_URL, {
          waitUntil: 'networkidle',
          timeout: 30_000
        })

        const input = page.locator('textarea[name="input"]')
        await input.waitFor({ state: 'visible', timeout: 20_000 })
        await input.fill(session.query)
        await page.keyboard.press('Enter')

        // The textarea disables while streaming and re-enables when done
        await page
          .waitForFunction(
            () =>
              (
                document.querySelector(
                  'textarea[name="input"]'
                ) as HTMLTextAreaElement | null
              )?.disabled === true,
            { timeout: 15_000 }
          )
          .catch(() => {})

        await page.waitForFunction(
          () =>
            (
              document.querySelector(
                'textarea[name="input"]'
              ) as HTMLTextAreaElement | null
            )?.disabled === false,
          { timeout: 120_000 }
        )

        return { success: true }
      } catch (err) {
        return {
          success: false,
          error: err instanceof Error ? err.message : String(err)
        }
      } finally {
        await page.close()
      }
    } finally {
      await context.close()
    }
  } finally {
    await browser.close()
  }
}

// ---------------------------------------------------------------------------
// Detect Chromium for browser mode
// ---------------------------------------------------------------------------

function findChromium(): string | undefined {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH
  const { existsSync } = require('fs') as typeof import('fs')
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome'
  ]
  return candidates.find(p => existsSync(p))
}

async function detectMode(): Promise<'browser' | 'api'> {
  if (FORCE_MODE) return FORCE_MODE
  // Try importing playwright — if it errors or no Chromium is found, use api
  try {
    await import('playwright')
    const exe = findChromium()
    if (!exe) return 'api'
    // Quick sanity: try launching once
    const { chromium } = await import('playwright')
    const b = await (chromium as any).launch({
      headless: true,
      executablePath: exe
    })
    await b.close()
    return 'browser'
  } catch {
    return 'api'
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  const sessions = pickSessions(SESSION_COUNT)
  const mode = await detectMode()
  const chromiumPath = mode === 'browser' ? findChromium() : undefined

  console.log(`\n🚀 simulate-traffic — ${TARGET_URL}  [${mode} mode]`)
  console.log(`   ${new Date().toISOString()} · ${SESSION_COUNT} sessions\n`)

  let passed = 0

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]
    process.stdout.write(
      `  [${i + 1}/${sessions.length}] ${s.mode.padEnd(8)} "${s.query.slice(0, 58)}..." `
    )

    let result: { success: boolean; error?: string }

    if (mode === 'browser') {
      result = await runBrowserSession(s, i, sessions.length, {
        ...(chromiumPath ? { executablePath: chromiumPath } : {})
      })
    } else {
      result = await runApiSession(s, i, sessions.length)
    }

    if (result.success) {
      passed++
      console.log('✅')
    } else {
      console.log(`❌  ${result.error?.slice(0, 80)}`)
    }

    if (i < sessions.length - 1) {
      const pauseMs =
        PAUSE_MIN_MS + Math.random() * (PAUSE_MAX_MS - PAUSE_MIN_MS)
      console.log(
        `     ⏸  ${Math.round(pauseMs / 1000)}s pause before next session`
      )
      await new Promise(r => setTimeout(r, pauseMs))
    }
  }

  console.log(`\n  ${passed}/${sessions.length} sessions succeeded`)
  if (passed < sessions.length) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

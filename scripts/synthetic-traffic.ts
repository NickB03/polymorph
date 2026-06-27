/**
 * Synthetic traffic generator for polymorph.fyi
 *
 * Simulates 3 realistic browser sessions per run so the eval traffic-monitor
 * has chat records to sample. Each session authenticates as the seed user,
 * navigates to the app, and submits a realistic prompt (with an optional
 * follow-up). Prompts rotate by day-of-week to keep sessions varied.
 *
 * Usage:
 *   APP_URL=https://polymorph.fyi \
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... \
 *   SEED_USER_EMAIL=... SEED_USER_PASSWORD=... \
 *   bun run synthetic-traffic
 */
import { createBrowserClient } from '@supabase/ssr'
import type { BrowserContext, Page } from 'playwright'
import { chromium } from 'playwright'

const APP_URL = (process.env.APP_URL ?? 'https://polymorph.fyi').replace(
  /\/$/,
  ''
)
const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const SEED_USER_EMAIL = process.env.SEED_USER_EMAIL
const SEED_USER_PASSWORD = process.env.SEED_USER_PASSWORD

for (const [name, value] of [
  ['SUPABASE_URL', SUPABASE_URL],
  ['SUPABASE_ANON_KEY', SUPABASE_ANON_KEY],
  ['SEED_USER_EMAIL', SEED_USER_EMAIL],
  ['SEED_USER_PASSWORD', SEED_USER_PASSWORD]
]) {
  if (!value) throw new Error(`Missing required env var: ${name}`)
}

interface Session {
  label: string
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
  prompt: string
  followUp?: string
}

// 7 daily sets indexed by day-of-week (0 = Sunday).
// Each set has 3 sessions: research deep-dive, technical how-to, general knowledge.
const DAILY_SESSIONS: Session[][] = [
  // Sunday
  [
    {
      label: 'research-ai-breakthroughs',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'What are the most significant AI research breakthroughs announced this month?',
      followUp:
        'Which of these has the most near-term practical application for developers?'
    },
    {
      label: 'tech-jwt-refresh',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        "What's the best approach for handling JWT refresh tokens securely in a Next.js app?"
    },
    {
      label: 'general-learning-techniques',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What are the most effective evidence-based techniques for learning a technical skill quickly?'
    }
  ],
  // Monday
  [
    {
      label: 'research-carbon-capture',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'What is the current state of carbon capture technology and its commercial viability?',
      followUp:
        'What are the main barriers to scaling this up in the next decade?'
    },
    {
      label: 'tech-postgres-pagination',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'How do I implement efficient cursor-based pagination in PostgreSQL for a table with millions of rows?'
    },
    {
      label: 'general-sleep-cognition',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What does current research say about the optimal amount of sleep for cognitive performance?'
    }
  ],
  // Tuesday
  [
    {
      label: 'research-quantum-computing',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'What are the latest developments in quantum computing from major players like IBM and Google?',
      followUp:
        'How close are we to practical quantum advantage for real-world business problems?'
    },
    {
      label: 'tech-caching-tradeoffs',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'Explain the trade-offs between in-memory caching, Redis, and CDN caching for a web application.'
    },
    {
      label: 'general-compound-interest',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'How does compound interest work and why is starting early so important for long-term investing?'
    }
  ],
  // Wednesday
  [
    {
      label: 'research-ev-infrastructure',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'Compare the current state of EV charging infrastructure in the US vs Europe and China.',
      followUp:
        'What policy differences best explain the gaps between these regions?'
    },
    {
      label: 'tech-react-memoization',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'When should I use useCallback and useMemo in React, and what are the most common over-use mistakes?'
    },
    {
      label: 'general-intermittent-fasting',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What does the latest nutritional science say about the actual benefits and risks of intermittent fasting?'
    }
  ],
  // Thursday
  [
    {
      label: 'research-rust-adoption',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'How has Rust adoption grown in production systems over the past three years, and why?',
      followUp:
        'What are the main industries or use cases driving this adoption beyond systems programming?'
    },
    {
      label: 'tech-observability',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        "What's the practical difference between distributed tracing, metrics, and logs for debugging production issues?"
    },
    {
      label: 'general-salary-negotiation',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What are the most effective evidence-based strategies for negotiating a salary increase?'
    }
  ],
  // Friday
  [
    {
      label: 'research-wasm-backend',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'What are the current real-world production use cases for WebAssembly beyond the browser?',
      followUp:
        'What tooling has emerged to make WASM more practical for backend and edge workloads?'
    },
    {
      label: 'tech-hosting-comparison',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What are the key differences between Vercel, Railway, and Fly.io for deploying a Node.js API?'
    },
    {
      label: 'general-consciousness-theories',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What are the leading scientific theories about how consciousness arises from brain activity?'
    }
  ],
  // Saturday
  [
    {
      label: 'research-llm-agents',
      searchMode: 'research',
      modelType: 'quality',
      prompt:
        'What are the current limitations and recent progress in LLM-based autonomous agents?',
      followUp:
        'What benchmarks are researchers using to measure agent reliability and capability progress?'
    },
    {
      label: 'tech-api-versioning',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What are the best practices for versioning REST APIs while maintaining backward compatibility?'
    },
    {
      label: 'general-language-learning',
      searchMode: 'chat',
      modelType: 'speed',
      prompt:
        'What does cognitive science tell us about the most effective methods for learning a new language as an adult?'
    }
  ]
]

async function authenticate(): Promise<Map<string, string>> {
  const cookieStore = new Map<string, string>()
  const supabase = createBrowserClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      getAll: () =>
        [...cookieStore.entries()].map(([name, value]) => ({ name, value })),
      setAll: (cookies: { name: string; value: string }[]) => {
        for (const { name, value } of cookies) {
          if (value) cookieStore.set(name, value)
          else cookieStore.delete(name)
        }
      }
    }
  })

  const { error } = await supabase.auth.signInWithPassword({
    email: SEED_USER_EMAIL!,
    password: SEED_USER_PASSWORD!
  })

  if (error) throw new Error(`Supabase auth failed: ${error.message}`)

  console.log(
    `[synthetic-traffic] Authenticated as ${SEED_USER_EMAIL} (${cookieStore.size} auth cookies)`
  )
  return cookieStore
}

// Wait for the streaming response to finish by polling body text length.
// Treats 3 consecutive polls with no change (≈7.5 s) as "done streaming".
async function waitForStreamingComplete(
  page: Page,
  timeoutMs: number
): Promise<void> {
  const deadline = Date.now() + timeoutMs

  // Give the request time to start before we begin polling
  await page.waitForTimeout(4_000)

  let prevLength = 0
  let stableTicks = 0

  while (Date.now() < deadline) {
    await page.waitForTimeout(2_500)

    let len = 0
    try {
      len = await page.evaluate(() => document.body.innerText.length)
    } catch {
      // Page navigated or closed — treat as complete
      return
    }

    if (len !== prevLength) {
      stableTicks = 0
      prevLength = len
    } else {
      stableTicks++
      if (stableTicks >= 3) return
    }
  }

  console.warn('[synthetic-traffic] Response wait timed out — continuing')
}

async function runSession(
  context: BrowserContext,
  session: Session,
  index: number
): Promise<void> {
  const domain = new URL(APP_URL).hostname
  const page = await context.newPage()

  try {
    // Set mode cookies before navigation so the app reads them on first load.
    // The Next.js app stores these in message metadata, which is what the
    // traffic-monitor sampler reads to reconstruct searchMode / modelType.
    await context.addCookies([
      { name: 'searchMode', value: session.searchMode, domain, path: '/' },
      { name: 'modelType', value: session.modelType, domain, path: '/' }
    ])

    console.log(
      `[synthetic-traffic] Session ${index + 1} (${session.label}): navigating to ${APP_URL}`
    )
    await page.goto(APP_URL, { waitUntil: 'domcontentloaded', timeout: 30_000 })

    // The chat input is a <textarea> rendered by react-textarea-autosize.
    // If the selector fails, update it to match the actual element in the UI.
    const textarea = page.locator('textarea').first()
    await textarea.waitFor({ state: 'visible', timeout: 20_000 })

    const preview =
      session.prompt.length > 72
        ? session.prompt.slice(0, 69) + '...'
        : session.prompt
    console.log(
      `[synthetic-traffic] Session ${index + 1}: submitting "${preview}"`
    )

    await textarea.fill(session.prompt)
    await textarea.press('Enter')

    const timeout = session.searchMode === 'research' ? 150_000 : 90_000
    await waitForStreamingComplete(page, timeout)
    console.log(
      `[synthetic-traffic] Session ${index + 1}: primary response complete`
    )

    if (session.followUp) {
      await page.waitForTimeout(2_000)

      const followUpInput = page.locator('textarea').first()
      await followUpInput.waitFor({ state: 'visible', timeout: 15_000 })

      const followPreview =
        session.followUp.length > 72
          ? session.followUp.slice(0, 69) + '...'
          : session.followUp
      console.log(
        `[synthetic-traffic] Session ${index + 1}: follow-up "${followPreview}"`
      )

      await followUpInput.fill(session.followUp)
      await followUpInput.press('Enter')
      await waitForStreamingComplete(page, 90_000)
      console.log(
        `[synthetic-traffic] Session ${index + 1}: follow-up response complete`
      )
    }

    console.log(
      `[synthetic-traffic] Session ${index + 1} (${session.label}): done`
    )
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(
      `[synthetic-traffic] Session ${index + 1} (${session.label}): FAILED — ${msg}`
    )
    throw err
  } finally {
    await page.close()
  }
}

async function main() {
  const day = new Date().getDay() // 0=Sun … 6=Sat
  const sessions = DAILY_SESSIONS[day]

  console.log(
    `[synthetic-traffic] Starting — day ${day}, ${sessions.length} sessions, target: ${APP_URL}`
  )

  let authCookies: Map<string, string>
  try {
    authCookies = await authenticate()
  } catch (err) {
    console.error(
      '[synthetic-traffic] Auth failed:',
      err instanceof Error ? err.message : err
    )
    process.exit(1)
  }

  const browser = await chromium.launch({ headless: true })
  const domain = new URL(APP_URL).hostname
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 ' +
      '(KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
  })

  // Inject Supabase auth cookies into the browser context so the Next.js
  // middleware recognises the seed user without going through the login page.
  await context.addCookies(
    [...authCookies.entries()].map(([name, value]) => ({
      name,
      value,
      domain,
      path: '/'
    }))
  )

  let succeeded = 0
  let failed = 0

  for (let i = 0; i < sessions.length; i++) {
    try {
      await runSession(context, sessions[i], i)
      succeeded++
    } catch {
      failed++
    }
  }

  await browser.close()

  const summary =
    `[synthetic-traffic] Complete — ${succeeded}/${sessions.length} sessions succeeded` +
    (failed > 0 ? `, ${failed} failed` : '')
  console.log(summary)

  if (succeeded === 0) process.exit(1)
}

main().catch(err => {
  console.error('[synthetic-traffic] Fatal error:', err)
  process.exit(1)
})

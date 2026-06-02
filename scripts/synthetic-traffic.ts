#!/usr/bin/env bun
/**
 * Simulates 3 realistic user sessions on polymorph.fyi for production eval traffic.
 * Run daily via: bun scripts/synthetic-traffic.ts
 * See .claude/skills/synthetic-traffic.md for setup instructions.
 */

import { config as dotenvConfig } from 'dotenv'
import {
  type Browser,
  type BrowserContext,
  chromium,
  type Page
} from 'playwright'

dotenvConfig({ path: '.env.local' })

const SITE_URL = (
  process.env.SYNTHETIC_TRAFFIC_URL ?? 'https://polymorph.fyi'
).replace(/\/$/, '')
const EMAIL = process.env.SYNTHETIC_TRAFFIC_EMAIL ?? ''
const PASSWORD = process.env.SYNTHETIC_TRAFFIC_PASSWORD ?? ''
const RESPONSE_TIMEOUT_MS = Number(process.env.RESPONSE_TIMEOUT_MS ?? 120_000)

// ---------------------------------------------------------------------------
// Query pools — one entry = [first turn, optional follow-up turn]
// ---------------------------------------------------------------------------

const SEARCH_QUERIES: string[][] = [
  [
    'What are the latest breakthroughs in nuclear fusion research?',
    'How does inertial confinement fusion differ from magnetic confinement fusion?'
  ],
  [
    'What has the James Webb Space Telescope discovered that surprised astronomers most?',
    'How does JWST compare to Hubble in terms of observational power?'
  ],
  [
    "What are the current FDA-approved treatments for Alzheimer's disease?",
    'Which treatments are in late-stage clinical trials right now?'
  ],
  [
    'How does the US Federal Reserve set the federal funds rate?',
    'What economic indicators does the Fed watch most closely?'
  ],
  [
    'What is retrieval-augmented generation (RAG) in AI?',
    'How does RAG compare to fine-tuning a model on new data?'
  ],
  [
    'What caused the 2008 global financial crisis?',
    'What regulatory reforms came out of the financial crisis?'
  ]
]

const RESEARCH_QUERIES: string[][] = [
  [
    'Research the long-term economic and social impacts of widespread remote work adoption from 2020 to 2025',
    'What does the research say about productivity changes, mental health outcomes, and urban planning effects?'
  ],
  [
    'Research the current state of quantum computing and its practical commercial applications',
    'Which industries are closest to achieving real-world quantum advantage?'
  ],
  [
    'Research the history and current state of CRISPR gene therapy in treating human diseases',
    'What are the main ethical concerns and regulatory challenges facing CRISPR therapies?'
  ],
  [
    'Research the competitive landscape of large language models released in 2024 and 2025',
    'How do the leading models compare on safety benchmarks, reasoning, and coding ability?'
  ],
  [
    'Research the causes and global impact of plastic pollution in ocean ecosystems',
    'What solutions — technological and policy-based — are showing the most promise?'
  ]
]

const BUILD_QUERIES: string[][] = [
  [
    'Build an interactive dashboard showing global renewable energy capacity by country and energy source'
  ],
  [
    'Create an interactive timeline of major AI milestones from 1950 to 2025 with descriptions of each breakthrough'
  ],
  [
    'Build a visual comparison table for the top 5 programming languages showing popularity, use cases, and salary data'
  ],
  [
    'Create an interactive periodic table where clicking an element shows its properties and common uses'
  ],
  [
    'Build an interactive map showing global CO₂ emissions by country with historical trend charts'
  ],
  [
    'Create a visual calculator that shows compound interest growth over time with adjustable parameters'
  ]
]

type UserMode = 'search' | 'research' | 'build'

interface Session {
  mode: UserMode
  queries: string[]
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function buildSessions(): Session[] {
  return [
    { mode: 'search', queries: pickRandom(SEARCH_QUERIES) },
    { mode: 'research', queries: pickRandom(RESEARCH_QUERIES) },
    { mode: 'build', queries: pickRandom(BUILD_QUERIES) }
  ]
}

// ---------------------------------------------------------------------------
// Browser helpers
// ---------------------------------------------------------------------------

async function login(page: Page): Promise<void> {
  await page.goto(`${SITE_URL}/auth/login`, { waitUntil: 'networkidle' })

  // Fill email and password
  await page.getByLabel('Email').fill(EMAIL)
  await page.getByLabel('Password').fill(PASSWORD)
  await page.getByRole('button', { name: /sign in|log in/i }).click()

  // Wait for redirect to home or a chat page
  await page.waitForURL(url => !url.pathname.startsWith('/auth'), {
    timeout: 30_000
  })
}

async function waitForResponseComplete(page: Page): Promise<void> {
  // The send button changes to "Stop generating" while streaming, then back to "Send message"
  await page
    .waitForSelector('[aria-label="Stop generating"]', { timeout: 15_000 })
    .catch(() => {
      // If we never see "Stop generating" it may have completed instantly
    })
  await page.waitForSelector('[aria-label="Send message"]', {
    timeout: RESPONSE_TIMEOUT_MS
  })
}

async function submitMessage(page: Page, message: string): Promise<void> {
  const textarea = page.getByRole('textbox', { name: 'Message input' })
  await textarea.waitFor({ timeout: 15_000 })
  await textarea.click()
  await textarea.fill(message)
  // Submit via Enter (the app submits on Enter without Shift)
  await textarea.press('Enter')
}

async function runSession(
  context: BrowserContext,
  session: Session,
  sessionIndex: number
): Promise<void> {
  const label = `[session ${sessionIndex + 1}/${session.mode}]`
  const page = await context.newPage()

  try {
    console.log(`${label} Logging in…`)
    await login(page)

    // Set mode via cookie so it takes effect before the first message
    const domain = new URL(SITE_URL).hostname
    await context.addCookies([
      {
        name: 'searchMode',
        value: session.mode,
        domain,
        path: '/',
        secure: domain !== 'localhost',
        sameSite: 'Lax'
      }
    ])

    // Navigate to root chat to start a fresh conversation
    await page.goto(SITE_URL, { waitUntil: 'domcontentloaded' })

    for (let i = 0; i < session.queries.length; i++) {
      const query = session.queries[i]
      const turn = `turn ${i + 1}/${session.queries.length}`
      const snippet = query.length > 60 ? query.slice(0, 57) + '…' : query
      console.log(`${label} ${turn}: "${snippet}"`)

      const t0 = Date.now()
      await submitMessage(page, query)
      await waitForResponseComplete(page)
      const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
      console.log(`${label} ${turn}: done in ${elapsed}s`)

      // Brief pause between turns so it feels like a natural reading pause
      if (i < session.queries.length - 1) {
        await page.waitForTimeout(2_000)
      }
    }

    console.log(`${label} Complete`)
  } finally {
    await page.close()
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main(): Promise<void> {
  if (!EMAIL || !PASSWORD) {
    console.error(
      'Error: SYNTHETIC_TRAFFIC_EMAIL and SYNTHETIC_TRAFFIC_PASSWORD must be set in .env.local'
    )
    process.exit(1)
  }

  const sessions = buildSessions()
  console.log(
    `Starting ${sessions.length} synthetic traffic sessions against ${SITE_URL}`
  )
  console.log(`Modes: ${sessions.map(s => s.mode).join(' → ')}`)

  let browser: Browser | undefined
  const failures: number[] = []

  try {
    browser = await chromium.launch({ headless: true })

    for (let i = 0; i < sessions.length; i++) {
      const context = await browser.newContext({
        // Realistic viewport and user agent
        viewport: { width: 1280, height: 800 },
        userAgent:
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        locale: 'en-US'
      })

      try {
        await runSession(context, sessions[i], i)
      } catch (err) {
        console.error(`Session ${i + 1} failed:`, err)
        failures.push(i + 1)
      } finally {
        await context.close()
      }
    }
  } finally {
    await browser?.close()
  }

  if (failures.length > 0) {
    console.error(
      `\n${failures.length} session(s) failed: #${failures.join(', #')}`
    )
    process.exit(1)
  }

  console.log('\nAll sessions completed successfully.')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

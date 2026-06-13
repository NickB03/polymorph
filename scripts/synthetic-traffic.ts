/**
 * Generates 3 synthetic user sessions on polymorph.fyi each day to populate
 * production eval data for the traffic-monitor evaluation suite.
 *
 * Run via: bun run synthetic-traffic
 * Or:      bun run scripts/synthetic-traffic.ts
 *
 * Env vars:
 *   POLYMORPH_URL           — target site (default: https://polymorph.fyi)
 *   POLYMORPH_TEST_EMAIL    — optional; enables authenticated sessions
 *   POLYMORPH_TEST_PASSWORD — required when EMAIL is set
 */

import {
  type Browser,
  type BrowserContext,
  chromium,
  type Locator,
  type Page
} from 'playwright'

const SITE_URL = process.env.POLYMORPH_URL ?? 'https://polymorph.fyi'
const TEST_EMAIL = process.env.POLYMORPH_TEST_EMAIL
const TEST_PASSWORD = process.env.POLYMORPH_TEST_PASSWORD

type Session = {
  name: string
  type: 'research' | 'creative' | 'technical'
  messages: [string, string, string]
}

const RESEARCH_POOL: Session[] = [
  {
    name: 'ai-frontiers',
    type: 'research',
    messages: [
      'What are the most significant AI research breakthroughs from the past six months?',
      'Which of these do you think will have the most real-world impact in 2–3 years?',
      'What barriers do researchers say are still blocking deployment?'
    ]
  },
  {
    name: 'climate-tech',
    type: 'research',
    messages: [
      'What are the most promising emerging technologies for carbon capture right now?',
      'How does direct air capture compare to ocean-based carbon removal in cost and scalability?',
      'Which companies or research groups are furthest ahead in this space?'
    ]
  },
  {
    name: 'biotech-crispr',
    type: 'research',
    messages: [
      'Summarize the current state of CRISPR gene editing for treating genetic diseases.',
      'What are the main regulatory and ethical concerns slowing adoption?',
      'Which clinical trials are furthest along, and what diseases do they target?'
    ]
  }
]

const CREATIVE_POOL: Session[] = [
  {
    name: 'open-source-essay',
    type: 'creative',
    messages: [
      'Write a 400-word essay on why open-source AI development matters for society.',
      'Rewrite it for a technical audience — add specifics about licensing and model weights.',
      'Give it a stronger conclusion that calls researchers to action.'
    ]
  },
  {
    name: 'future-city-story',
    type: 'creative',
    messages: [
      'Write a short 300-word story set in a city where all urban planning is decided by AI.',
      'Add a human protagonist who discovers and questions a decision the AI made.',
      'Resolve it in a way that shows both the strengths and limits of AI governance.'
    ]
  },
  {
    name: 'product-pitch',
    type: 'creative',
    messages: [
      'Write a 3-paragraph product pitch for an app that helps households reduce food waste.',
      "Make it more emotional and personal — speak directly to the reader's daily experience.",
      'Add a one-sentence tagline that would work on a billboard.'
    ]
  }
]

const TECHNICAL_POOL: Session[] = [
  {
    name: 'rag-vs-finetuning',
    type: 'technical',
    messages: [
      'Explain the difference between RAG and fine-tuning for customizing large language models.',
      'In what scenarios would you choose one over the other?',
      'What are the main engineering challenges in building a production RAG system?'
    ]
  },
  {
    name: 'transformer-attention',
    type: 'technical',
    messages: [
      'Explain how the attention mechanism in transformers works, step by step.',
      'How does multi-head attention improve on single-head attention?',
      'What are the computational bottlenecks and how do modern architectures address them?'
    ]
  },
  {
    name: 'distributed-consistency',
    type: 'technical',
    messages: [
      'What are the CAP theorem trade-offs in distributed databases?',
      'How do databases like CockroachDB or Spanner navigate those trade-offs in practice?',
      'What should a developer know when deciding between strong and eventual consistency?'
    ]
  }
]

function pickSessions(): [Session, Session, Session] {
  const day = Math.floor(Date.now() / 86_400_000)
  return [
    RESEARCH_POOL[day % RESEARCH_POOL.length],
    CREATIVE_POOL[day % CREATIVE_POOL.length],
    TECHNICAL_POOL[day % TECHNICAL_POOL.length]
  ]
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function jitter(baseMs: number, rangeMs: number): number {
  return baseMs + Math.random() * rangeMs
}

async function authenticate(page: Page): Promise<void> {
  if (!TEST_EMAIL || !TEST_PASSWORD) return

  try {
    const signInBtn = page
      .locator(
        'a:has-text("Sign in"), button:has-text("Sign in"), a:has-text("Log in"), button:has-text("Log in")'
      )
      .first()

    if (!(await signInBtn.isVisible({ timeout: 3_000 }))) return

    await signInBtn.click()
    await page.waitForLoadState('networkidle', { timeout: 10_000 })
    await page.fill('input[type="email"]', TEST_EMAIL)
    await page.fill('input[type="password"]', TEST_PASSWORD)
    await page.keyboard.press('Enter')
    await page.waitForLoadState('networkidle', { timeout: 15_000 })
    console.log('    authenticated')
  } catch {
    console.log('    auth skipped (no gate or credentials mismatch)')
  }
}

async function findChatInput(page: Page): Promise<Locator> {
  const selectors = [
    'textarea',
    '[contenteditable="true"]',
    '[data-testid="chat-input"]',
    '[placeholder*="message" i]',
    '[placeholder*="ask" i]'
  ]

  for (const sel of selectors) {
    const loc = page.locator(sel).first()
    if (await loc.isVisible({ timeout: 2_000 }).catch(() => false)) {
      return loc
    }
  }

  throw new Error(`chat input not found — tried: ${selectors.join(', ')}`)
}

async function sendMessage(
  page: Page,
  input: Locator,
  message: string
): Promise<void> {
  await input.click()
  await input.fill(message)

  const submitBtn = page.locator('button[type="submit"]').first()
  if (await submitBtn.isVisible({ timeout: 500 }).catch(() => false)) {
    await submitBtn.click()
  } else {
    await page.keyboard.press('Enter')
  }
}

async function waitForResponseComplete(page: Page): Promise<void> {
  // Give streaming a moment to start before we start checking for completion
  await sleep(2_000)

  try {
    // The chat input is typically disabled while the model is streaming.
    // Wait for it to become editable again (up to 90s).
    await page.waitForFunction(
      () => {
        const ta = document.querySelector<HTMLTextAreaElement>('textarea')
        const ce = document.querySelector<HTMLElement>(
          '[contenteditable="true"]'
        )
        if (ta) return !ta.disabled
        if (ce) return ce.getAttribute('aria-disabled') !== 'true'
        return false
      },
      { timeout: 90_000 }
    )
  } catch {
    // Fallback: if we can't detect completion, wait a generous fixed time
    await sleep(20_000)
  }

  await sleep(800)
}

async function runSession(browser: Browser, session: Session): Promise<void> {
  console.log(`\n  [${session.type}] ${session.name}`)

  let context: BrowserContext | null = null

  try {
    context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    })

    const page = await context.newPage()

    await page.goto(SITE_URL, { waitUntil: 'networkidle', timeout: 30_000 })
    await authenticate(page)

    const input = await findChatInput(page)

    for (const [i, message] of session.messages.entries()) {
      const preview = message.length > 72 ? `${message.slice(0, 72)}…` : message
      console.log(`    [${i + 1}/3] ${preview}`)

      await sendMessage(page, input, message)
      await waitForResponseComplete(page)

      if (i < session.messages.length - 1) {
        await sleep(jitter(10_000, 8_000))
      }
    }

    console.log(`    ✓ done`)
  } catch (err) {
    console.error(`    ✗ ${err instanceof Error ? err.message : String(err)}`)
  } finally {
    await context?.close()
  }
}

async function main(): Promise<void> {
  const [research, creative, technical] = pickSessions()
  const start = Date.now()

  console.log('[synthetic-traffic] starting daily sessions')
  console.log(`  target:   ${SITE_URL}`)
  console.log(
    `  sessions: ${research.name}, ${creative.name}, ${technical.name}`
  )

  const browser = await chromium.launch({ headless: true })

  try {
    await runSession(browser, research)
    await runSession(browser, creative)
    await runSession(browser, technical)
  } finally {
    await browser.close()
  }

  const elapsed = ((Date.now() - start) / 1_000).toFixed(0)
  console.log(`\n[synthetic-traffic] complete in ${elapsed}s`)
}

main().catch(err => {
  console.error('[synthetic-traffic] fatal:', err)
  process.exit(1)
})

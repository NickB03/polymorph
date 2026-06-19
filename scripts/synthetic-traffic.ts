#!/usr/bin/env bun
/**
 * Generates synthetic user traffic on polymorph.fyi for evals sampling.
 *
 * Authenticates as the seed user via the Supabase API, injects the session
 * cookies into a headless Playwright browser, then runs 3 Claude computer-use
 * sessions (researcher / student / professional). Each session creates a new
 * authenticated chat, which the evals traffic-monitor sampler picks up within
 * its 48-hour lookback window.
 *
 * Required env:
 *   ANTHROPIC_API_KEY, SEED_USER_EMAIL, SEED_USER_PASSWORD,
 *   SUPABASE_URL, SUPABASE_ANON_KEY
 *   APP_URL  (default: https://polymorph.fyi)
 */

import Anthropic from '@anthropic-ai/sdk'
import { createBrowserClient } from '@supabase/ssr'
import { chromium, type Page } from 'playwright'

const APP_URL = (process.env.APP_URL ?? 'https://polymorph.fyi').replace(
  /\/$/,
  ''
)
const WIDTH = 1280
const HEIGHT = 800
const MAX_STEPS = 40

const client = new Anthropic()

// computer_20250124 is the January 2025 computer-use tool revision.
const COMPUTER_TOOL = {
  type: 'computer_20250124' as const,
  name: 'computer' as const,
  display_width_px: WIDTH,
  display_height_px: HEIGHT
}

interface Session {
  id: string
  persona: string
  task: string
}

const SESSIONS: Session[] = [
  {
    id: 'researcher',
    persona:
      'A curious researcher interested in current scientific developments',
    task: 'Start a new chat and ask a substantive research question about a current topic — e.g. recent progress in fusion energy, developments in quantum computing, or advances in longevity science. After the assistant finishes responding, ask two natural follow-up questions based on what you read. Read each response fully (scroll down if needed) before continuing. Stop using tools once you have read the final response.'
  },
  {
    id: 'student',
    persona: 'A university student trying to understand a complex concept',
    task: 'Start a new chat and ask a conceptual learning question — e.g. "How do mRNA vaccines work?", "What caused the 2008 financial crisis?", or "How does the electoral college system work?". After the assistant responds, ask one follow-up question for deeper understanding. Read the final response fully before stopping.'
  },
  {
    id: 'professional',
    persona: 'A business professional seeking strategic insights',
    task: 'Start a new chat and ask a substantive professional question about technology or strategy — e.g. "What are the key implications of recent AI regulation for enterprise software teams?" or "What should companies consider when rolling out AI coding assistants?". After the assistant responds, ask one thoughtful follow-up. Read the final response fully before stopping.'
  }
]

// -- Auth ------------------------------------------------------------------

type CookieStore = Map<string, string>

async function authenticate(): Promise<CookieStore> {
  const store: CookieStore = new Map()
  const supabase = createBrowserClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () =>
          [...store.entries()].map(([name, value]) => ({ name, value })),
        setAll: (
          cookies: Array<{
            name: string
            value: string
            options?: Record<string, unknown>
          }>
        ) => {
          for (const { name, value } of cookies) {
            if (!value) store.delete(name)
            else store.set(name, value)
          }
        }
      }
    }
  )
  const { error } = await supabase.auth.signInWithPassword({
    email: process.env.SEED_USER_EMAIL!,
    password: process.env.SEED_USER_PASSWORD!
  })
  if (error) throw new Error(`Supabase auth failed: ${error.message}`)
  return store
}

// -- Computer use ----------------------------------------------------------

function toPlaywrightKey(key: string): string {
  return key
    .replace(/\bReturn\b/g, 'Enter')
    .replace(/\bsuper\b/gi, 'Meta')
    .replace(/\bctrl\b/gi, 'Control')
    .replace(/\balt\b/gi, 'Alt')
    .replace(/\bshift\b/gi, 'Shift')
}

async function screenshot(page: Page) {
  const data = (await page.screenshot({ type: 'png' })).toString('base64')
  return {
    type: 'image' as const,
    source: { type: 'base64' as const, media_type: 'image/png' as const, data }
  }
}

async function executeAction(
  page: Page,
  input: Record<string, unknown>
): Promise<ReturnType<typeof screenshot>> {
  const action = input.action as string
  const [x, y] = (input.coordinate as [number, number] | undefined) ?? [0, 0]

  switch (action) {
    case 'screenshot':
      break
    case 'left_click':
      await page.mouse.click(x, y)
      break
    case 'right_click':
      await page.mouse.click(x, y, { button: 'right' })
      break
    case 'middle_click':
      await page.mouse.click(x, y, { button: 'middle' })
      break
    case 'double_click':
      await page.mouse.dblclick(x, y)
      break
    case 'triple_click':
      await page.mouse.click(x, y, { clickCount: 3 })
      break
    case 'type':
      await page.keyboard.type(input.text as string, { delay: 25 })
      break
    case 'key':
      await page.keyboard.press(toPlaywrightKey(input.key as string))
      break
    case 'scroll': {
      const dir = input.direction as string
      const px = ((input.amount as number) ?? 3) * 120
      await page.mouse.move(x, y)
      await page.mouse.wheel(
        dir === 'left' ? -px : dir === 'right' ? px : 0,
        dir === 'up' ? -px : dir === 'down' ? px : 0
      )
      break
    }
    case 'mouse_move':
      await page.mouse.move(x, y)
      break
    case 'left_click_drag': {
      const [ex, ey] = input.end_coordinate as [number, number]
      await page.mouse.move(x, y)
      await page.mouse.down()
      await page.mouse.move(ex, ey)
      await page.mouse.up()
      break
    }
    case 'wait':
      await page.waitForTimeout(1500)
      break
    default:
      console.warn(`[traffic] Unknown action: ${action}`)
  }

  // Let the UI settle before snapshotting
  if (action !== 'screenshot') {
    await page.waitForTimeout(800)
  }

  return screenshot(page)
}

async function runSession(page: Page, session: Session): Promise<void> {
  console.log(`\n[traffic] --- Session: ${session.id} ---`)

  const system = `You are acting as a real user of Polymorph, an AI research assistant at ${APP_URL}.
You are already logged in. The browser shows a ${WIDTH}×${HEIGHT} viewport of the running application.
Persona: ${session.persona}

Guidelines:
- Navigate the UI naturally — click, type, and scroll as needed
- After submitting a message, wait for the streaming response to finish before interacting again (take a screenshot to confirm)
- Read each response fully, scrolling down if it is cut off, before writing a follow-up
- Stop calling tools once you have completed the task and read the final response
- If the page shows an error or unexpected state, take a screenshot to assess before retrying`

  const messages: any[] = [{ role: 'user', content: session.task }]
  let steps = 0

  while (steps < MAX_STEPS) {
    const response = await (client.beta.messages.create as any)({
      model: 'claude-sonnet-4-6',
      max_tokens: 2048,
      system,
      tools: [COMPUTER_TOOL],
      messages,
      betas: ['computer-use-2025-01-24']
    })

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      console.log(`[traffic] Session ${session.id} complete (step ${steps})`)
      return
    }

    if (response.stop_reason !== 'tool_use') {
      console.warn(
        `[traffic] Session ${session.id} unexpected stop: ${response.stop_reason}`
      )
      return
    }

    const toolResults: any[] = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      const image = await executeAction(
        page,
        block.input as Record<string, unknown>
      )
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: [image]
      })
    }

    messages.push({ role: 'user', content: toolResults })
    steps++
  }

  console.warn(`[traffic] Session ${session.id} hit step cap (${MAX_STEPS})`)
}

// -- Main ------------------------------------------------------------------

async function main() {
  for (const name of [
    'ANTHROPIC_API_KEY',
    'SEED_USER_EMAIL',
    'SEED_USER_PASSWORD',
    'SUPABASE_URL',
    'SUPABASE_ANON_KEY'
  ]) {
    if (!process.env[name]) throw new Error(`Missing required env var: ${name}`)
  }

  console.log('[traffic] Authenticating seed user...')
  const cookieStore = await authenticate()
  console.log(`[traffic] Auth OK — ${cookieStore.size} cookies`)

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  })

  const hostname = new URL(APP_URL).hostname
  const secure = APP_URL.startsWith('https')
  await context.addCookies(
    [...cookieStore.entries()].map(([name, value]) => ({
      name,
      value,
      domain: hostname,
      path: '/',
      httpOnly: false,
      secure,
      sameSite: 'Lax' as const
    }))
  )

  const page = await context.newPage()
  console.log(`[traffic] Navigating to ${APP_URL}...`)
  await page.goto(APP_URL, { waitUntil: 'networkidle', timeout: 30_000 })

  let succeeded = 0
  for (const session of SESSIONS) {
    try {
      await runSession(page, session)
      succeeded++
    } catch (err) {
      console.error(
        `[traffic] Session ${session.id} failed:`,
        err instanceof Error ? err.message : err
      )
    }
  }

  await browser.close()
  console.log(
    `\n[traffic] Done: ${succeeded}/${SESSIONS.length} sessions succeeded`
  )
  if (succeeded === 0) process.exit(1)
}

main().catch(err => {
  console.error('[traffic] Fatal:', err)
  process.exit(1)
})

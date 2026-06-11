#!/usr/bin/env bun
/**
 * Generates synthetic user sessions on polymorph.fyi for eval pipeline traffic.
 * Uses Claude computer use to navigate the browser naturally — not hardcoded clicks.
 *
 * Required env:
 *   ANTHROPIC_API_KEY    Anthropic API key
 *   POLYMORPH_COOKIES    Session cookie string (copy from DevTools → Network → Cookie header)
 *
 * Optional env:
 *   SYNTHETIC_URL        Target URL (default: https://polymorph.fyi)
 *   SYNTHETIC_SESSIONS   Number of sessions (default: 3)
 *   SYNTHETIC_DRY_RUN    Print selected sessions without running (any non-empty value)
 *   SYNTHETIC_MODEL      Claude model for computer use (default: claude-haiku-4-5-20251001)
 */

import Anthropic from '@anthropic-ai/sdk'
import { chromium, type Page } from 'playwright'

const TARGET_URL = process.env.SYNTHETIC_URL ?? 'https://polymorph.fyi'
const SESSION_COUNT = parseInt(process.env.SYNTHETIC_SESSIONS ?? '3', 10)
const DRY_RUN = Boolean(process.env.SYNTHETIC_DRY_RUN)
const MODEL = process.env.SYNTHETIC_MODEL ?? 'claude-haiku-4-5-20251001'
const DISPLAY_W = 1280
const DISPLAY_H = 800
const MAX_STEPS = 25

// Pool of realistic session prompts — 3 are picked randomly on each run
const SESSION_POOL = [
  {
    id: 'llm-trends',
    task: `Go to ${TARGET_URL} and start a new chat. Ask about the most significant developments in large language models and AI agents in 2025. After reading the response, ask one follow-up about practical applications for developers.`
  },
  {
    id: 'climate-research',
    task: `Go to ${TARGET_URL} and research the latest scientific findings on climate tipping points. Ask what the current data says about the likelihood of crossing 1.5°C warming. Read the full response.`
  },
  {
    id: 'creative-brainstorm',
    task: `Go to ${TARGET_URL} and ask the AI to brainstorm five SaaS product ideas for a solo developer in 2025 that leverage AI capabilities. Read through the ideas.`
  },
  {
    id: 'quantum-explainer',
    task: `Go to ${TARGET_URL} and start a new conversation asking for a plain-English explanation of how quantum computing differs from classical computing. Then follow up asking about the current state of quantum error correction.`
  },
  {
    id: 'space-exploration',
    task: `Go to ${TARGET_URL} and research the current status of commercial space exploration — what are SpaceX, Blue Origin, and NASA working on right now? What's the realistic timeline for crewed Mars missions?`
  },
  {
    id: 'biotech-crispr',
    task: `Go to ${TARGET_URL} and ask the AI to explain how CRISPR-Cas9 gene editing works and what diseases it may be able to treat in the coming decade. Read the response thoroughly.`
  },
  {
    id: 'ai-regulation',
    task: `Go to ${TARGET_URL} and research the current landscape of AI regulation — what has the EU AI Act mandated, and how does US federal policy compare? Ask about what this means for AI startups.`
  },
  {
    id: 'web-architecture',
    task: `Go to ${TARGET_URL} and start a chat asking for advice on choosing between server-side rendering and client-side rendering for a new web app in 2025. Ask about trade-offs with Next.js App Router specifically.`
  }
]

function pickSessions(count: number) {
  const shuffled = [...SESSION_POOL].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, Math.min(count, SESSION_POOL.length))
}

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function captureScreen(page: Page): Promise<string> {
  const buf = await page.screenshot({ type: 'png' })
  return Buffer.from(buf).toString('base64')
}

type ImageContent = {
  type: 'image'
  source: { type: 'base64'; media_type: 'image/png'; data: string }
}
type TextContent = { type: 'text'; text: string }
type ToolContent = ImageContent | TextContent

async function executeAction(
  page: Page,
  input: Record<string, unknown>
): Promise<ToolContent[]> {
  const screen = async (): Promise<ToolContent[]> => [
    {
      type: 'image',
      source: {
        type: 'base64',
        media_type: 'image/png',
        data: await captureScreen(page)
      }
    }
  ]

  const action = input.action as string
  const coord = input.coordinate as [number, number] | undefined

  switch (action) {
    case 'screenshot':
      return screen()

    case 'left_click':
      await page.mouse.click(coord![0], coord![1])
      await sleep(700)
      return screen()

    case 'double_click':
      await page.mouse.dblclick(coord![0], coord![1])
      await sleep(700)
      return screen()

    case 'right_click':
      await page.mouse.click(coord![0], coord![1], { button: 'right' })
      await sleep(400)
      return screen()

    case 'mouse_move':
      await page.mouse.move(coord![0], coord![1])
      return [{ type: 'text', text: 'moved' }]

    case 'type':
      await page.keyboard.type(String(input.text), { delay: 45 })
      await sleep(400)
      return screen()

    case 'key': {
      // Playwright uses 'Enter' not 'Return', 'Control+' not 'ctrl+'
      const key = String(input.text)
        .replace(/\bReturn\b/g, 'Enter')
        .replace(/\bctrl\+/gi, 'Control+')
        .replace(/\bmeta\+/gi, 'Meta+')
      await page.keyboard.press(key)
      await sleep(700)
      return screen()
    }

    case 'scroll': {
      await page.mouse.move(coord![0], coord![1])
      const amount = (input.amount as number) ?? 3
      const delta = input.direction === 'up' ? -(amount * 120) : amount * 120
      await page.mouse.wheel(0, delta)
      await sleep(400)
      return screen()
    }

    case 'wait':
      await sleep(Math.min((input.duration as number) ?? 1000, 5000))
      return screen()

    default:
      return [{ type: 'text', text: `unsupported action: ${action}` }]
  }
}

async function runSession(
  client: Anthropic,
  page: Page,
  session: { id: string; task: string }
): Promise<void> {
  console.log(`\n[${session.id}] Starting`)

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: session.task }
  ]

  for (let step = 0; step < MAX_STEPS; step++) {
    // Type assertion: computer_20250124 is a beta tool not yet in the stable type definitions
    const response = await (client.messages.create as Function)({
      model: MODEL,
      max_tokens: 2048,
      tools: [
        {
          type: 'computer_20250124',
          name: 'computer',
          display_width_px: DISPLAY_W,
          display_height_px: DISPLAY_H
        }
      ],
      messages
    })

    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'end_turn') {
      console.log(`[${session.id}] Done (${step + 1} steps)`)
      break
    }

    const toolUses = (response.content as Anthropic.ContentBlock[]).filter(
      (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
    )
    if (toolUses.length === 0) break

    const results: Anthropic.ToolResultBlockParam[] = []
    for (const tool of toolUses) {
      const actionInput = tool.input as Record<string, unknown>
      console.log(
        `[${session.id}] step=${step + 1} action=${actionInput.action ?? tool.name}`
      )
      const content = await executeAction(page, actionInput)
      results.push({ type: 'tool_result', tool_use_id: tool.id, content })
    }

    messages.push({ role: 'user', content: results })

    // Brief pause to avoid rate-limiting
    await sleep(400)
  }
}

function parseCookies(
  cookieStr: string,
  url: string
): Array<{ name: string; value: string; domain: string; path: string }> {
  const { hostname } = new URL(url)
  return cookieStr
    .split(';')
    .map(s => s.trim())
    .filter(Boolean)
    .flatMap(part => {
      const eq = part.indexOf('=')
      if (eq === -1) return []
      return [
        {
          name: part.slice(0, eq).trim(),
          value: part.slice(eq + 1).trim(),
          domain: hostname,
          path: '/'
        }
      ]
    })
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('[synthetic-traffic] ANTHROPIC_API_KEY is required')
    process.exit(1)
  }

  const sessions = pickSessions(SESSION_COUNT)

  if (DRY_RUN) {
    console.log('[synthetic-traffic] Dry run — selected sessions:')
    for (const s of sessions) {
      console.log(`  [${s.id}] ${s.task.slice(0, 90)}...`)
    }
    return
  }

  console.log(
    `[synthetic-traffic] Running ${sessions.length} sessions on ${TARGET_URL} with ${MODEL}`
  )

  const client = new Anthropic({
    apiKey,
    defaultHeaders: { 'anthropic-beta': 'computer-use-2025-01-24' }
  })

  const browser = await chromium.launch({ headless: true })
  const context = await browser.newContext({
    viewport: { width: DISPLAY_W, height: DISPLAY_H }
  })

  const cookies = process.env.POLYMORPH_COOKIES
  if (cookies) {
    const parsed = parseCookies(cookies, TARGET_URL)
    await context.addCookies(parsed)
    console.log(`[synthetic-traffic] Injected ${parsed.length} auth cookies`)
  } else {
    console.warn(
      '[synthetic-traffic] No POLYMORPH_COOKIES — sessions will run as guest'
    )
  }

  const page = await context.newPage()

  try {
    for (const session of sessions) {
      await runSession(client, page, session)
      await sleep(4000)
    }
  } finally {
    await browser.close()
  }

  console.log(`\n[synthetic-traffic] Completed ${sessions.length} sessions`)
}

main().catch(err => {
  console.error('[synthetic-traffic] Fatal:', err)
  process.exit(1)
})

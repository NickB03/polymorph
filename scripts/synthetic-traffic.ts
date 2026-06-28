#!/usr/bin/env bun
/**
 * Synthetic traffic generator for polymorph.fyi
 *
 * Uses Claude computer use to drive a headless Chromium browser through 3 realistic
 * user sessions each day, giving the eval sampler real traffic to audit against.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY       — Claude API key (uses claude-opus-4-8 with computer use)
 *   TRAFFIC_BOT_EMAIL       — Email of the Polymorph account to use
 *   TRAFFIC_BOT_PASSWORD    — Password for that account
 *
 * Optional:
 *   TRAFFIC_BOT_URL         — Override base URL (default: https://polymorph.fyi)
 *   CHROMIUM_EXECUTABLE_PATH — Override Chromium binary path
 *
 * Run manually: bun run scripts/synthetic-traffic.ts
 * Scheduled:   .github/workflows/synthetic-traffic.yml (daily at 14:00 UTC)
 */

import Anthropic from '@anthropic-ai/sdk'
import type { Browser, Page } from 'playwright'
import { chromium } from 'playwright'

const DISPLAY_WIDTH = 1280
const DISPLAY_HEIGHT = 900
const BASE_URL = process.env.TRAFFIC_BOT_URL ?? 'https://polymorph.fyi'
const MAX_STEPS_PER_SESSION = 50

for (const key of [
  'ANTHROPIC_API_KEY',
  'TRAFFIC_BOT_EMAIL',
  'TRAFFIC_BOT_PASSWORD'
]) {
  if (!process.env[key]) {
    console.error(`Missing required env var: ${key}`)
    process.exit(1)
  }
}

const EMAIL = process.env.TRAFFIC_BOT_EMAIL!
const PASSWORD = process.env.TRAFFIC_BOT_PASSWORD!

const client = new Anthropic()

// Three distinct user personas generating different kinds of eval-auditable traffic.
// Each session produces 2-3 conversation turns covering different search modes.
const SESSIONS = [
  {
    label: 'researcher',
    prompt: `You are a tech researcher using an AI research assistant called Polymorph.
You are already at the site. Log in using email "${EMAIL}" and password "${PASSWORD}".

Once logged in, start a new chat and ask a substantive research question about AI or technology —
for example, recent advances in reasoning models, AI safety approaches, or the state of open-source LLMs.
After the assistant responds, ask one natural follow-up question that digs deeper.
When you have received two assistant responses, you are done — do not continue.`
  },
  {
    label: 'developer',
    prompt: `You are a software developer using an AI assistant for technical help.
You are already at the site. Log in using email "${EMAIL}" and password "${PASSWORD}".

Once logged in, start a new chat and ask a practical technical question — something like
a TypeScript/React pattern, a system design tradeoff, or a debugging approach.
After the assistant responds, ask one clarifying follow-up.
Stop after receiving two assistant responses.`
  },
  {
    label: 'curious-learner',
    prompt: `You are a curious generalist using an AI to learn about the world.
You are already at the site. Log in using email "${EMAIL}" and password "${PASSWORD}".

Once logged in, start a new chat and ask about something outside of software —
climate science, economic history, biology, or geopolitics. Make it specific and interesting.
After the assistant responds, ask one follow-up that takes the topic somewhere unexpected.
Stop after receiving two assistant responses.`
  }
]

async function captureScreenshot(page: Page): Promise<string> {
  const buffer = await page.screenshot({ type: 'png' })
  return buffer.toString('base64')
}

type ToolResultContent = Anthropic.ToolResultBlockParam['content']

async function executeAction(
  page: Page,
  input: Record<string, unknown>
): Promise<ToolResultContent> {
  const action = input.action as string
  const coordinate = input.coordinate as [number, number] | undefined
  const text = input.text as string | undefined
  const key = input.key as string | undefined

  switch (action) {
    case 'screenshot': {
      const data = await captureScreenshot(page)
      return [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/png', data }
        }
      ]
    }

    case 'left_click':
    case 'click': {
      if (coordinate) {
        await page.mouse.click(coordinate[0], coordinate[1])
        await page.waitForTimeout(800)
      }
      break
    }

    case 'double_click': {
      if (coordinate) {
        await page.mouse.dblclick(coordinate[0], coordinate[1])
        await page.waitForTimeout(500)
      }
      break
    }

    case 'right_click': {
      if (coordinate) {
        await page.mouse.click(coordinate[0], coordinate[1], {
          button: 'right'
        })
        await page.waitForTimeout(300)
      }
      break
    }

    case 'type': {
      if (text) await page.keyboard.type(text, { delay: 40 })
      break
    }

    case 'key': {
      if (key) {
        // Playwright uses different key names for some keys
        const mapped = key.replace('Return', 'Enter').replace('super+', 'Meta+')
        await page.keyboard.press(mapped)
        await page.waitForTimeout(400)
      }
      break
    }

    case 'scroll': {
      if (coordinate) {
        const direction = input.scrollDirection as string
        const distance = ((input.scrollDistance as number) ?? 3) * 100
        await page.mouse.move(coordinate[0], coordinate[1])
        await page.mouse.wheel(0, direction === 'up' ? -distance : distance)
        await page.waitForTimeout(300)
      }
      break
    }

    case 'mouse_move': {
      if (coordinate) await page.mouse.move(coordinate[0], coordinate[1])
      break
    }

    case 'left_click_drag': {
      if (coordinate && input.startCoordinate) {
        const start = input.startCoordinate as [number, number]
        await page.mouse.move(start[0], start[1])
        await page.mouse.down()
        await page.mouse.move(coordinate[0], coordinate[1])
        await page.mouse.up()
        await page.waitForTimeout(400)
      }
      break
    }

    default:
      console.log(`  [action] ${action} (unhandled, skipping)`)
  }

  return [{ type: 'text', text: `${action} executed` }]
}

async function runSession(
  browser: Browser,
  session: (typeof SESSIONS)[0],
  idx: number
): Promise<void> {
  console.log(`\n[${idx + 1}/3] Session: ${session.label}`)

  const context = await browser.newContext({
    viewport: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  })

  const page = await context.newPage()

  try {
    await page.goto(BASE_URL, {
      timeout: 30_000,
      waitUntil: 'domcontentloaded'
    })
    const initialScreenshot = await captureScreenshot(page)

    const messages: Anthropic.MessageParam[] = [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: initialScreenshot
            }
          },
          { type: 'text', text: session.prompt }
        ]
      }
    ]

    for (let step = 0; step < MAX_STEPS_PER_SESSION; step++) {
      const response = await client.beta.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 2048,
        tools: [
          {
            type: 'computer_20241022' as const,
            name: 'computer',
            display_width_px: DISPLAY_WIDTH,
            display_height_px: DISPLAY_HEIGHT
          }
        ],
        messages,
        betas: ['computer-use-2024-10-22']
      })

      messages.push({
        role: 'assistant',
        content: response.content as unknown as Anthropic.ContentBlockParam[]
      })

      if (response.stop_reason === 'end_turn') {
        console.log(`  Done after ${step + 1} steps`)
        break
      }

      const toolResults: Anthropic.ToolResultBlockParam[] = []

      for (const block of response.content) {
        if (block.type === 'tool_use' && block.name === 'computer') {
          const content = await executeAction(
            page,
            block.input as Record<string, unknown>
          )
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content
          })
        }
      }

      if (toolResults.length > 0) {
        messages.push({ role: 'user', content: toolResults })
      }
    }
  } finally {
    await context.close()
  }
}

async function main(): Promise<void> {
  console.log(`Synthetic traffic generator — ${new Date().toISOString()}`)
  console.log(`Target: ${BASE_URL}`)

  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  })

  try {
    for (let i = 0; i < SESSIONS.length; i++) {
      try {
        await runSession(browser, SESSIONS[i], i)
      } catch (err) {
        console.error(
          `[${i + 1}/3] Session "${SESSIONS[i].label}" failed:`,
          err
        )
      }

      if (i < SESSIONS.length - 1) {
        console.log('  Pausing 8s between sessions...')
        await new Promise(r => setTimeout(r, 8_000))
      }
    }
  } finally {
    await browser.close()
  }

  console.log(`\nAll sessions complete — ${new Date().toISOString()}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})

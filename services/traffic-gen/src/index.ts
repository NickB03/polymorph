#!/usr/bin/env bun
// Generates synthetic user sessions on polymorph.fyi using Claude computer use.
//
// First-time setup (run once):
//   cd services/traffic-gen && bun install && bun run setup
//
// Usage:
//   ANTHROPIC_API_KEY=<key> bun run src/index.ts
//   ANTHROPIC_API_KEY=<key> TRAFFIC_TARGET_URL=http://localhost:43100 bun run src/index.ts

import Anthropic from '@anthropic-ai/sdk'
import { chromium } from 'playwright'
import type { Page } from 'playwright'

const TARGET_URL = process.env.TRAFFIC_TARGET_URL ?? 'https://polymorph.fyi'
const SESSION_COUNT = parseInt(process.env.TRAFFIC_SESSION_COUNT ?? '3', 10)
const DISPLAY_WIDTH = 1280
const DISPLAY_HEIGHT = 900
const MAX_STEPS_PER_SESSION = 35

interface Session {
  mode: 'search' | 'research' | 'build'
  query: string
  followUp?: string
}

// 3 prompts per mode — one of each is picked per run for coverage diversity
const SESSION_POOL: Session[] = [
  {
    mode: 'research',
    query:
      'What are the latest developments in fusion energy and when might it realistically be commercially viable?',
    followUp: 'What are the main technical obstacles still to overcome?',
  },
  {
    mode: 'research',
    query: 'How has AI changed drug discovery over the past five years?',
    followUp: 'What are the most promising results from AI-designed drugs so far?',
  },
  {
    mode: 'research',
    query:
      'Explain the current state of quantum computing and its nearest practical applications',
    followUp: 'Which companies or research groups are closest to practical quantum advantage?',
  },
  {
    mode: 'search',
    query: 'What is the current federal funds rate and when was it last changed?',
  },
  {
    mode: 'search',
    query: 'What were the main economic outcomes from the most recent G7 summit?',
  },
  {
    mode: 'search',
    query: 'What symptoms are currently used to diagnose long COVID?',
  },
  {
    mode: 'build',
    query:
      'Create an interactive timeline of major space exploration milestones from 1957 to today',
  },
  {
    mode: 'build',
    query:
      'Build a compound interest calculator with a chart showing portfolio growth over 30 years',
  },
  {
    mode: 'build',
    query:
      'Create a visual comparison of the planets in our solar system showing their relative sizes',
  },
]

function pickSessions(n: number): Session[] {
  const byMode = {
    research: SESSION_POOL.filter(s => s.mode === 'research').sort(() => Math.random() - 0.5),
    search: SESSION_POOL.filter(s => s.mode === 'search').sort(() => Math.random() - 0.5),
    build: SESSION_POOL.filter(s => s.mode === 'build').sort(() => Math.random() - 0.5),
  }
  const modes: Array<keyof typeof byMode> = ['search', 'research', 'build']
  const selected: Session[] = []
  for (let i = 0; selected.length < n; i++) {
    const pool = byMode[modes[i % modes.length]]
    if (pool.length > 0) selected.push(pool.shift()!)
  }
  return selected
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

type ComputerInput = {
  action: string
  coordinate?: [number, number]
  text?: string
  key?: string
  scroll_direction?: 'up' | 'down' | 'left' | 'right'
  scroll_distance?: number
}

async function executeAction(page: Page, input: ComputerInput): Promise<void> {
  const KEY_MAP: Record<string, string> = { Return: 'Enter', Super: 'Meta' }

  switch (input.action) {
    case 'screenshot':
      break
    case 'left_click':
      if (input.coordinate) {
        await page.mouse.click(input.coordinate[0], input.coordinate[1])
        await sleep(400)
      }
      break
    case 'right_click':
      if (input.coordinate) {
        await page.mouse.click(input.coordinate[0], input.coordinate[1], { button: 'right' })
        await sleep(300)
      }
      break
    case 'double_click':
      if (input.coordinate) {
        await page.mouse.dblclick(input.coordinate[0], input.coordinate[1])
        await sleep(300)
      }
      break
    case 'type':
      if (input.text) {
        await page.keyboard.type(input.text, { delay: 40 })
        await sleep(300)
      }
      break
    case 'key':
      if (input.key) {
        await page.keyboard.press(KEY_MAP[input.key] ?? input.key)
        await sleep(300)
      }
      break
    case 'scroll':
      if (input.coordinate) {
        const dist = (input.scroll_distance ?? 3) * 100
        const dy =
          input.scroll_direction === 'down' ? dist : input.scroll_direction === 'up' ? -dist : 0
        const dx =
          input.scroll_direction === 'right'
            ? dist
            : input.scroll_direction === 'left'
              ? -dist
              : 0
        await page.mouse.move(input.coordinate[0], input.coordinate[1])
        await page.mouse.wheel(dx, dy)
        await sleep(300)
      }
      break
    case 'mouse_move':
      if (input.coordinate) await page.mouse.move(input.coordinate[0], input.coordinate[1])
      break
  }
}

function buildPrompt(session: Session): string {
  const modeStep =
    session.mode === 'research'
      ? 'Enable Research mode by clicking the mode selector near the chat input (look for an ellipsis "…" button or a "Research" pill)'
      : session.mode === 'build'
        ? 'Enable Build mode by clicking the mode selector near the chat input (look for an ellipsis "…" button or a "Build" pill)'
        : 'Use the default Search mode — no mode change needed'

  return `You are simulating a real user on ${TARGET_URL}. Complete this task:

1. ${modeStep}
2. Click the chat input at the bottom of the page and type exactly: "${session.query}"
3. Submit the message (press Enter or click the send button).
4. Wait for the AI response to finish streaming (the loading spinner disappears and text settles). This takes 20–90 seconds — be patient.${
    session.followUp
      ? `\n5. After the full response appears, type and submit this follow-up: "${session.followUp}"\n6. Wait for that response to finish as well.`
      : ''
  }

When all messages have received complete responses, say exactly: SESSION_COMPLETE

Rules:
- Do not click "New Chat" — use the current page
- Do not generate images or create canvas artifacts
- If you see a login page, look for "Continue as guest" or similar
- Wait patiently for streaming responses before taking the next action`
}

interface SessionResult {
  ok: boolean
  steps: number
}

async function runSession(
  client: Anthropic,
  session: Session,
  index: number
): Promise<SessionResult> {
  console.log(
    `\n[session ${index + 1}/${SESSION_COUNT}] mode=${session.mode} | "${session.query.slice(0, 70)}..."`
  )

  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext({
    viewport: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  })
  const page = await ctx.newPage()
  page.on('console', () => {})
  page.on('pageerror', () => {})

  let steps = 0
  let ok = false

  try {
    console.log(`[session ${index + 1}] Loading ${TARGET_URL}...`)
    await page.goto(TARGET_URL, { waitUntil: 'networkidle', timeout: 45_000 })
    await sleep(2500)

    const messages: Anthropic.Beta.BetaMessageParam[] = []

    while (steps < MAX_STEPS_PER_SESSION) {
      steps++

      const screenshot = await page.screenshot({ type: 'jpeg', quality: 65 })

      const userContent: Anthropic.Beta.BetaContentBlockParam[] = [
        {
          type: 'image',
          source: { type: 'base64', media_type: 'image/jpeg', data: screenshot.toString('base64') },
        },
        {
          type: 'text',
          text:
            steps === 1
              ? buildPrompt(session)
              : 'Continue. If waiting for the AI response to finish streaming, take another screenshot after a short pause.',
        },
      ]

      messages.push({ role: 'user', content: userContent })

      const response = await client.beta.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        betas: ['computer-use-2025-01-24'],
        tools: [
          {
            type: 'computer_20250124' as const,
            name: 'computer',
            display_width_px: DISPLAY_WIDTH,
            display_height_px: DISPLAY_HEIGHT,
          },
        ],
        messages,
      })

      messages.push({
        role: 'assistant',
        content: response.content as Anthropic.Beta.BetaContentBlock[],
      })

      for (const block of response.content) {
        if (block.type === 'text' && block.text.includes('SESSION_COMPLETE')) {
          console.log(`[session ${index + 1}] Complete after ${steps} steps`)
          ok = true
          break
        }
      }
      if (ok) break

      let tookAction = false
      for (const block of response.content) {
        if (block.type !== 'tool_use' || block.name !== 'computer') continue
        tookAction = true
        await executeAction(page, block.input as ComputerInput)
      }

      if (response.stop_reason === 'end_turn' && !tookAction) {
        // No tool call — likely waiting for the AI to finish responding; pause then retry
        console.log(`[session ${index + 1}] Waiting for page activity... (step ${steps})`)
        await sleep(8000)
      }
    }

    if (!ok) {
      console.warn(
        `[session ${index + 1}] Did not receive SESSION_COMPLETE within ${steps} steps`
      )
    }
  } catch (err) {
    console.error(`[session ${index + 1}] Error:`, err instanceof Error ? err.message : err)
  } finally {
    await page.close()
    await ctx.close()
    await browser.close()
  }

  return { ok, steps }
}

async function main(): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required')
    process.exit(1)
  }

  const client = new Anthropic({ apiKey })
  const sessions = pickSessions(SESSION_COUNT)

  console.log(`[traffic-gen] Target: ${TARGET_URL}`)
  console.log(`[traffic-gen] Sessions to run: ${sessions.length}`)
  sessions.forEach((s, i) =>
    console.log(`  ${i + 1}. [${s.mode.padEnd(8)}] ${s.query.slice(0, 80)}`)
  )

  const results: SessionResult[] = []
  for (let i = 0; i < sessions.length; i++) {
    results.push(await runSession(client, sessions[i], i))
    if (i < sessions.length - 1) await sleep(3000)
  }

  const passed = results.filter(r => r.ok).length
  console.log(`\n[traffic-gen] ${passed}/${sessions.length} sessions completed`)
  results.forEach((r, i) =>
    console.log(`  session ${i + 1}: ${r.ok ? 'OK' : 'INCOMPLETE'} (${r.steps} steps)`)
  )

  if (passed === 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

#!/usr/bin/env bun
/**
 * Simulate 3 realistic user sessions on polymorph.fyi using Claude computer use.
 * Each session runs in an isolated Playwright browser context so auth state is
 * fresh per run. Topics rotate by day-of-year so traffic stays topically varied
 * across the eval pipeline's sampling window.
 *
 * Required env vars:
 *   ANTHROPIC_API_KEY
 *   POLYMORPH_TEST_EMAIL
 *   POLYMORPH_TEST_PASSWORD
 *
 * Optional:
 *   POLYMORPH_URL           (default: https://polymorph.fyi)
 *   SIMULATION_HEADLESS     (default: true — set false to watch locally)
 *   SIMULATION_MAX_STEPS    (default: 20 per session)
 */

import Anthropic from '@anthropic-ai/sdk'
import { chromium } from 'playwright'

const TARGET_URL = process.env.POLYMORPH_URL ?? 'https://polymorph.fyi'
const MODEL = 'claude-sonnet-4-6'
const DISPLAY_WIDTH = 1280
const DISPLAY_HEIGHT = 800
const MAX_STEPS = Number(process.env.SIMULATION_MAX_STEPS ?? 20)
const SESSION_TIMEOUT_MS = 10 * 60 * 1000
const HEADLESS = process.env.SIMULATION_HEADLESS !== 'false'

// ---------------------------------------------------------------------------
// Topic rotation — index by day-of-year so each calendar day uses a different
// topic without requiring external state.
// ---------------------------------------------------------------------------

function topicForDay(topics: string[]): string {
  const yearStart = new Date(new Date().getFullYear(), 0, 1).getTime()
  const dayOfYear = Math.floor((Date.now() - yearStart) / 86_400_000)
  return topics[dayOfYear % topics.length]
}

const RESEARCH_TOPICS = [
  'recent breakthroughs in quantum computing error correction',
  'latest developments in solid-state battery technology',
  'new findings in Alzheimer disease research 2025',
  'the current state of nuclear fusion energy — ITER and Commonwealth Fusion',
  'recent discoveries about dark matter and dark energy',
  'advances in mRNA vaccine platforms beyond COVID',
  'new results in large language model interpretability research',
  'autonomous vehicle safety regulation — where things stand',
  'recent progress in longevity and aging science',
  'offshore wind energy expansion and grid challenges',
  'breakthroughs in 2D materials for next-gen semiconductors',
  'current status of direct air carbon capture projects',
  'gut microbiome connections to mental health — latest studies',
  'geopolitics of the semiconductor supply chain'
]

const CHAT_TOPICS = [
  "how does quantum entanglement work, and why can't it send information faster than light",
  'explain the difference between monetary policy and fiscal policy',
  'what makes certain programming languages better suited to certain problem domains',
  'how does the immune system distinguish self from non-self',
  'explain how GPS calculates your exact position from satellites',
  'what is the halting problem and why does it matter for software',
  'how does a nuclear reactor produce electricity — step by step',
  'why are some mathematical proofs considered beautiful',
  'what is the efficient market hypothesis and what are its known limits',
  'how does general anesthesia actually work in the brain'
]

const CREATIVE_TASKS = [
  'Write a 300-word short story about a scientist who discovers that time runs backwards inside her lab',
  'Brainstorm 10 business ideas at the intersection of AI and environmental sustainability',
  'Draft a 200-word op-ed arguing for a universal 4-day work week',
  'Write a poem about the strange loneliness of late-night airports',
  'Outline a 10-minute talk on why mathematics is secretly everywhere in music',
  'Draft concise talking points for a debate on whether social media is net-positive for society',
  "Write a short children's story about a robot who learns to feel curious",
  'Give me 5 creative names and one-line taglines for a fictional climate-tech startup'
]

// ---------------------------------------------------------------------------
// Computer use tool execution via Playwright
// ---------------------------------------------------------------------------

type ActionResult = { text: string } | { imageBase64: string }

async function executeAction(
  page: import('playwright').Page,
  input: Record<string, unknown>
): Promise<ActionResult> {
  const action = input.action as string
  const coord = input.coordinate as [number, number] | undefined

  // Brief pause so Claude's actions look natural and the page has time to react
  await page.waitForTimeout(250)

  switch (action) {
    case 'screenshot': {
      const buf = await page.screenshot({ type: 'jpeg', quality: 75 })
      return { imageBase64: buf.toString('base64') }
    }

    case 'left_click':
      await page.mouse.click(coord![0], coord![1])
      await page.waitForTimeout(600)
      return { text: 'left_click done' }

    case 'right_click':
      await page.mouse.click(coord![0], coord![1], { button: 'right' })
      return { text: 'right_click done' }

    case 'double_click':
      await page.mouse.dblclick(coord![0], coord![1])
      await page.waitForTimeout(400)
      return { text: 'double_click done' }

    case 'type':
      await page.keyboard.type(input.text as string, { delay: 40 })
      return { text: 'typed' }

    case 'key':
      await page.keyboard.press(input.text as string)
      await page.waitForTimeout(300)
      return { text: `key ${input.text} pressed` }

    case 'scroll': {
      const direction = (input.direction as string) === 'up' ? -1 : 1
      const amount = ((input.amount as number) ?? 3) * 120 * direction
      await page.mouse.move(coord![0], coord![1])
      await page.mouse.wheel(0, amount)
      await page.waitForTimeout(400)
      return { text: 'scrolled' }
    }

    case 'mouse_move':
      await page.mouse.move(coord![0], coord![1])
      return { text: 'mouse moved' }

    case 'left_click_drag': {
      const start = input.startCoordinate as [number, number]
      await page.mouse.move(start[0], start[1])
      await page.mouse.down()
      await page.mouse.move(coord![0], coord![1], { steps: 10 })
      await page.mouse.up()
      return { text: 'drag done' }
    }

    case 'cursor_position':
      return { text: 'cursor position acknowledged' }

    default:
      return { text: `unknown action: ${action}` }
  }
}

// ---------------------------------------------------------------------------
// Session runner — one computer-use loop per session
// ---------------------------------------------------------------------------

interface SessionConfig {
  name: string
  task: string
}

interface SessionResult {
  name: string
  success: boolean
  steps: number
  durationMs: number
  summary?: string
  error?: string
}

function buildSystemPrompt(credentials: {
  email: string
  password: string
}): string {
  return `You are simulating a real human user visiting ${TARGET_URL}, an AI-powered research and exploration platform. Your goal is to complete the given task naturally, as a curious person would.

Authentication: If the page shows a login screen or redirects to sign-in, use:
  Email: ${credentials.email}
  Password: ${credentials.password}

Behavioral rules:
- Always take a screenshot first to see the current state before acting.
- Read what is on screen before clicking. Wait for pages and AI responses to fully load.
- Type naturally — don't paste large blocks of text all at once.
- If a response is still streaming (loading indicator), wait a few seconds then take another screenshot.
- If you encounter an error or unexpected redirect, navigate back to ${TARGET_URL} and try again.
- Interact only with the main chat interface. Don't explore settings, account pages, or unrelated UI.

When you have completed the task (messages sent, responses read, any follow-up done), write a one-paragraph summary of what you did and stop using the computer tool. The absence of a computer tool call signals that the session is finished.`
}

async function runSession(
  client: Anthropic,
  page: import('playwright').Page,
  config: SessionConfig,
  credentials: { email: string; password: string }
): Promise<SessionResult> {
  const startTime = Date.now()
  let steps = 0

  console.log(`\n▶ Session: ${config.name}`)
  console.log(`  Task: ${config.task.slice(0, 100)}...`)

  try {
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    })
  } catch {
    // domcontentloaded is enough — don't fail on slow network idle
  }
  await page.waitForTimeout(2_000)

  const messages: Anthropic.Beta.BetaMessageParam[] = [
    {
      role: 'user',
      content: [{ type: 'text', text: config.task }]
    }
  ]

  while (steps < MAX_STEPS && Date.now() - startTime < SESSION_TIMEOUT_MS) {
    const response = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 4096,
      tools: [
        {
          type: 'computer_20241022' as const,
          name: 'computer',
          display_width_px: DISPLAY_WIDTH,
          display_height_px: DISPLAY_HEIGHT
        }
      ],
      system: buildSystemPrompt(credentials),
      messages,
      betas: ['computer-use-2024-10-22']
    })

    messages.push({ role: 'assistant', content: response.content })

    const toolUses = response.content.filter(
      (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use'
    )

    if (toolUses.length === 0) {
      // Claude finished — extract its closing summary
      const summary = response.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map(b => b.text)
        .join('\n')
        .trim()
      console.log(
        `  ✓ Complete — ${steps} steps, ${((Date.now() - startTime) / 1000).toFixed(1)}s`
      )
      return {
        name: config.name,
        success: true,
        steps,
        durationMs: Date.now() - startTime,
        summary
      }
    }

    // Execute each tool use and collect results
    const toolResults: Anthropic.Beta.BetaToolResultBlockParam[] = []
    for (const toolUse of toolUses) {
      const input = toolUse.input as Record<string, unknown>
      const actionLabel = input.action as string
      if (actionLabel !== 'screenshot') {
        console.log(`  Step ${steps + 1}: ${actionLabel}`)
      }

      const result = await executeAction(page, input)

      if ('imageBase64' in result) {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: [
            {
              type: 'image',
              source: {
                type: 'base64',
                media_type: 'image/jpeg',
                data: result.imageBase64
              }
            }
          ]
        })
      } else {
        toolResults.push({
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content: result.text
        })
      }
    }

    messages.push({ role: 'user', content: toolResults })
    steps++
  }

  const reason = steps >= MAX_STEPS ? 'reached max steps' : 'timed out'
  console.log(`  ✗ Incomplete — ${reason}`)
  return {
    name: config.name,
    success: false,
    steps,
    durationMs: Date.now() - startTime,
    error: reason
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  const email = process.env.POLYMORPH_TEST_EMAIL
  const password = process.env.POLYMORPH_TEST_PASSWORD

  if (!apiKey) throw new Error('ANTHROPIC_API_KEY is required')
  if (!email) throw new Error('POLYMORPH_TEST_EMAIL is required')
  if (!password) throw new Error('POLYMORPH_TEST_PASSWORD is required')

  const credentials = { email, password }
  const client = new Anthropic({ apiKey })

  const researchTopic = topicForDay(RESEARCH_TOPICS)
  const chatTopic = topicForDay(CHAT_TOPICS)
  const creativeTask = topicForDay(CREATIVE_TASKS)

  const sessions: SessionConfig[] = [
    {
      name: 'research',
      task: `Take a screenshot first. Then start a new conversation on the site and research this topic in depth: "${researchTopic}". After the response loads, ask one meaningful follow-up question. Read that response too. Then write a brief summary of what you found and stop.`
    },
    {
      name: 'multi-turn-chat',
      task: `Take a screenshot first. Start a new conversation and ask: "${chatTopic}". Once the response finishes loading, scroll to read it fully, then ask one clarifying follow-up. After reading the second response, write a brief summary and stop.`
    },
    {
      name: 'creative',
      task: `Take a screenshot first. Start a new conversation and ask: "${creativeTask}". After reading the response, request one small refinement or improvement. Read the revised output, then write a brief summary and stop.`
    }
  ]

  const browser = await chromium.launch({
    headless: HEADLESS,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage'
    ]
  })

  const results: SessionResult[] = []

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    // Fresh browser context per session — isolated cookies, storage, auth state
    const context = await browser.newContext({
      viewport: { width: DISPLAY_WIDTH, height: DISPLAY_HEIGHT },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    })
    const page = await context.newPage()

    try {
      const result = await runSession(client, page, session, credentials)
      results.push(result)
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ Session "${session.name}" threw: ${error}`)
      results.push({
        name: session.name,
        success: false,
        steps: 0,
        durationMs: 0,
        error
      })
    } finally {
      await context.close()
    }

    if (i < sessions.length - 1) {
      console.log('\nPausing 15s between sessions...')
      await new Promise(resolve => setTimeout(resolve, 15_000))
    }
  }

  await browser.close()

  // Print summary
  const passed = results.filter(r => r.success).length
  console.log(`\n${'─'.repeat(55)}`)
  console.log(
    `Traffic simulation: ${passed}/${results.length} sessions succeeded`
  )
  for (const r of results) {
    const icon = r.success ? '✓' : '✗'
    const time = `${(r.durationMs / 1000).toFixed(1)}s`
    const detail = r.error ? ` — ${r.error}` : ''
    console.log(`  ${icon} ${r.name}: ${r.steps} steps, ${time}${detail}`)
    if (r.summary) console.log(`    "${r.summary.slice(0, 120)}..."`)
  }
  console.log('─'.repeat(55))

  if (passed === 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err instanceof Error ? err.message : err)
  process.exit(1)
})

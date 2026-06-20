#!/usr/bin/env bun
/**
 * Synthetic traffic generator: Claude computer use + Playwright.
 *
 * Opens a real Chromium browser, drives it with Claude's computer-use API,
 * and sends 2-turn conversations on polymorph.fyi — producing authentic DB
 * rows that the evals sampler can pick up in the next traffic-monitor run.
 *
 * Required env:
 *   ANTHROPIC_API_KEY       - used for the computer-use agent loop
 *   SYNTH_TRAFFIC_COOKIES   - auth cookie string (copy from DevTools → Network
 *                             → any request → Cookie header). Falls back to
 *                             POLYMORPH_COOKIES if unset.
 *
 * Optional env:
 *   SYNTH_TARGET_URL        - defaults to https://polymorph.fyi
 *   SYNTH_HEADLESS          - 'false' to show the browser window (default 'true')
 *   SYNTH_SESSION_COUNT     - sessions per run (default 3)
 *   SYNTH_VIEWPORT_WIDTH    - default 1280
 *   SYNTH_VIEWPORT_HEIGHT   - default 720
 */

import { chromium, type Page } from 'playwright'

const TARGET_URL = process.env.SYNTH_TARGET_URL ?? 'https://polymorph.fyi'
const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY ?? ''
const COOKIE_STRING =
  process.env.SYNTH_TRAFFIC_COOKIES ?? process.env.POLYMORPH_COOKIES ?? ''
const HEADLESS = process.env.SYNTH_HEADLESS !== 'false'
const SESSION_COUNT = Math.max(
  1,
  parseInt(process.env.SYNTH_SESSION_COUNT ?? '3', 10)
)
const VW = parseInt(process.env.SYNTH_VIEWPORT_WIDTH ?? '1280', 10)
const VH = parseInt(process.env.SYNTH_VIEWPORT_HEIGHT ?? '720', 10)

// computer-use model — sonnet-class gives good UI reasoning at reasonable cost
const CU_MODEL = 'claude-sonnet-4-6'

// ─── Session pool ────────────────────────────────────────────────────────────
// 2-turn conversations designed to trigger tool use, citations, and varied
// evaluator paths (research mode → faithfulness/relevance; chat → response-quality)

interface Session {
  name: string
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
  turns: [string, string]
}

const SESSION_POOL: Session[] = [
  {
    name: 'ai-safety',
    searchMode: 'research',
    modelType: 'quality',
    turns: [
      'What are the most significant AI safety developments in the past 6 months?',
      'Which of these do leading researchers consider most critical to address first?'
    ]
  },
  {
    name: 'crispr-ethics',
    searchMode: 'chat',
    modelType: 'speed',
    turns: [
      'How does CRISPR gene editing work at the molecular level?',
      'What are the main ethical concerns with germline editing in humans?'
    ]
  },
  {
    name: 'ev-batteries',
    searchMode: 'research',
    modelType: 'speed',
    turns: [
      'What is the current state of solid-state battery technology for EVs?',
      'Which companies are closest to commercial production and at what cost per kWh?'
    ]
  },
  {
    name: 'climate-capture',
    searchMode: 'research',
    modelType: 'speed',
    turns: [
      'What are the most promising direct air capture technologies today?',
      'What does the cost curve look like and what are the key milestones to reach $100/ton?'
    ]
  },
  {
    name: 'transformer-explainer',
    searchMode: 'chat',
    modelType: 'speed',
    turns: [
      'Explain how self-attention in transformer models works',
      'How does multi-head attention improve over single-head and what are the computational trade-offs?'
    ]
  },
  {
    name: 'quantum-computing',
    searchMode: 'research',
    modelType: 'quality',
    turns: [
      'What hardware approaches are leading the race to fault-tolerant quantum computing?',
      'When is practical quantum advantage for chemistry simulations realistically expected?'
    ]
  },
  {
    name: 'geo-economics',
    searchMode: 'research',
    modelType: 'speed',
    turns: [
      'How have the economic trajectories of Germany and Japan diverged since 2020?',
      'Which structural factors best explain the difference in their productivity growth?'
    ]
  },
  {
    name: 'longevity-science',
    searchMode: 'chat',
    modelType: 'speed',
    turns: [
      'What does current research say about the biology of aging at the cellular level?',
      'Which interventions have the strongest human evidence for slowing biological age markers?'
    ]
  },
  {
    name: 'semiconductor-supply',
    searchMode: 'research',
    modelType: 'quality',
    turns: [
      'What is the current state of TSMC and Samsung capacity for advanced node chips?',
      'How is the US CHIPS Act reshaping the geography of semiconductor manufacturing?'
    ]
  },
  {
    name: 'space-economy',
    searchMode: 'research',
    modelType: 'speed',
    turns: [
      'What commercial activities are currently generating revenue in the space economy?',
      'Which segments are growing fastest and what are the key near-term catalysts?'
    ]
  }
]

// ─── Cookie helpers ──────────────────────────────────────────────────────────

interface PlaywrightCookie {
  name: string
  value: string
  domain: string
  path: string
}

function parseCookieString(raw: string, targetUrl: string): PlaywrightCookie[] {
  const domain = new URL(targetUrl).hostname
  return raw
    .split(';')
    .map(p => p.trim())
    .filter(p => p.includes('='))
    .map(p => {
      const idx = p.indexOf('=')
      return {
        name: p.slice(0, idx).trim(),
        value: p.slice(idx + 1).trim(),
        domain,
        path: '/'
      }
    })
}

// ─── Computer-use agent ──────────────────────────────────────────────────────

type CUAction =
  | { action: 'screenshot' }
  | { action: 'left_click'; coordinate: [number, number] }
  | { action: 'right_click'; coordinate: [number, number] }
  | { action: 'double_click'; coordinate: [number, number] }
  | { action: 'type'; text: string }
  | { action: 'key'; key: string }
  | { action: 'mouse_move'; coordinate: [number, number] }
  | {
      action: 'scroll'
      coordinate: [number, number]
      direction: 'up' | 'down'
      amount: number
    }

async function executeCUAction(page: Page, input: CUAction): Promise<Buffer> {
  switch (input.action) {
    case 'left_click':
      await page.mouse.click(input.coordinate[0], input.coordinate[1])
      await page.waitForTimeout(700)
      break
    case 'right_click':
      await page.mouse.click(input.coordinate[0], input.coordinate[1], {
        button: 'right'
      })
      await page.waitForTimeout(400)
      break
    case 'double_click':
      await page.mouse.dblclick(input.coordinate[0], input.coordinate[1])
      await page.waitForTimeout(400)
      break
    case 'type':
      await page.keyboard.type(input.text, { delay: 25 })
      await page.waitForTimeout(150)
      break
    case 'key':
      await page.keyboard.press(input.key)
      await page.waitForTimeout(500)
      break
    case 'mouse_move':
      await page.mouse.move(input.coordinate[0], input.coordinate[1])
      break
    case 'scroll': {
      const delta = (input.direction === 'down' ? 1 : -1) * input.amount * 120
      await page.mouse.wheel(0, delta)
      await page.waitForTimeout(300)
      break
    }
    case 'screenshot':
    default:
      break
  }
  return page.screenshot({ type: 'png' })
}

/**
 * Runs a goal-directed computer-use agent loop until the model signals
 * completion ("DONE") or an error, or maxSteps is reached.
 */
async function runComputerUseGoal(
  page: Page,
  goal: string,
  maxSteps = 30
): Promise<void> {
  const initialShot = await page.screenshot({ type: 'png' })

  const messages: { role: 'user' | 'assistant'; content: unknown[] }[] = [
    {
      role: 'user',
      content: [
        { type: 'text', text: goal },
        {
          type: 'image',
          source: {
            type: 'base64',
            media_type: 'image/png',
            data: initialShot.toString('base64')
          }
        }
      ]
    }
  ]

  const system = `You are an autonomous browser agent.
Complete the task described by the user accurately and efficiently.
After every action wait for the UI to settle before proceeding.
When the task is fully complete reply with exactly "DONE".
If you cannot complete a step reply with "ERROR: <reason>".`

  for (let step = 0; step < maxSteps; step++) {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'computer-use-2025-01-24'
      },
      body: JSON.stringify({
        model: CU_MODEL,
        max_tokens: 4096,
        system,
        tools: [
          {
            type: 'computer_20250124',
            name: 'computer',
            display_width_px: VW,
            display_height_px: VH
          }
        ],
        messages
      })
    })

    if (!res.ok) {
      const body = await res.text()
      throw new Error(`Anthropic API ${res.status}: ${body}`)
    }

    const data = (await res.json()) as {
      stop_reason: string
      content: Array<{
        type: string
        text?: string
        id?: string
        name?: string
        input?: unknown
      }>
    }

    messages.push({ role: 'assistant', content: data.content })

    // Check text blocks for terminal signals
    for (const block of data.content) {
      if (block.type === 'text' && block.text) {
        const t = block.text.trim()
        console.log(`  [step ${step + 1}] ${t.slice(0, 120)}`)
        if (t.includes('DONE')) return
        if (t.startsWith('ERROR:')) throw new Error(t)
      }
    }

    if (data.stop_reason === 'end_turn') break

    // Execute tool_use blocks
    const tools = data.content.filter(b => b.type === 'tool_use')
    if (tools.length === 0) break

    const results: unknown[] = []
    for (const tool of tools) {
      const shot = await executeCUAction(page, tool.input as CUAction)
      results.push({
        type: 'tool_result',
        tool_use_id: tool.id,
        content: [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: 'image/png',
              data: shot.toString('base64')
            }
          }
        ]
      })
    }

    messages.push({ role: 'user', content: results })
  }
}

// ─── Session runner ──────────────────────────────────────────────────────────

async function runSession(session: Session, idx: number): Promise<void> {
  const t0 = Date.now()
  console.log(
    `\n── Session ${idx + 1}/${SESSION_COUNT}: ${session.name} (${session.searchMode}/${session.modelType}) ──`
  )

  const browser = await chromium.launch({ headless: HEADLESS })
  const ctx = await browser.newContext({ viewport: { width: VW, height: VH } })

  // Auth + preference cookies
  const domain = new URL(TARGET_URL).hostname
  const prefCookies: PlaywrightCookie[] = [
    {
      name: 'modelType',
      value: session.modelType,
      domain,
      path: '/'
    },
    {
      name: 'searchMode',
      value: session.searchMode,
      domain,
      path: '/'
    }
  ]
  const authCookies = COOKIE_STRING
    ? parseCookieString(COOKIE_STRING, TARGET_URL)
    : []
  await ctx.addCookies([...authCookies, ...prefCookies])

  const page = await ctx.newPage()

  try {
    await page.goto(TARGET_URL, {
      waitUntil: 'domcontentloaded',
      timeout: 30_000
    })

    const goal = `
You are testing the Polymorph AI assistant at ${TARGET_URL}.

Complete these steps in order:
1. Navigate to a new chat. Look for a "New Chat" button or link in the sidebar, or go to the root URL if already there.
2. Find the chat input field (text area at the bottom of the page).
3. Type exactly this message:
   ${session.turns[0]}
4. Send the message (press Enter or click the send/submit button).
5. Wait for the AI response to finish streaming. The response is done when the text stops changing and the input field becomes enabled again.
6. Without navigating away, type exactly this follow-up message in the same input field:
   ${session.turns[1]}
7. Send it and again wait for the complete response.
8. When both AI responses are fully displayed and the input is active again, reply "DONE".

Notes:
- If you see a login or sign-up page instead of the chat UI, reply "ERROR: not authenticated — set SYNTH_TRAFFIC_COOKIES"
- Do not click any navigation links that would leave the current chat
- Wait for streaming to fully stop before typing follow-up
    `.trim()

    await runComputerUseGoal(page, goal)
    console.log(`  ✓ done in ${((Date.now() - t0) / 1000).toFixed(1)}s`)
  } finally {
    await ctx.close()
    await browser.close()
  }
}

function pickSessions(pool: Session[], n: number): Session[] {
  const shuffled = [...pool].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, n)
}

// ─── Main ────────────────────────────────────────────────────────────────────

async function main() {
  console.log('=== Synthetic Traffic Generator ===')
  console.log(`  target  : ${TARGET_URL}`)
  console.log(`  sessions: ${SESSION_COUNT}`)
  console.log(
    `  auth    : ${COOKIE_STRING ? 'cookies provided' : 'NO COOKIES — sessions will likely fail auth'}`
  )
  console.log(`  headless: ${HEADLESS}`)

  if (!ANTHROPIC_API_KEY) {
    console.error('ANTHROPIC_API_KEY is required')
    process.exit(1)
  }

  const sessions = pickSessions(SESSION_POOL, SESSION_COUNT)
  const results: { name: string; ok: boolean; error?: string }[] = []

  for (let i = 0; i < sessions.length; i++) {
    try {
      await runSession(sessions[i], i)
      results.push({ name: sessions[i].name, ok: true })
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`  ✗ ${sessions[i].name}: ${msg}`)
      results.push({ name: sessions[i].name, ok: false, error: msg })
    }
    if (i < sessions.length - 1) await new Promise(r => setTimeout(r, 2500))
  }

  console.log('\n=== Summary ===')
  for (const r of results) {
    console.log(
      `  ${r.ok ? '✓' : '✗'} ${r.name}${r.error ? ` — ${r.error.slice(0, 80)}` : ''}`
    )
  }

  const failed = results.filter(r => !r.ok).length
  if (failed > 0) {
    console.error(`\n${failed}/${SESSION_COUNT} sessions failed`)
    process.exit(1)
  }
  console.log('\nAll sessions completed.')
}

main()

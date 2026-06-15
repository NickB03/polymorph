#!/usr/bin/env tsx
/**
 * Synthetic traffic generator for polymorph.fyi.
 *
 * Simulates 3 realistic user sessions (research, explanation, planning) to give
 * the eval pipeline chat records to sample from. Run once per day via:
 *   /loop 24h /drive-traffic
 *
 * Auth: copy the Cookie header from any DevTools network request on polymorph.fyi
 * and paste it into .env.local as:
 *   POLYMORPH_COOKIES="sb-...=...; ..."
 *
 * Optional overrides:
 *   POLYMORPH_URL   – base URL (default: https://polymorph.fyi)
 *   DRIVE_TRAFFIC_DELAY_MS – ms between sessions (default: 8000)
 */

import { config as dotenvConfig } from 'dotenv'
import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'

dotenvConfig({ path: '.env.local' })

const BASE_URL = (process.env.POLYMORPH_URL ?? 'https://polymorph.fyi').replace(
  /\/$/,
  ''
)
const BETWEEN_SESSION_DELAY = Number(
  process.env.DRIVE_TRAFFIC_DELAY_MS ?? '8000'
)
const BETWEEN_TURN_DELAY = 4000

// ---------------------------------------------------------------------------
// Session definitions – diverse enough to exercise all 9 eval dimensions
// ---------------------------------------------------------------------------

interface Turn {
  message: string
}

interface Session {
  name: string
  searchMode: 'research' | 'chat'
  modelType: 'speed' | 'quality'
  turns: Turn[]
}

const SESSIONS: Session[] = [
  {
    name: 'Research – Science & Health',
    searchMode: 'research',
    modelType: 'quality',
    turns: [
      {
        message:
          'What are the most significant advances in GLP-1 weight loss drugs like Ozempic and Mounjaro since 2023? I want to understand both the science and the real-world outcomes.',
      },
      {
        message:
          'What are the main risks and side effects that doctors are monitoring in long-term users, and how does that compare to the cardiovascular benefits?',
      },
    ],
  },
  {
    name: 'Explanation – Technical Concept',
    searchMode: 'chat',
    modelType: 'quality',
    turns: [
      {
        message:
          'Explain how transformer attention mechanisms work. I have a software engineering background but have never studied ML. Use a concrete analogy and avoid hand-waving the math.',
      },
    ],
  },
  {
    name: 'Research – Technology Comparison',
    searchMode: 'research',
    modelType: 'speed',
    turns: [
      {
        message:
          'I want to build a production RAG system for searching internal company documents. What are the best open-source frameworks and vector databases to consider in 2025?',
      },
      {
        message:
          'Between LangChain, LlamaIndex, and rolling our own with the raw APIs, what would you recommend for a team of 3 engineers with strong Python skills and a 3-month timeline?',
      },
    ],
  },
]

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return `synthetic_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

function buildCookieHeader(session: Session, rawCookies: string): string {
  const base = rawCookies.trim()
  const extras: string[] = []

  if (!base.includes('searchMode='))
    extras.push(`searchMode=${session.searchMode}`)
  if (!base.includes('modelType='))
    extras.push(`modelType=${session.modelType}`)

  return [base, ...extras].filter(Boolean).join('; ')
}

interface SendResult {
  textLength: number
  toolCalls: string[]
  finishReason: string
}

async function sendTurn(
  chatId: string,
  turn: Turn,
  isNewChat: boolean,
  cookieHeader: string
): Promise<SendResult> {
  const messageId = generateId()
  const payload = {
    chatId,
    trigger: 'submit-message',
    isNewChat,
    messages: [
      {
        id: messageId,
        role: 'user',
        content: turn.message,
        parts: [{ type: 'text', text: turn.message }],
        createdAt: new Date(),
      },
    ],
  }

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Referer: `${BASE_URL}/`,
      Origin: BASE_URL,
    },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(120_000),
  })

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${body.slice(0, 300)}`)
  }

  if (!response.body) throw new Error('No response body')

  // Consume the full SSE stream – this is what commits the chat to the DB.
  const webStream = response.body as unknown as NodeReadableStream<unknown>
  const nodeReadable = Readable.fromWeb(webStream)

  const textDecoder = new TextDecoder()
  let buffer = ''
  let fullText = ''
  const toolCalls: string[] = []
  let finishReason = 'unknown'

  for await (const chunk of nodeReadable) {
    buffer += textDecoder.decode(chunk as Buffer, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6).trim()
      if (data === '[DONE]') continue

      try {
        const event = JSON.parse(data)
        if (event.type === 'text' || event.type === 'text-delta') {
          fullText += event.text ?? event.delta ?? ''
        } else if (event.type?.startsWith('tool-') && event.toolName) {
          if (!toolCalls.includes(event.toolName)) toolCalls.push(event.toolName)
        } else if (event.type === 'finish') {
          finishReason = event.finishReason ?? 'stop'
        }
      } catch {
        // ignore unparseable lines
      }
    }
  }

  return { textLength: fullText.length, toolCalls, finishReason }
}

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------

interface SessionResult {
  name: string
  status: 'ok' | 'error'
  chatId?: string
  turns?: number
  error?: string
}

async function runSession(session: Session, rawCookies: string): Promise<SessionResult> {
  const chatId = generateId()
  const cookieHeader = buildCookieHeader(session, rawCookies)

  console.log(`\n  ▸ ${session.name}`)
  console.log(`    chatId: ${chatId}  mode: ${session.searchMode}  model: ${session.modelType}`)

  let completedTurns = 0

  for (let i = 0; i < session.turns.length; i++) {
    const turn = session.turns[i]
    const preview = turn.message.slice(0, 90)
    console.log(`    Turn ${i + 1}: "${preview}${turn.message.length > 90 ? '…' : ''}"`)

    const result = await sendTurn(chatId, turn, i === 0, cookieHeader)
    console.log(
      `    ↳ ${result.textLength} chars  tools: [${result.toolCalls.join(', ') || 'none'}]  finish: ${result.finishReason}`
    )
    completedTurns++

    if (i < session.turns.length - 1) {
      await sleep(BETWEEN_TURN_DELAY)
    }
  }

  return { name: session.name, status: 'ok', chatId, turns: completedTurns }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function main() {
  const rawCookies = process.env.POLYMORPH_COOKIES ?? process.env.VANA_COOKIES ?? ''

  if (!rawCookies) {
    console.error('❌  No auth cookies configured.')
    console.error()
    console.error('Add to .env.local:')
    console.error('  POLYMORPH_COOKIES="<paste Cookie header from browser DevTools>"')
    console.error()
    console.error('To get the value:')
    console.error('  1. Sign in to polymorph.fyi')
    console.error('  2. Open DevTools → Network tab → click any /api/chat request')
    console.error('  3. Under Request Headers, copy the entire "Cookie" value')
    process.exit(1)
  }

  const timestamp = new Date().toISOString()
  console.log(`🚀 drive-traffic  ${timestamp}`)
  console.log(`   Target: ${BASE_URL}`)
  console.log(`   Sessions: ${SESSIONS.length}`)

  const results: SessionResult[] = []

  for (let i = 0; i < SESSIONS.length; i++) {
    try {
      const result = await runSession(SESSIONS[i], rawCookies)
      results.push(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`    ✗ Error: ${msg}`)
      results.push({ name: SESSIONS[i].name, status: 'error', error: msg })
    }

    if (i < SESSIONS.length - 1) {
      await sleep(BETWEEN_SESSION_DELAY)
    }
  }

  // Summary
  console.log('\n── Summary ──────────────────────────────')
  let failures = 0
  for (const r of results) {
    if (r.status === 'ok') {
      console.log(`✓  ${r.name}  (${r.turns} turn${r.turns === 1 ? '' : 's'}, chatId: ${r.chatId})`)
    } else {
      console.log(`✗  ${r.name}: ${r.error}`)
      failures++

      if (r.error?.includes('401') || r.error?.includes('403')) {
        console.log('   ⚠  Looks like an auth error — POLYMORPH_COOKIES may have expired.')
        console.log('      Re-export from browser DevTools and update .env.local.')
      }
    }
  }

  if (failures === 0) {
    console.log('\n✅  Done. Records are available for the eval pipeline to sample.')
  } else {
    console.error(`\n⚠   ${failures} session(s) failed.`)
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

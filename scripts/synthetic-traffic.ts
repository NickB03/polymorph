#!/usr/bin/env bun

/**
 * Synthetic traffic generator for polymorph.fyi
 *
 * Simulates 3 realistic user sessions to populate the messages table for
 * eval traffic sampling. Requires an authenticated session via POLYMORPH_COOKIES.
 *
 * Usage:
 *   POLYMORPH_COOKIES="..." bun run scripts/synthetic-traffic.ts
 *   POLYMORPH_URL="https://polymorph.fyi" POLYMORPH_COOKIES="..." bun run scripts/synthetic-traffic.ts
 */

import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'

import { config as dotenvConfig } from 'dotenv'
import { createId } from '@paralleldrive/cuid2'

dotenvConfig({ path: '.env.local' })

const BASE_URL =
  process.env.POLYMORPH_URL?.replace(/\/$/, '') || 'https://polymorph.fyi'
const API_URL = `${BASE_URL}/api/chat`

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content?: string
  parts: Array<{ type: string; text?: string; [key: string]: unknown }>
  createdAt: Date
}

interface ChatPayload {
  chatId: string
  trigger: 'submit-message'
  messages: UIMessage[]
  isNewChat?: boolean
}

interface Session {
  name: string
  userMode: 'search' | 'research'
  modelType: 'speed' | 'quality'
  turns: string[]
}

// 3 distinct personas that exercise different eval dimensions:
// - different search modes (chat vs research backend)
// - different model types (speed vs quality)
// - mix of single-turn and multi-turn for follow-up coverage
const SESSIONS: Session[] = [
  {
    name: 'deep-researcher',
    userMode: 'research',
    modelType: 'quality',
    turns: [
      'What are the most significant AI safety research developments from the past six months? Focus on alignment techniques and empirical safety work.',
      'How do the interpretability findings you mentioned relate to the challenge of specifying reward functions correctly?',
    ],
  },
  {
    name: 'quick-lookup',
    userMode: 'search',
    modelType: 'speed',
    turns: [
      "What's the practical difference between zero-shot and few-shot prompting, and when should I use each?",
    ],
  },
  {
    name: 'current-events',
    userMode: 'research',
    modelType: 'speed',
    turns: [
      'What are the latest developments in US semiconductor policy and export controls on advanced chips?',
      'How are major chipmakers responding to these export control changes, and what are the supply chain implications?',
    ],
  },
]

function buildUserMessage(text: string): UIMessage {
  const id = createId()
  return {
    id,
    role: 'user',
    content: text,
    parts: [{ type: 'text', text }],
    createdAt: new Date(),
  }
}

function buildAssistantMessage(text: string): UIMessage {
  const id = createId()
  return {
    id,
    role: 'assistant',
    parts: [{ type: 'text', text }],
    createdAt: new Date(),
  }
}

function buildCookieString(
  session: Session,
  authCookies: string | undefined
): string {
  // userMode maps to the searchMode cookie value ('search' | 'research')
  const modeCookies = `searchMode=${session.userMode}; modelType=${session.modelType}`
  if (!authCookies) return modeCookies

  // Merge: auth cookies first, then mode overrides (last value wins in most servers)
  const base = authCookies.replace(/;\s*searchMode=[^;]*/g, '').replace(/;\s*modelType=[^;]*/g, '')
  return `${base}; ${modeCookies}`
}

async function streamToText(body: ReadableStream<Uint8Array>): Promise<string> {
  const nodeReadable = Readable.fromWeb(body as unknown as NodeReadableStream<Uint8Array>)
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  for await (const chunk of nodeReadable) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'text') text += parsed.text ?? ''
        else if (parsed.type === 'text-delta') text += parsed.delta ?? ''
      } catch {
        // ignore parse errors for non-JSON SSE lines
      }
    }
  }

  return text.trim()
}

async function runTurn(
  chatId: string,
  conversationHistory: UIMessage[],
  userText: string,
  cookieString: string,
  isNewChat: boolean
): Promise<UIMessage> {
  const userMessage = buildUserMessage(userText)
  const messages = [...conversationHistory, userMessage]

  const payload: ChatPayload = {
    chatId,
    trigger: 'submit-message',
    messages,
    ...(isNewChat ? { isNewChat: true } : {}),
  }

  const response = await fetch(API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieString,
    },
    body: JSON.stringify(payload),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status} ${response.statusText}: ${body}`)
  }

  if (!response.body) throw new Error('empty response body')

  const assistantText = await streamToText(response.body)
  return buildAssistantMessage(assistantText || '[no text content]')
}

async function runSession(
  session: Session,
  authCookies: string | undefined
): Promise<void> {
  const chatId = createId()
  const cookieString = buildCookieString(session, authCookies)
  const history: UIMessage[] = []

  console.log(`\n[${session.name}] chatId=${chatId} mode=${session.userMode} model=${session.modelType}`)

  for (let i = 0; i < session.turns.length; i++) {
    const query = session.turns[i]
    console.log(`  turn ${i + 1}: ${query.slice(0, 80)}...`)

    const assistantMsg = await runTurn(
      chatId,
      history,
      query,
      cookieString,
      i === 0
    )

    const userMsg = buildUserMessage(query)
    history.push(userMsg, assistantMsg)

    const preview = (assistantMsg.parts[0] as { text?: string }).text?.slice(0, 100) ?? ''
    console.log(`  response: ${preview}...`)

    // Brief pause between turns to avoid hammering the server
    if (i < session.turns.length - 1) {
      await new Promise(r => setTimeout(r, 2000))
    }
  }

  console.log(`  [${session.name}] complete — ${history.length / 2} turn(s) persisted`)
}

async function main() {
  const authCookies = process.env.POLYMORPH_COOKIES ?? process.env.VANA_COOKIES

  if (!authCookies) {
    console.error(
      'POLYMORPH_COOKIES is not set. Authenticated sessions are required — ' +
        'guest chats are ephemeral and never sampled by the eval traffic monitor.\n' +
        'Copy your session cookies from browser DevTools (Network → any request → Cookie header) ' +
        'and set POLYMORPH_COOKIES in your environment or .env.local.'
    )
    process.exit(1)
  }

  console.log(`Generating synthetic traffic against ${BASE_URL}`)
  console.log(`Running ${SESSIONS.length} sessions...`)

  let succeeded = 0
  let failed = 0

  for (const session of SESSIONS) {
    try {
      await runSession(session, authCookies)
      succeeded++
    } catch (err) {
      failed++
      console.error(`  [${session.name}] FAILED:`, err instanceof Error ? err.message : err)
    }
  }

  console.log(`\nDone: ${succeeded}/${SESSIONS.length} sessions succeeded${failed > 0 ? `, ${failed} failed` : ''}.`)

  if (failed > 0) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

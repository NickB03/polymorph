#!/usr/bin/env tsx
/**
 * Simulates 3 daily user sessions on polymorph.fyi for eval traffic generation.
 * Sessions are picked up by services/evals/src/sampler.ts within 48 hours.
 *
 * Required env: POLYMORPH_TRAFFIC_EMAIL, POLYMORPH_TRAFFIC_PASSWORD,
 *               NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY
 * Optional env: POLYMORPH_BASE_URL (default: https://polymorph.fyi)
 *
 * Run: bun run traffic-sim
 */

import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { config as dotenvConfig } from 'dotenv'
import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'

dotenvConfig({ path: '.env.local' })

// --- Config ---

const BASE_URL = (
  process.env.POLYMORPH_BASE_URL ?? 'https://polymorph.fyi'
).replace(/\/$/, '')
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const EMAIL = process.env.POLYMORPH_TRAFFIC_EMAIL ?? ''
const PASSWORD = process.env.POLYMORPH_TRAFFIC_PASSWORD ?? ''

// --- Session definitions ---

type SearchMode = 'chat' | 'research'
type ModelType = 'speed' | 'quality'

interface SessionDef {
  name: string
  searchMode: SearchMode
  modelType: ModelType
  queryPool: string[]
  followUp: string
}

const SESSIONS: SessionDef[] = [
  {
    name: 'Research',
    searchMode: 'research',
    modelType: 'speed',
    queryPool: [
      'What are the most significant AI research breakthroughs in the past few months?',
      "What's the current state of nuclear fusion energy and which organizations are leading the field?",
      'How has the global EV market evolved and what are the key trends heading into 2025?',
      'What are the recent developments in quantum computing and what is the realistic timeline to practical use?',
      'What is the current status of large language model research — what problems are researchers most focused on?',
      'How has the geopolitics of semiconductor manufacturing changed in the past two years?'
    ],
    followUp: 'What are the biggest remaining challenges in this space?'
  },
  {
    name: 'Explanation',
    searchMode: 'chat',
    modelType: 'speed',
    queryPool: [
      'Explain how attention mechanisms work in transformer neural networks',
      'How does public key cryptography work? Explain from first principles',
      'What is retrieval-augmented generation and why does it matter for LLM applications?',
      'Explain the CAP theorem and its practical implications for distributed system design',
      'How do diffusion models generate images? Explain the process conceptually',
      'What is the difference between process memory and virtual memory in operating systems?'
    ],
    followUp: 'Can you give a concrete real-world example of this in practice?'
  },
  {
    name: 'Analysis',
    searchMode: 'research',
    modelType: 'speed',
    queryPool: [
      'What are the tradeoffs between SQL and NoSQL databases, and when would you choose each?',
      'Compare edge computing vs cloud computing — when does each approach make more sense for a product team?',
      'Analyze the tradeoffs between REST APIs and GraphQL for a modern web application',
      'What are the key differences between batch processing and stream processing, and when does each apply?',
      'Compare monolithic vs microservice architecture — when does the transition make sense?',
      'What are the tradeoffs between client-side, server-side, and static rendering for web apps?'
    ],
    followUp:
      'How would this decision change for a small startup building their first product?'
  }
]

// --- Helpers ---

function generateId(): string {
  return `sim_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

/** Day-of-year as a simple rotation seed so query selection varies per day. */
function dayOfYear(): number {
  const now = new Date()
  const start = new Date(now.getFullYear(), 0, 0)
  return Math.floor((now.getTime() - start.getTime()) / 86_400_000)
}

function pickQuery(pool: string[], sessionIndex: number): string {
  // Offset per session so all 3 sessions don't pick the same pool slot simultaneously.
  return pool[(dayOfYear() + sessionIndex * 2) % pool.length]
}

/**
 * Construct Supabase SSR auth cookies from a session returned by signInWithPassword.
 * @supabase/ssr stores the session as base64(JSON.stringify(session)), chunked at 3180 chars.
 */
function buildAuthCookies(supabaseUrl: string, session: object): string {
  const projectRef = new URL(supabaseUrl).hostname.split('.')[0]
  const cookieName = `sb-${projectRef}-auth-token`
  const serialized = Buffer.from(JSON.stringify(session)).toString('base64')
  const CHUNK_SIZE = 3180

  if (serialized.length <= CHUNK_SIZE) {
    return `${cookieName}=${serialized}`
  }

  // Chunked format: empty root cookie + indexed chunk cookies
  const parts: string[] = [`${cookieName}=`]
  for (let i = 0; i * CHUNK_SIZE < serialized.length; i++) {
    parts.push(
      `${cookieName}.${i}=${serialized.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE)}`
    )
  }
  return parts.join('; ')
}

/** Drain an SSE stream and return the accumulated assistant text. */
async function drainStream(response: Response): Promise<string> {
  if (!response.body) throw new Error('no response body')

  const nodeStream = Readable.fromWeb(
    response.body as unknown as NodeReadableStream<Uint8Array>
  )
  const decoder = new TextDecoder()
  let buffer = ''
  let text = ''

  for await (const chunk of nodeStream) {
    buffer += decoder.decode(chunk, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') continue
      try {
        const parsed = JSON.parse(data)
        if (parsed.type === 'text-delta') text += parsed.delta ?? ''
        else if (parsed.type === 'text') text += parsed.text ?? ''
      } catch {
        // ignore individual parse errors in the SSE stream
      }
    }
  }

  return text.trim()
}

interface UIMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  parts: Array<{ type: string; text: string }>
  createdAt: string
}

function makeMessage(role: 'user' | 'assistant', text: string): UIMessage {
  const sanitized = text.slice(0, 10_000)
  return {
    id: generateId(),
    role,
    content: sanitized,
    parts: [{ type: 'text', text: sanitized }],
    createdAt: new Date().toISOString()
  }
}

async function postToChat(
  chatId: string,
  messages: UIMessage[],
  authCookies: string,
  searchMode: SearchMode,
  modelType: ModelType,
  isNewChat: boolean
): Promise<string> {
  const cookieHeader = [
    authCookies,
    `searchMode=${searchMode}`,
    `modelType=${modelType}`
  ].join('; ')

  const response = await fetch(`${BASE_URL}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader
    },
    body: JSON.stringify({
      chatId,
      trigger: 'submit-message',
      messages,
      isNewChat
    })
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`HTTP ${response.status}: ${body.slice(0, 200)}`)
  }

  return drainStream(response)
}

// --- Session runner ---

async function runSession(
  index: number,
  def: SessionDef,
  authCookies: string
): Promise<void> {
  const chatId = generateId()
  const query = pickQuery(def.queryPool, index)

  console.log(
    `\n[${index + 1}/${SESSIONS.length}] ${def.name} (searchMode: ${def.searchMode})`
  )
  console.log(`  Q: ${query}`)

  const userMsg1 = makeMessage('user', query)
  const reply1 = await postToChat(
    chatId,
    [userMsg1],
    authCookies,
    def.searchMode,
    def.modelType,
    true
  )
  console.log(`  A: ${reply1.slice(0, 100).replace(/\n/g, ' ')}…`)

  // Follow-up: include conversation history so the model has context
  console.log(`  Follow-up: ${def.followUp}`)
  try {
    const assistantMsg1 = makeMessage('assistant', reply1)
    const userMsg2 = makeMessage('user', def.followUp)
    const reply2 = await postToChat(
      chatId,
      [userMsg1, assistantMsg1, userMsg2],
      authCookies,
      def.searchMode,
      def.modelType,
      false
    )
    console.log(`  A: ${reply2.slice(0, 80).replace(/\n/g, ' ')}…`)
  } catch (err) {
    // Non-fatal: the initial turn is still in the DB and samplable
    console.log(
      `  Follow-up skipped: ${err instanceof Error ? err.message : String(err)}`
    )
  }

  console.log(`  ✓ chatId: ${chatId}`)
}

// --- Main ---

async function main(): Promise<void> {
  console.log('=== Polymorph traffic simulation ===')
  console.log(`Target:     ${BASE_URL}`)
  console.log(`Day seed:   ${dayOfYear()}`)
  console.log(`Sessions:   ${SESSIONS.map(s => s.name).join(', ')}`)

  const missing = (
    [
      [SUPABASE_URL, 'NEXT_PUBLIC_SUPABASE_URL'],
      [SUPABASE_ANON_KEY, 'NEXT_PUBLIC_SUPABASE_ANON_KEY'],
      [EMAIL, 'POLYMORPH_TRAFFIC_EMAIL'],
      [PASSWORD, 'POLYMORPH_TRAFFIC_PASSWORD']
    ] as [string, string][]
  )
    .filter(([v]) => !v)
    .map(([, k]) => k)

  if (missing.length > 0) {
    console.error(`\nMissing required env vars: ${missing.join(', ')}`)
    console.error(
      'See .claude/skills/simulate-traffic/SKILL.md for setup instructions.'
    )
    process.exit(1)
  }

  console.log(`\nSigning in as ${EMAIL}…`)
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  const { data, error } = await supabase.auth.signInWithPassword({
    email: EMAIL,
    password: PASSWORD
  })

  if (error || !data.session) {
    console.error(`Auth failed: ${error?.message ?? 'no session returned'}`)
    process.exit(1)
  }

  console.log('Authenticated.')
  const authCookies = buildAuthCookies(SUPABASE_URL, data.session)

  let completed = 0
  for (let i = 0; i < SESSIONS.length; i++) {
    try {
      await runSession(i, SESSIONS[i], authCookies)
      completed++
    } catch (err) {
      console.error(
        `  Session ${i + 1} failed: ${err instanceof Error ? err.message : String(err)}`
      )
    }
    // Brief pause between sessions to simulate natural pacing
    if (i < SESSIONS.length - 1) await new Promise(r => setTimeout(r, 4_000))
  }

  await supabase.auth.signOut()

  console.log('\n=== All sessions complete ===')
  console.log(`Completed ${completed}/${SESSIONS.length} sessions`)
  console.log(
    `Generated up to ${completed * 2} messages across ${completed} chats`
  )
  console.log('Sampler window: 48 hours (next evals run will include these)')

  if (completed < SESSIONS.length) process.exit(1)
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

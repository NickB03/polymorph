#!/usr/bin/env bun
/**
 * Synthetic traffic generator for polymorph.fyi eval pipeline.
 *
 * Runs 3 chat sessions (research / search / build) against the live API,
 * using the session pools defined below. Query selection rotates day-by-day
 * so the eval sampler sees variety across runs.
 *
 * Usage (dev):
 *   bun scripts/simulate-traffic.ts
 *
 * Usage (production, requires auth cookies):
 *   POLYMORPH_COOKIES="..." bun scripts/simulate-traffic.ts --url https://polymorph.fyi/api/chat
 *
 * Railway cron:
 *   Set CMD to: bun scripts/simulate-traffic.ts --url https://polymorph.fyi/api/chat
 *   Set POLYMORPH_COOKIES env var in the Railway service settings.
 *   Schedule: 0 14 * * *  (daily at 14:00 UTC)
 */

import { config as dotenvConfig } from 'dotenv'

dotenvConfig({ path: '.env.local' })

// ---------------------------------------------------------------------------
// Query pools (one per agent mode)
// ---------------------------------------------------------------------------

const RESEARCH_QUERIES = [
  'Analyze the competitive landscape of open-source AI inference engines in 2025',
  'Compare federal EV charging infrastructure funding programs and their regional coverage gaps',
  'What are the most promising approaches to long-duration grid energy storage right now?',
  'Research recent breakthroughs in CRISPR-based therapeutics and their regulatory status',
  'How are major cloud providers differentiating their AI platform offerings in 2025?',
  'What does the current research say about the health effects of ultra-processed foods?',
  'Trace the history and current state of quantum computing hardware approaches',
  'Analyze the global semiconductor supply chain and key chokepoints in 2025',
]

const SEARCH_QUERIES = [
  'What are the top JavaScript bundlers in 2025 and how do they compare on build speed?',
  'List the best open-source alternatives to Linear for project management',
  'What is new in PostgreSQL 17 that matters for application developers?',
  'Compare the pricing tiers of the major LLM API providers as of mid-2025',
  'What are the key differences between Bun, Node.js, and Deno in 2025?',
  'What are the most popular vector databases and when should you choose each?',
  'What happened to SVB and what are the lasting effects on startup banking?',
  'Summarize the main arguments for and against municipal broadband networks',
]

const BUILD_QUERIES = [
  'Build an interactive unit converter for length, weight, and temperature',
  'Create a simple Pomodoro timer with start, pause, and reset controls',
  'Make a color palette generator — enter a hex code and show complementary colors',
  'Build a BMI calculator with a visual result indicator',
  'Create a simple flashcard app where I can add cards and flip through them',
  'Build a tip calculator that splits the bill among multiple people',
  'Make a random password generator with strength options',
  'Create a simple markdown editor with a live preview pane',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pickQuery(pool: string[]): string {
  // Rotate by day-of-year so each daily run picks a different query
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86400000
  )
  return pool[dayOfYear % pool.length]
}

function generateId(): string {
  return `chat_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`
}

function validateUrl(url: string): string {
  const parsed = new URL(url)
  const allowed = [
    'localhost',
    '127.0.0.1',
    'polymorph.fyi',
    'www.polymorph.fyi',
  ]
  if (
    allowed.includes(parsed.hostname) ||
    parsed.hostname.endsWith('.polymorph.fyi') ||
    parsed.hostname.endsWith('.local') ||
    parsed.hostname.startsWith('192.168.') ||
    parsed.hostname.startsWith('10.0.') ||
    parsed.hostname.startsWith('172.')
  ) {
    return url
  }
  console.error(`❌ Refusing to send traffic to non-allowlisted host: ${parsed.hostname}`)
  return process.exit(1)

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------

interface SessionConfig {
  label: string
  query: string
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
  apiUrl: string
  cookies: string
}

interface SessionResult {
  label: string
  query: string
  chatId: string
  success: boolean
  error?: string
  durationMs: number
  bytesReceived: number
}

async function runSession(cfg: SessionConfig): Promise<SessionResult> {
  const chatId = generateId()
  const messageId = generateId()
  const start = Date.now()
  let bytesReceived = 0

  const cookieString = [
    cfg.cookies,
    `modelType=${cfg.modelType}`,
    `searchMode=${cfg.searchMode}`,
  ]
    .filter(Boolean)
    .join('; ')

  const payload = {
    chatId,
    trigger: 'submit-message',
    isNewChat: true,
    messages: [
      {
        id: messageId,
        role: 'user',
        content: cfg.query,
        parts: [{ type: 'text', text: cfg.query }],
        createdAt: new Date(),
      },
    ],
  }

  try {
    const response = await fetch(cfg.apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieString,
        'User-Agent': 'polymorph-traffic-sim/1.0',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const body = await response.text()
      return {
        label: cfg.label,
        query: cfg.query,
        chatId,
        success: false,
        error: `HTTP ${response.status}: ${body.slice(0, 200)}`,
        durationMs: Date.now() - start,
        bytesReceived: 0,
      }
    }

    if (!response.body) {
      return {
        label: cfg.label,
        query: cfg.query,
        chatId,
        success: false,
        error: 'No response body',
        durationMs: Date.now() - start,
        bytesReceived: 0,
      }
    }

    const decoder = new TextDecoder()
    let buffer = ''
    let finished = false

    for await (const chunk of response.body as AsyncIterable<Uint8Array>) {
      bytesReceived += chunk.byteLength
      buffer += decoder.decode(chunk, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6)
          if (data === '[DONE]') {
            finished = true
          } else {
            try {
              const parsed = JSON.parse(data)
              if (parsed.type === 'finish' || parsed.type === 'error') {
                finished = true
              }
            } catch {
              // ignore parse errors in the stream
            }
          }
        }
      }
      // Safety: bail out after 4 MB to avoid runaway streams
      if (bytesReceived > 4 * 1024 * 1024) break
    }

    return {
      label: cfg.label,
      query: cfg.query,
      chatId,
      success: finished,
      durationMs: Date.now() - start,
      bytesReceived,
    }
  } catch (err) {
    return {
      label: cfg.label,
      query: cfg.query,
      chatId,
      success: false,
      error: String(err),
      durationMs: Date.now() - start,
      bytesReceived,
    }
  }
}

// ---------------------------------------------------------------------------
// CLI arg parsing
// ---------------------------------------------------------------------------

function parseArgs() {
  const args = process.argv.slice(2)
  let apiUrl = 'http://localhost:43100/api/chat'
  let modelType: 'speed' | 'quality' = 'speed'

  for (let i = 0; i < args.length; i++) {
    if ((args[i] === '--url' || args[i] === '-u') && args[i + 1]) {
      apiUrl = args[++i]
    } else if (args[i] === '--quality') {
      modelType = 'quality'
    } else if (args[i] === '--help' || args[i] === '-h') {
      console.log(`
Synthetic traffic generator for polymorph.fyi

Usage: bun scripts/simulate-traffic.ts [options]

Options:
  -u, --url <url>   API URL  (default: http://localhost:43100/api/chat)
                    Allowed hosts: localhost, polymorph.fyi, *.polymorph.fyi
  --quality         Use quality model tier (default: speed)
  -h, --help        Show this help

Environment:
  POLYMORPH_COOKIES  Cookie string copied from DevTools (required for production)

Railway cron setup:
  1. Create a new Railway service using this repo
  2. Set CMD: bun scripts/simulate-traffic.ts --url https://polymorph.fyi/api/chat
  3. Set POLYMORPH_COOKIES env var to a valid session cookie string
  4. Set cron schedule: 0 14 * * *  (daily 14:00 UTC)
`)
      process.exit(0)
    }
  }

  return { apiUrl: validateUrl(apiUrl), modelType }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const { apiUrl, modelType } = parseArgs()
  const cookies = process.env.POLYMORPH_COOKIES ?? process.env.VANA_COOKIES ?? ''

  const sessions: SessionConfig[] = [
    {
      label: 'Research',
      query: pickQuery(RESEARCH_QUERIES),
      searchMode: 'research',
      modelType,
      apiUrl,
      cookies,
    },
    {
      label: 'Search',
      query: pickQuery(SEARCH_QUERIES),
      searchMode: 'chat',
      modelType,
      apiUrl,
      cookies,
    },
    {
      label: 'Build',
      // Build mode is triggered by searchMode=chat with the build intent
      // surfaced via the query phrasing; the agent routes on "intent=build"
      // from the cookie but the CLI doesn't set it — so this session runs in
      // chat mode with a build-flavored prompt, which still generates useful
      // traffic for the capability evaluators.
      query: pickQuery(BUILD_QUERIES),
      searchMode: 'chat',
      modelType,
      apiUrl,
      cookies,
    },
  ]

  console.log(`\n🚀 polymorph.fyi traffic simulation — ${new Date().toISOString()}`)
  console.log(`   API: ${apiUrl}`)
  console.log(`   Model tier: ${modelType}`)
  console.log(`   Auth: ${cookies ? 'cookies present' : 'no cookies (guest mode)'}`)
  console.log()

  const results: SessionResult[] = []

  for (const [i, session] of sessions.entries()) {
    console.log(`[${i + 1}/3] ${session.label} — "${session.query.slice(0, 70)}…"`)
    const result = await runSession(session)
    results.push(result)

    if (result.success) {
      console.log(
        `       ✅  ${(result.durationMs / 1000).toFixed(1)}s  ${(result.bytesReceived / 1024).toFixed(0)} KB  chatId: ${result.chatId}`
      )
    } else {
      console.log(`       ❌  ${result.error}`)
    }
    console.log()
  }

  // Summary table
  console.log('─'.repeat(72))
  const succeeded = results.filter(r => r.success).length
  console.log(`\nCompleted ${succeeded}/${results.length} sessions`)

  if (succeeded < results.length) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

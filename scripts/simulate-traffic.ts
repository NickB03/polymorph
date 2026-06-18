#!/usr/bin/env bun
/**
 * Generates realistic user sessions on polymorph.fyi for eval traffic.
 *
 * Required env:
 *   POLYMORPH_COOKIES  — auth cookie string from browser DevTools
 *
 * Optional env:
 *   SIMULATE_URL       — override base URL (default: https://polymorph.fyi)
 *
 * Usage:
 *   bun run scripts/simulate-traffic.ts
 *   bun run scripts/simulate-traffic.ts --dry-run
 */

const TARGET_URL = process.env.SIMULATE_URL ?? 'https://polymorph.fyi'
const API_URL = `${TARGET_URL}/api/chat`

// ---------------------------------------------------------------------------
// Query banks — rotated daily via a date seed so the corpus stays diverse
// ---------------------------------------------------------------------------

const SEARCH_QUERIES = [
  'What are the most important scientific breakthroughs from the past month?',
  'Compare AWS, GCP, and Azure for a startup building a real-time API',
  'What are best practices for TypeScript in large codebases?',
  'Explain how large language models work at a high level',
  'What are the most promising AI startups right now and why?',
  'How does the US Federal Reserve set interest rates?',
  'What are the health benefits of a Mediterranean diet?',
  'What is the current global state of electric vehicle adoption?',
  'How does CRISPR gene editing work and what are its main applications?',
  'What programming languages should a developer learn in 2025 and why?',
]

const RESEARCH_QUERIES = [
  'Research the current state of nuclear fusion energy — latest breakthroughs and realistic timeline to commercial viability',
  'Analyze the geopolitical implications of AI development between the US and China, including recent policy developments',
  'Research the impact of remote work on urban real estate markets with data from major cities',
  'Deep dive into quantum computing: key players, recent milestones, and timeline to practical quantum advantage',
  'Research the latest developments in mRNA vaccine technology beyond COVID — which diseases are being targeted?',
  'Analyze the global semiconductor industry: supply chain vulnerabilities, key manufacturers, and effects of export controls',
  'Research the state of carbon capture technology — what approaches are most promising and at what scale?',
  'Investigate the current state of autonomous vehicle development — which companies are leading and what challenges remain?',
]

const BUILD_QUERIES = [
  'Build a Pomodoro timer app with start, pause, and reset buttons and a clean minimal UI',
  'Create a live word counter and reading time estimator with a text input area',
  'Build a color palette generator that creates harmonious color schemes from a base color',
  'Create a unit converter for length, weight, and temperature with a clean dropdown UI',
  'Build a random quote generator with a card layout and a "new quote" button',
  'Create a simple budget tracker that shows totals by category with a bar chart',
  'Build a markdown previewer with a split-pane editor and live rendered preview',
  'Create a flashcard app with flip animation and a score tracker',
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function seededPick<T>(arr: T[], seed: number): T {
  return arr[seed % arr.length]
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

type SearchMode = 'chat' | 'research'
type SessionType = 'search' | 'research' | 'build'

interface Session {
  type: SessionType
  searchMode: SearchMode
  query: string
  chatId: string
}

function planSessions(dateSeed: number): Session[] {
  return [
    {
      type: 'search',
      searchMode: 'chat',
      query: seededPick(SEARCH_QUERIES, dateSeed),
      chatId: generateId(),
    },
    {
      type: 'research',
      searchMode: 'research',
      query: seededPick(RESEARCH_QUERIES, dateSeed + 1),
      chatId: generateId(),
    },
    {
      type: 'build',
      searchMode: 'chat',
      query: seededPick(BUILD_QUERIES, dateSeed + 2),
      chatId: generateId(),
    },
  ]
}

// ---------------------------------------------------------------------------
// Session runner
// ---------------------------------------------------------------------------

async function runSession(session: Session, dryRun: boolean): Promise<boolean> {
  const cookies = process.env.POLYMORPH_COOKIES ?? ''
  const cookieParts = [`modelType=speed`, `searchMode=${session.searchMode}`]
  if (cookies) cookieParts.unshift(cookies)
  const cookieString = cookieParts.join('; ')

  const payload = {
    chatId: session.chatId,
    trigger: 'submit-message',
    isNewChat: true,
    messages: [
      {
        id: generateId(),
        role: 'user',
        content: session.query,
        parts: [{ type: 'text', text: session.query }],
        createdAt: new Date(),
      },
    ],
  }

  if (dryRun) {
    console.log(`  [dry-run] POST ${API_URL}`)
    console.log(`  [dry-run] chatId: ${session.chatId}`)
    return true
  }

  let response: Response
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieString,
      },
      body: JSON.stringify(payload),
    })
  } catch (err) {
    console.error(`  ✗ Network error: ${err}`)
    return false
  }

  if (!response.ok) {
    const body = await response.text().catch(() => '')
    console.error(`  ✗ HTTP ${response.status}: ${body.slice(0, 200)}`)
    return false
  }

  if (!response.body) {
    console.error('  ✗ No response body')
    return false
  }

  // Consume the SSE stream to completion so the full trace is written to Phoenix
  const decoder = new TextDecoder()
  let textEvents = 0
  let toolEvents = 0
  let done = false

  for await (const chunk of response.body) {
    const text = decoder.decode(chunk, { stream: true })
    for (const line of text.split('\n')) {
      if (!line.startsWith('data: ')) continue
      const data = line.slice(6)
      if (data === '[DONE]') {
        done = true
        continue
      }
      try {
        const evt = JSON.parse(data)
        if (evt.type === 'text-delta' || evt.type === 'text') textEvents++
        else if (evt.type?.startsWith('tool-')) toolEvents++
      } catch {
        // ignore parse errors on non-JSON lines
      }
    }
  }

  console.log(
    `  ✓ Stream complete — text events: ${textEvents}, tool events: ${toolEvents}, done signal: ${done}`
  )
  return true
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')

  // Days since epoch — gives a stable seed per calendar day
  const dateSeed = Math.floor(Date.now() / 86_400_000)
  const sessions = planSessions(dateSeed)

  console.log(`Polymorph traffic simulation`)
  console.log(`Date: ${new Date().toISOString()}`)
  console.log(`Target: ${API_URL}`)
  console.log(
    `Auth: ${process.env.POLYMORPH_COOKIES ? 'cookies set' : 'no cookies (guest/rate-limited)'}`
  )
  if (dryRun) console.log('Mode: DRY RUN')
  console.log('─'.repeat(60))

  const results: Array<{ session: Session; ok: boolean }> = []

  for (let i = 0; i < sessions.length; i++) {
    const session = sessions[i]
    console.log(`\nSession ${i + 1}/3  [${session.type}]`)
    console.log(`  Query:  "${session.query}"`)
    console.log(`  Mode:   ${session.searchMode}`)
    console.log(`  ChatID: ${session.chatId}`)

    const ok = await runSession(session, dryRun)
    results.push({ session, ok })

    if (i < sessions.length - 1 && !dryRun) {
      // Human-paced pause: 8–15s between sessions
      const delay = 8000 + Math.floor(Math.random() * 7000)
      console.log(`  Pausing ${Math.round(delay / 1000)}s before next session…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }

  console.log('\n' + '─'.repeat(60))
  console.log('Summary:')
  for (const [i, { session, ok }] of results.entries()) {
    const status = ok ? '✓' : '✗'
    const preview =
      session.query.length > 55
        ? session.query.slice(0, 55) + '…'
        : session.query
    console.log(`  ${status} ${i + 1}. [${session.type}] "${preview}"`)
  }

  const failed = results.filter(r => !r.ok).length
  if (failed > 0) {
    console.error(`\n${failed} session(s) failed`)
    process.exit(1)
  }

  console.log('\nAll sessions complete.')
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

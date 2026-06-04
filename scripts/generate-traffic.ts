#!/usr/bin/env tsx

/**
 * Synthetic traffic generator for the Polymorph production site.
 *
 * Runs 3 predefined chat sessions covering research, build, and chat modes
 * so the eval pipeline has varied, meaningful traces to score.
 *
 * Usage:
 *   bun scripts/generate-traffic.ts
 *
 * Auth:
 *   Set POLYMORPH_COOKIES in .env.local (or the environment) to your
 *   production session cookies. Get them from DevTools → Network → any
 *   chat request → Cookie header.
 *
 * URL override:
 *   Set POLYMORPH_URL to override the default production endpoint.
 */

import { config as dotenvConfig } from 'dotenv'
import { Readable } from 'stream'
import type { ReadableStream as NodeReadableStream } from 'stream/web'

dotenvConfig({ path: '.env.local' })

const DEFAULT_URL = 'https://polymorph.fyi/api/chat'

interface Session {
  name: string
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
  prompt: string
}

const SESSIONS: Session[] = [
  {
    name: 'Research',
    searchMode: 'research',
    modelType: 'quality',
    prompt:
      'What are the most significant AI safety research developments from the past year, and what open problems remain? Cite your sources.'
  },
  {
    name: 'Build',
    searchMode: 'research',
    modelType: 'quality',
    prompt:
      'Create an interactive dashboard showing global renewable energy adoption trends over the last decade. Include a line chart, a summary table by region, and a brief analysis.'
  },
  {
    name: 'Chat',
    searchMode: 'chat',
    modelType: 'speed',
    prompt:
      'Explain the key differences between RAG and fine-tuning for LLM applications, and when you would choose one over the other.'
  }
]

const PAUSE_BETWEEN_SESSIONS_MS = 30_000

function generateId(): string {
  return `traffic_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function buildCookieString(
  searchMode: string,
  modelType: string,
  baseCookies?: string
): string {
  const modeValue = searchMode === 'chat' ? 'chat' : searchMode
  if (baseCookies) {
    let s = baseCookies
    if (!s.includes('modelType=')) s += `; modelType=${modelType}`
    if (!s.includes('searchMode=')) s += `; searchMode=${modeValue}`
    return s
  }
  return `modelType=${modelType}; searchMode=${modeValue}`
}

interface SessionResult {
  name: string
  success: boolean
  responsePreview: string
  durationMs: number
  error?: string
}

async function runSession(
  session: Session,
  apiUrl: string,
  baseCookies: string | undefined
): Promise<SessionResult> {
  const start = Date.now()
  const chatId = generateId()
  const messageId = generateId()

  const payload = {
    chatId,
    trigger: 'submit-message',
    isNewChat: true,
    messages: [
      {
        id: messageId,
        role: 'user',
        content: session.prompt,
        parts: [{ type: 'text', text: session.prompt }],
        createdAt: new Date()
      }
    ]
  }

  const cookieString = buildCookieString(
    session.searchMode,
    session.modelType,
    baseCookies
  )

  try {
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: cookieString,
        'User-Agent': 'polymorph-traffic-generator/1.0'
      },
      body: JSON.stringify(payload)
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        name: session.name,
        success: false,
        responsePreview: '',
        durationMs: Date.now() - start,
        error: `HTTP ${response.status}: ${errorText.slice(0, 200)}`
      }
    }

    if (!response.body) {
      return {
        name: session.name,
        success: false,
        responsePreview: '',
        durationMs: Date.now() - start,
        error: 'No response body'
      }
    }

    const webStream = response.body as unknown as NodeReadableStream<Uint8Array>
    const nodeReadable = Readable.fromWeb(webStream)
    const decoder = new TextDecoder()

    let buffer = ''
    let textAccumulated = ''
    let hasData = false

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
          hasData = true
          if (parsed.type === 'text' && parsed.text) {
            textAccumulated += parsed.text
          } else if (parsed.type === 'text-delta' && parsed.delta) {
            textAccumulated += parsed.delta
          }
        } catch {
          // ignore malformed SSE frames
        }
      }
    }

    if (!hasData) {
      return {
        name: session.name,
        success: false,
        responsePreview: '',
        durationMs: Date.now() - start,
        error: 'Stream completed with no data'
      }
    }

    return {
      name: session.name,
      success: true,
      responsePreview: textAccumulated.slice(0, 120).replace(/\n/g, ' '),
      durationMs: Date.now() - start
    }
  } catch (err) {
    return {
      name: session.name,
      success: false,
      responsePreview: '',
      durationMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err)
    }
  }
}

async function main() {
  const apiUrl = process.env.POLYMORPH_URL ?? DEFAULT_URL
  const baseCookies =
    process.env.POLYMORPH_COOKIES ?? process.env.VANA_COOKIES ?? undefined

  console.log(`🚀 Polymorph traffic generator`)
  console.log(`   Target:  ${apiUrl}`)
  console.log(
    `   Auth:    ${baseCookies ? 'cookies present' : 'no cookies (guest mode)'}`
  )
  console.log(`   Sessions: ${SESSIONS.length}`)
  console.log()

  const results: SessionResult[] = []

  for (let i = 0; i < SESSIONS.length; i++) {
    const session = SESSIONS[i]
    console.log(
      `[${i + 1}/${SESSIONS.length}] ${session.name} — ${session.searchMode}/${session.modelType}`
    )
    console.log(`   Prompt: "${session.prompt.slice(0, 80)}..."`)

    const result = await runSession(session, apiUrl, baseCookies)
    results.push(result)

    if (result.success) {
      console.log(
        `   ✅ ${result.durationMs}ms — "${result.responsePreview}..."`
      )
    } else {
      console.error(`   ❌ ${result.durationMs}ms — ${result.error}`)
    }

    if (i < SESSIONS.length - 1) {
      console.log(
        `   ⏳ Pausing ${PAUSE_BETWEEN_SESSIONS_MS / 1000}s before next session...`
      )
      await sleep(PAUSE_BETWEEN_SESSIONS_MS)
    }

    console.log()
  }

  const passed = results.filter(r => r.success).length
  const failed = results.length - passed

  console.log('─'.repeat(50))
  console.log(`✨ Done: ${passed} succeeded, ${failed} failed`)

  if (failed > 0) {
    process.exit(1)
  }
}

main().catch(err => {
  console.error('Fatal:', err)
  process.exit(1)
})

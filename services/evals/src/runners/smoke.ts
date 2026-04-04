import { createBrowserClient } from '@supabase/ssr'

import { config } from '../config'
import { getSmoketestCases } from '../corpus'
import { extractPromptFromConversation } from '../eval-output'

type CookieValue = {
  name: string
  value: string
}

type CookieToSet = {
  name: string
  value: string
  options?: Record<string, unknown>
}

type CookieStore = Map<string, string>

function createCookieStore(): CookieStore {
  return new Map()
}

function createCookieClient(cookieStore: CookieStore) {
  return createBrowserClient(config.supabaseUrl!, config.supabaseAnonKey!, {
    cookies: {
      getAll() {
        return [...cookieStore.entries()].map(([name, value]) => ({
          name,
          value
        }))
      },
      setAll(cookies: CookieToSet[]) {
        for (const cookie of cookies) {
          if (!cookie.value) {
            cookieStore.delete(cookie.name)
            continue
          }

          cookieStore.set(cookie.name, cookie.value)
        }
      }
    }
  })
}

function buildCookieHeader(cookies: CookieValue[]): string {
  return cookies.map(({ name, value }) => `${name}=${value}`).join('; ')
}

async function authenticateSmokeUser(): Promise<CookieStore> {
  const cookieStore = createCookieStore()
  const supabase = createCookieClient(cookieStore)
  const { error } = await supabase.auth.signInWithPassword({
    email: config.seedUserEmail!,
    password: config.seedUserPassword!
  })

  if (error) {
    throw new Error(`Smoke auth failed: ${error.message}`)
  }

  return cookieStore
}

async function consumeSse(response: Response): Promise<string> {
  const reader = response.body?.getReader()
  if (!reader) return ''

  const decoder = new TextDecoder()
  let text = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const messages = buffer.split('\n\n')
    buffer = messages.pop() ?? ''

    for (const message of messages) {
      const line = message.trim()
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6)
      if (payload === '[DONE]') continue

      try {
        const chunk = JSON.parse(payload)
        if (chunk.type === 'text-delta' && chunk.delta) {
          text += chunk.delta
        }
      } catch {
        // skip malformed chunks
      }
    }
  }

  return text
}

export async function runSmokeSuite() {
  if (!config.smokeEnabled) {
    console.log('[evals] Smoke suite disabled, skipping')
    return
  }

  const cases = getSmoketestCases(config.smokeCaseCount)
  console.log(`[evals] Running smoke suite with ${cases.length} cases`)

  let authenticatedCookies: CookieStore
  try {
    authenticatedCookies = await authenticateSmokeUser()
  } catch (error) {
    console.warn(
      '[evals] Smoke auth failed, continuing without failing the run:',
      error instanceof Error ? error.message : error
    )
    return
  }

  let succeeded = 0

  for (const caseSpec of cases) {
    const prompt = extractPromptFromConversation(caseSpec.conversation)
    const cookies: CookieValue[] = [
      ...[...authenticatedCookies.entries()].map(([name, value]) => ({
        name,
        value
      })),
      { name: 'searchMode', value: caseSpec.searchMode },
      { name: 'modelType', value: caseSpec.modelType }
    ]

    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), config.smokeTimeoutMs)

    try {
      const response = await fetch(`${config.appUrl}/api/chat`, {
        method: 'POST',
        headers: {
          accept: 'text/event-stream',
          'content-type': 'application/json',
          cookie: buildCookieHeader(cookies)
        },
        body: JSON.stringify({
          message: {
            role: 'user',
            parts: [{ type: 'text', text: prompt }]
          },
          chatId: crypto.randomUUID(),
          trigger: 'submit-message',
          isNewChat: true
        }),
        signal: controller.signal
      })

      if (!response.ok) {
        const body = await response.text()
        throw new Error(
          `Smoke chat failed with ${response.status} ${response.statusText}: ${body}`
        )
      }

      const responseText = await consumeSse(response)
      if (!responseText.trim()) {
        throw new Error(
          `Smoke case ${caseSpec.id} returned 200 but streamed no text content`
        )
      }
      succeeded += 1
      console.log(`[evals] Smoke case succeeded: ${caseSpec.id}`)
    } catch (error) {
      console.warn(
        `[evals] Smoke case failed: ${caseSpec.id}`,
        error instanceof Error ? error.message : error
      )
    } finally {
      clearTimeout(timeout)
    }
  }

  console.log(
    `[evals] Smoke completed: ${succeeded}/${cases.length} chats succeeded`
  )
}

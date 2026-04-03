import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { EvalCase } from './types'

const mockFetch = vi.fn()

globalThis.fetch = mockFetch as unknown as typeof fetch

describe('runEvalCase', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('posts the case payload to the configured eval endpoint', async () => {
    mockFetch.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          answerText: 'answer',
          citations: [],
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: false,
          modelId: 'gateway:test',
          durationMs: 123
        }),
        { status: 200 }
      )
    )

    const caseSpec: EvalCase = {
      id: 'cap-1',
      suite: 'capability',
      conversation: [
        { role: 'user', parts: [{ type: 'text', text: 'hello' }] }
      ],
      searchMode: 'chat',
      modelType: 'speed',
      tags: ['evergreen'],
      requiresTextAnswer: true,
      requiresCitations: false,
      allowsInteractiveOnly: true
    }

    const { runEvalCase } = await import('./eval-runner-client')
    const result = await runEvalCase(caseSpec, {
      evalRunnerUrl: 'https://app.example.com',
      evalRunnerSecret: 'secret'
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://app.example.com/api/evals/run')
    expect(init.headers).toMatchObject({
      'content-type': 'application/json',
      'x-eval-runner-secret': 'secret'
    })
    expect(JSON.parse(init.body as string)).toMatchObject({
      caseId: 'cap-1',
      suite: 'capability',
      searchMode: 'chat',
      modelType: 'speed'
    })
    expect(result.answerText).toBe('answer')
  })
})

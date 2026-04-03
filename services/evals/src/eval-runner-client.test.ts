import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EvalRunnerHttpError, runEvalCase } from './eval-runner-client'
import type { EvalCase } from './types'

const mockFetch = vi.fn()

globalThis.fetch = mockFetch as unknown as typeof fetch

const baseCaseSpec: EvalCase = {
  id: 'cap-1',
  suite: 'capability',
  conversation: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
  searchMode: 'chat',
  modelType: 'speed',
  tags: ['evergreen'],
  requiresTextAnswer: true,
  requiresCitations: false,
  allowsInteractiveOnly: true
}

const successBody = JSON.stringify({
  answerText: 'answer',
  citations: [],
  searchResults: [],
  toolNames: [],
  usedInteractiveOnlyOutput: false,
  modelId: 'gateway:test',
  durationMs: 123
})

describe('runEvalCase', () => {
  beforeEach(() => {
    mockFetch.mockReset()
  })

  it('posts the case payload to the configured eval endpoint', async () => {
    mockFetch.mockResolvedValueOnce(new Response(successBody, { status: 200 }))

    const result = await runEvalCase(baseCaseSpec, {
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

  it('includes response body in error for non-200 responses', async () => {
    mockFetch.mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'FORBIDDEN',
          error: 'Invalid eval runner secret'
        }),
        { status: 403, statusText: 'Forbidden' }
      )
    )

    await expect(
      runEvalCase(baseCaseSpec, {
        evalRunnerUrl: 'https://app.example.com',
        evalRunnerSecret: 'wrong'
      })
    ).rejects.toThrow('Invalid eval runner secret')
  })

  it('throws EvalRunnerHttpError with correct status', async () => {
    mockFetch.mockResolvedValue(
      new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
    )

    try {
      await runEvalCase(baseCaseSpec, {
        evalRunnerUrl: 'https://app.example.com',
        evalRunnerSecret: 'wrong'
      })
      expect.fail('should have thrown')
    } catch (err) {
      expect(err).toBeInstanceOf(EvalRunnerHttpError)
      expect((err as EvalRunnerHttpError).status).toBe(403)
      expect((err as EvalRunnerHttpError).retryable).toBe(false)
    }
  })

  it('does not retry 403 errors', async () => {
    mockFetch.mockResolvedValue(
      new Response('Forbidden', { status: 403, statusText: 'Forbidden' })
    )

    await expect(
      runEvalCase(baseCaseSpec, {
        evalRunnerUrl: 'https://app.example.com',
        evalRunnerSecret: 'wrong'
      })
    ).rejects.toThrow()

    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('retries 502 errors and succeeds', async () => {
    vi.useFakeTimers()

    mockFetch
      .mockResolvedValueOnce(
        new Response('Bad Gateway', { status: 502, statusText: 'Bad Gateway' })
      )
      .mockResolvedValueOnce(new Response(successBody, { status: 200 }))

    const promise = runEvalCase(baseCaseSpec, {
      evalRunnerUrl: 'https://app.example.com',
      evalRunnerSecret: 'secret'
    })

    await vi.advanceTimersByTimeAsync(5_000)

    const result = await promise

    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(result.answerText).toBe('answer')

    vi.useRealTimers()
  })
})

describe('EvalRunnerHttpError', () => {
  it('marks 5xx as retryable', () => {
    expect(new EvalRunnerHttpError(500, 'Internal', 'err').retryable).toBe(true)
    expect(new EvalRunnerHttpError(502, 'Bad Gateway', 'err').retryable).toBe(
      true
    )
    expect(new EvalRunnerHttpError(503, 'Unavailable', 'err').retryable).toBe(
      true
    )
  })

  it('marks 429 as retryable', () => {
    expect(new EvalRunnerHttpError(429, 'Too Many', 'err').retryable).toBe(true)
  })

  it('marks 4xx (except 429) as non-retryable', () => {
    expect(new EvalRunnerHttpError(400, 'Bad Request', 'err').retryable).toBe(
      false
    )
    expect(new EvalRunnerHttpError(401, 'Unauthorized', 'err').retryable).toBe(
      false
    )
    expect(new EvalRunnerHttpError(403, 'Forbidden', 'err').retryable).toBe(
      false
    )
  })
})

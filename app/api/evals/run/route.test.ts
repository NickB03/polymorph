import { beforeEach, describe, expect, it, vi } from 'vitest'

import { POST } from '@/app/api/evals/run/route'

const mockRunEvalChat = vi.fn()
const mockSelectModelForModeAndType = vi.fn()

vi.mock('@/lib/streaming/eval-chat-runner', () => ({
  runEvalChat: (...args: unknown[]) => mockRunEvalChat(...args)
}))

vi.mock('@/lib/utils/model-selection', () => ({
  selectModelForModeAndType: (...args: unknown[]) =>
    mockSelectModelForModeAndType(...args)
}))

beforeEach(() => {
  vi.clearAllMocks()
  process.env.EVAL_RUNNER_SECRET = 'test-secret'
  mockSelectModelForModeAndType.mockReturnValue({
    id: 'gemini-3-flash',
    name: 'Gemini 3 Flash',
    provider: 'Google',
    providerId: 'gateway'
  })
  mockRunEvalChat.mockResolvedValue({
    answerText: 'Final answer',
    citations: [{ title: 'Alpha', url: 'https://alpha.test' }],
    searchResults: [],
    toolNames: ['search'],
    usedInteractiveOnlyOutput: false,
    modelId: 'gateway:gemini-3-flash',
    durationMs: 42
  })
})

describe('POST /api/evals/run', () => {
  it('rejects requests without the shared secret', async () => {
    const response = await POST(
      new Request('http://localhost/api/evals/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
    )

    expect(response.status).toBe(401)
    expect(mockRunEvalChat).not.toHaveBeenCalled()
  })

  it('rejects requests with the wrong shared secret', async () => {
    const response = await POST(
      new Request('http://localhost/api/evals/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eval-runner-secret': 'wrong-secret'
        },
        body: JSON.stringify({})
      })
    )

    expect(response.status).toBe(403)
    expect(mockRunEvalChat).not.toHaveBeenCalled()
  })

  it('runs the shared eval helper with explicit search mode and model type', async () => {
    const response = await POST(
      new Request('http://localhost/api/evals/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eval-runner-secret': 'test-secret'
        },
        body: JSON.stringify({
          caseId: 'case-1',
          suite: 'capability',
          conversation: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'What is example search?' }]
            }
          ],
          searchMode: 'research',
          modelType: 'quality'
        })
      })
    )

    expect(response.status).toBe(200)
    expect(mockSelectModelForModeAndType).toHaveBeenCalledWith({
      searchMode: 'research',
      modelType: 'quality'
    })
    expect(mockRunEvalChat).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'case-1',
        suite: 'capability',
        searchMode: 'research',
        modelType: 'quality'
      })
    )

    await expect(response.json()).resolves.toEqual({
      answerText: 'Final answer',
      citations: [{ title: 'Alpha', url: 'https://alpha.test' }],
      searchResults: [],
      toolNames: ['search'],
      usedInteractiveOnlyOutput: false,
      modelId: 'gateway:gemini-3-flash',
      durationMs: 42
    })
  })

  it('accepts traffic-monitor and forwards it to the no-persistence eval helper', async () => {
    const response = await POST(
      new Request('http://localhost/api/evals/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-eval-runner-secret': 'test-secret'
        },
        body: JSON.stringify({
          caseId: 'traffic-1',
          suite: 'traffic-monitor',
          conversation: [
            {
              role: 'user',
              parts: [{ type: 'text', text: 'Summarize this sampled chat.' }]
            }
          ],
          searchMode: 'chat',
          modelType: 'speed'
        })
      })
    )

    expect(response.status).toBe(200)
    expect(mockSelectModelForModeAndType).toHaveBeenCalledWith({
      searchMode: 'chat',
      modelType: 'speed'
    })
    expect(mockRunEvalChat).toHaveBeenCalledWith(
      expect.objectContaining({
        caseId: 'traffic-1',
        suite: 'traffic-monitor',
        searchMode: 'chat',
        modelType: 'speed'
      })
    )
  })
})

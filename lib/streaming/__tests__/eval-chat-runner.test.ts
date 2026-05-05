import { beforeEach, describe, expect, it, vi } from 'vitest'

import {
  normalizeEvalRunResult,
  runEvalChat
} from '@/lib/streaming/eval-chat-runner'

const mockResearcher = vi.fn()
const mockReadUIMessageStream = vi.fn()
const mockConvertToModelMessages = vi.fn()
const mockPruneMessages = vi.fn()
const mockMaybeTruncateMessages = vi.fn()
const mockInlineFileUrls = vi.fn()
const mockIsTracingEnabled = vi.fn(() => false)
const mockIsEvalReplayTracingEnabled = vi.fn(() => false)
const mockWithOtelRootSpan = vi.hoisted(() =>
  vi.fn(async (...args: unknown[]) => {
    const callback = args[1] as (context: unknown) => unknown
    return callback({ otelTraceId: 'otel-trace-1' })
  })
)

vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>()

  return {
    ...actual,
    convertToModelMessages: (...args: unknown[]) =>
      mockConvertToModelMessages(...args),
    pruneMessages: (...args: unknown[]) => mockPruneMessages(...args),
    readUIMessageStream: (...args: unknown[]) =>
      mockReadUIMessageStream(...args),
    smoothStream: vi.fn(() => undefined)
  }
})

vi.mock('@/lib/agents/chat/registry', () => ({
  createChatAgent: (...args: unknown[]) => mockResearcher(...args)
}))

vi.mock('@/lib/utils/context-window', () => ({
  maybeTruncateMessages: (...args: unknown[]) =>
    mockMaybeTruncateMessages(...args)
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn(),
  isEvalReplayTracingEnabled: () => mockIsEvalReplayTracingEnabled(),
  isTracingEnabled: () => mockIsTracingEnabled(),
  withOtelRootSpan: mockWithOtelRootSpan
}))

vi.mock('@/lib/streaming/helpers/strip-reasoning-parts', () => ({
  stripReasoningParts: vi.fn((messages: unknown[]) => messages)
}))

vi.mock('@/lib/streaming/helpers/inline-file-urls', () => ({
  inlineFileUrls: (...args: unknown[]) => mockInlineFileUrls(...args)
}))

beforeEach(() => {
  vi.clearAllMocks()
  mockConvertToModelMessages.mockResolvedValue([])
  mockPruneMessages.mockImplementation(
    ({ messages }: { messages: unknown[] }) => messages
  )
  mockMaybeTruncateMessages.mockImplementation(
    (messages: unknown[]) => messages
  )
  mockInlineFileUrls.mockImplementation(async (messages: unknown[]) => messages)
  mockIsTracingEnabled.mockReturnValue(false)
  mockIsEvalReplayTracingEnabled.mockReturnValue(false)
  mockWithOtelRootSpan.mockClear()
})

describe('normalizeEvalRunResult', () => {
  it('extracts answer text, citations, search results, and tool names', () => {
    const result = normalizeEvalRunResult({
      finalMessage: {
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Final answer' },
          {
            type: 'tool-search',
            toolCallId: 'search-1',
            state: 'output-available',
            output: {
              query: 'example search',
              results: [
                {
                  title: 'Alpha',
                  url: 'https://alpha.test',
                  content: 'Alpha content'
                }
              ],
              citationMap: {
                1: {
                  title: 'Alpha',
                  url: 'https://alpha.test',
                  content: 'Alpha content'
                }
              }
            }
          },
          {
            type: 'tool-displayCitations',
            toolCallId: 'display-1',
            state: 'output-available',
            output: {
              citations: [
                {
                  id: 'cite-1',
                  href: 'https://alpha.test',
                  title: 'Alpha'
                }
              ]
            }
          }
        ]
      } as any,
      modelId: 'gateway:gemini-3-flash',
      durationMs: 1234
    })

    expect(result).toEqual({
      answerText: 'Final answer',
      citations: [{ title: 'Alpha', url: 'https://alpha.test' }],
      searchResults: [
        {
          query: 'example search',
          results: [
            {
              title: 'Alpha',
              url: 'https://alpha.test',
              snippet: 'Alpha content'
            }
          ]
        }
      ],
      toolNames: ['search', 'displayCitations'],
      usedInteractiveOnlyOutput: false,
      modelId: 'gateway:gemini-3-flash',
      durationMs: 1234
    })
  })

  it('flags interactive-only output when no text answer is produced', () => {
    const result = normalizeEvalRunResult({
      finalMessage: {
        role: 'assistant',
        parts: [
          {
            type: 'tool-displayTable',
            toolCallId: 'table-1',
            state: 'output-available',
            output: { rows: [] }
          }
        ]
      } as any,
      modelId: 'gateway:gemini-3-flash',
      durationMs: 500
    })

    expect(result.answerText).toBe('')
    expect(result.usedInteractiveOnlyOutput).toBe(true)
  })
})

describe('runEvalChat', () => {
  it('runs the researcher pipeline and returns the normalized result', async () => {
    const finalMessage = {
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Final answer' },
        {
          type: 'tool-search',
          toolCallId: 'search-1',
          state: 'output-available',
          output: {
            query: 'example search',
            results: [
              {
                title: 'Alpha',
                url: 'https://alpha.test',
                content: 'Alpha content'
              }
            ],
            citationMap: {
              1: {
                title: 'Alpha',
                url: 'https://alpha.test',
                content: 'Alpha content'
              }
            }
          }
        }
      ]
    }

    mockReadUIMessageStream.mockImplementation(async function* () {
      yield finalMessage
    })

    mockResearcher.mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        toUIMessageStream: vi.fn(() => new ReadableStream())
      })
    })

    const result = await runEvalChat({
      caseId: 'traffic-1',
      suite: 'traffic-monitor',
      conversation: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'What is example search?' }]
        }
      ] as any,
      searchMode: 'research',
      modelType: 'quality',
      model: {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        provider: 'Google',
        providerId: 'gateway'
      }
    })

    expect(mockResearcher).toHaveBeenCalledWith(
      expect.objectContaining({
        searchMode: 'research',
        modelType: 'quality',
        telemetryEnabled: false,
        correlationId: expect.any(String),
        parentTraceId: expect.any(String),
        experimentalContext: expect.objectContaining({
          caseId: 'traffic-1',
          suite: 'traffic-monitor',
          executionMode: 'eval'
        }),
        modelConfig: expect.objectContaining({
          id: 'gemini-3-flash'
        })
      })
    )
    expect(result.answerText).toBe('Final answer')
    expect(result.citations).toEqual([
      { title: 'Alpha', url: 'https://alpha.test' }
    ])
    expect(result.usedInteractiveOnlyOutput).toBe(false)
    expect(result.correlationId).toEqual(expect.any(String))
    expect(result.otelTraceId).toBeUndefined()
    expect(result.traceId).toBeUndefined()
  })

  it('emits eval replay telemetry only when both tracing flags are enabled', async () => {
    mockIsTracingEnabled.mockReturnValue(true)
    mockIsEvalReplayTracingEnabled.mockReturnValue(true)
    mockReadUIMessageStream.mockImplementation(async function* () {
      yield {
        role: 'assistant',
        parts: [{ type: 'text', text: 'Traced answer' }]
      }
    })
    mockResearcher.mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        toUIMessageStream: vi.fn(() => new ReadableStream())
      })
    })

    const result = await runEvalChat({
      caseId: 'cap-1',
      suite: 'capability',
      conversation: [
        { role: 'user', parts: [{ type: 'text', text: 'hi' }] }
      ] as any,
      searchMode: 'chat',
      modelType: 'speed',
      corpusVersion: 'v6',
      model: {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        provider: 'Google',
        providerId: 'gateway'
      }
    })

    expect(mockWithOtelRootSpan).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'eval-replay',
        metadata: expect.objectContaining({
          caseId: 'cap-1',
          suite: 'capability',
          corpusVersion: 'v6',
          executionMode: 'eval'
        })
      }),
      expect.any(Function)
    )
    expect(mockResearcher).toHaveBeenCalledWith(
      expect.objectContaining({
        telemetryEnabled: true,
        otelTraceId: 'otel-trace-1'
      })
    )
    expect(result.otelTraceId).toBe('otel-trace-1')
  })

  it('passes build user mode and intent to the researcher while keeping chat search mode', async () => {
    const finalMessage = {
      role: 'assistant',
      parts: [{ type: 'text', text: 'Built it.' }]
    }

    mockReadUIMessageStream.mockImplementation(async function* () {
      yield finalMessage
    })

    mockResearcher.mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        toUIMessageStream: vi.fn(() => new ReadableStream())
      })
    })

    await runEvalChat({
      caseId: 'build-traffic-1',
      suite: 'traffic-monitor',
      conversation: [
        {
          role: 'user',
          parts: [{ type: 'text', text: 'Build a tiny counter app.' }]
        }
      ] as any,
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build',
      modelType: 'quality',
      model: {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        provider: 'Google',
        providerId: 'gateway'
      }
    })

    expect(mockResearcher).toHaveBeenCalledWith(
      expect.objectContaining({
        searchMode: 'chat',
        userMode: 'build',
        intent: 'build'
      })
    )
  })

  it('inlines file URLs after pruneMessages and before maybeTruncateMessages', async () => {
    const finalMessage = {
      role: 'assistant',
      parts: [{ type: 'text', text: 'ok' }]
    }

    mockReadUIMessageStream.mockImplementation(async function* () {
      yield finalMessage
    })

    mockResearcher.mockReturnValue({
      stream: vi.fn().mockResolvedValue({
        toUIMessageStream: vi.fn(() => new ReadableStream())
      })
    })

    const callOrder: string[] = []
    mockPruneMessages.mockImplementation(
      ({ messages }: { messages: unknown[] }) => {
        callOrder.push('prune')
        return messages
      }
    )
    mockInlineFileUrls.mockImplementation(async (messages: unknown[]) => {
      callOrder.push('inline')
      return messages
    })
    mockMaybeTruncateMessages.mockImplementation((messages: unknown[]) => {
      callOrder.push('truncate')
      return messages
    })

    await runEvalChat({
      caseId: 'c-1',
      suite: 'traffic-monitor',
      conversation: [
        { role: 'user', parts: [{ type: 'text', text: 'hi' }] }
      ] as any,
      searchMode: 'chat',
      modelType: 'speed',
      model: {
        id: 'gemini-3-flash',
        name: 'Gemini 3 Flash',
        provider: 'Google',
        providerId: 'gateway'
      }
    })

    expect(mockInlineFileUrls).toHaveBeenCalledTimes(1)
    expect(callOrder).toEqual(['prune', 'inline', 'truncate'])
  })
})

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

vi.mock('@/lib/agents/researcher', () => ({
  researcher: (...args: unknown[]) => mockResearcher(...args)
}))

vi.mock('@/lib/utils/context-window', () => ({
  maybeTruncateMessages: (...args: unknown[]) =>
    mockMaybeTruncateMessages(...args)
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn(),
  isTracingEnabled: vi.fn(() => false)
}))

vi.mock('@/lib/streaming/helpers/strip-reasoning-parts', () => ({
  stripReasoningParts: vi.fn((messages: unknown[]) => messages)
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
})

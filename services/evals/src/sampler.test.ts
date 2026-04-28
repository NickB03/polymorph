import { describe, expect, it, vi } from 'vitest'

const mockDbExecute = vi.hoisted(() => vi.fn())

vi.mock('./config', () => ({
  config: {
    sampleSize: 50,
    lookbackHours: 6
  }
}))

vi.mock('./db', () => ({
  db: { execute: mockDbExecute }
}))

vi.mock('./retry', () => ({
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn())
}))

import {
  parseCitations,
  parseSearchResults,
  parseToolNames,
  sampleRecentChats
} from './sampler'

describe('parseToolNames', () => {
  it('returns parsed array for valid JSON', () => {
    expect(parseToolNames('["search","fetch"]')).toEqual(['search', 'fetch'])
  })

  it('returns empty array for null', () => {
    expect(parseToolNames(null)).toEqual([])
  })

  it('filters out non-string entries', () => {
    expect(parseToolNames('[1, "search", null, ""]')).toEqual(['search'])
  })

  it('throws SamplerParseError for malformed JSON', () => {
    expect(() => parseToolNames('{not valid')).toThrow('SamplerParseError')
  })
})

describe('parseCitations', () => {
  it('returns parsed citations for valid JSON', () => {
    const raw = JSON.stringify([{ url: 'https://a.com', title: 'A' }])
    expect(parseCitations(raw)).toEqual([{ url: 'https://a.com', title: 'A' }])
  })

  it('returns empty array for null', () => {
    expect(parseCitations(null)).toEqual([])
  })

  it('throws SamplerParseError for malformed JSON', () => {
    expect(() => parseCitations('{garbage')).toThrow('SamplerParseError')
  })
})

describe('parseSearchResults', () => {
  it('returns parsed results for valid JSON', () => {
    const raw = JSON.stringify([
      {
        query: 'test',
        results: [{ title: 'T', url: 'https://t.com', snippet: 'snip' }]
      }
    ])
    const result = parseSearchResults(raw)
    expect(result).toHaveLength(1)
    expect(result[0].query).toBe('test')
    expect(result[0].results[0].title).toBe('T')
  })

  it('returns empty array for null', () => {
    expect(parseSearchResults(null)).toEqual([])
  })

  it('throws SamplerParseError for malformed JSON', () => {
    expect(() => parseSearchResults('not json')).toThrow('SamplerParseError')
  })
})

describe('sampleRecentChats', () => {
  it('builds a coherent target-turn sample from canonical UI messages and metadata', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-1',
        created_at: new Date('2026-04-22T12:00:00Z'),
        target_user_message_id: 'user-2',
        target_assistant_message_id: 'assistant-2',
        conversation_messages: [
          {
            id: 'user-1',
            role: 'user',
            createdAt: '2026-04-22T11:00:00Z',
            uiMessage: {
              id: 'user-1',
              role: 'user',
              parts: [{ type: 'text', text: 'first question' }],
              metadata: { userMode: 'search', modelType: 'speed' }
            },
            metadata: { userMode: 'search', modelType: 'speed' },
            textParts: [{ type: 'text', text: 'legacy first question' }]
          },
          {
            id: 'assistant-1',
            role: 'assistant',
            createdAt: '2026-04-22T11:01:00Z',
            uiMessage: {
              id: 'assistant-1',
              role: 'assistant',
              parts: [{ type: 'text', text: 'first answer' }]
            },
            metadata: {},
            textParts: [{ type: 'text', text: 'legacy first answer' }]
          },
          {
            id: 'user-2',
            role: 'user',
            createdAt: '2026-04-22T11:05:00Z',
            uiMessage: {
              id: 'user-2',
              role: 'user',
              parts: [{ type: 'text', text: 'follow-up question' }],
              metadata: {
                userMode: 'research',
                modelType: 'quality',
                modelId: 'original-model'
              }
            },
            metadata: {
              userMode: 'research',
              modelType: 'quality',
              modelId: 'original-model'
            },
            textParts: [{ type: 'text', text: 'legacy follow-up' }]
          }
        ],
        target_assistant_message: {
          id: 'assistant-2',
          role: 'assistant',
          createdAt: '2026-04-22T11:06:00Z',
          uiMessage: {
            id: 'assistant-2',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'fresh historical answer' },
              {
                type: 'tool-search',
                output: {
                  query: 'follow-up question',
                  results: [
                    {
                      title: 'Result',
                      url: 'https://example.com',
                      content: 'Snippet'
                    }
                  ],
                  citationMap: {
                    1: { title: 'Result', url: 'https://example.com' }
                  }
                }
              }
            ]
          },
          metadata: { modelId: 'assistant-model' },
          textParts: [{ type: 'text', text: 'legacy target answer' }]
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({
      chatId: 'chat-1',
      targetUserMessageId: 'user-2',
      targetAssistantMessageId: 'assistant-2',
      userQuery: 'follow-up question',
      modelAnswer: 'fresh historical answer',
      searchMode: 'research',
      modelType: 'quality'
    })
    expect(samples[0].conversation).toEqual([
      {
        role: 'user',
        parts: [{ type: 'text', text: 'first question' }]
      },
      {
        role: 'assistant',
        parts: [{ type: 'text', text: 'first answer' }]
      },
      {
        role: 'user',
        parts: [{ type: 'text', text: 'follow-up question' }]
      }
    ])
    expect(samples[0].searchResults).toEqual([
      {
        query: 'follow-up question',
        results: [
          {
            title: 'Result',
            url: 'https://example.com',
            snippet: 'Snippet'
          }
        ]
      }
    ])
    expect(samples[0].citations).toEqual([
      { title: 'Result', url: 'https://example.com' }
    ])
    expect(samples[0].toolNames).toEqual(['search'])
    expect(samples[0].metadataTags).toContain('user-mode:research')
  })

  it('falls back to legacy text parts and labels missing mode metadata', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-legacy',
        created_at: new Date('2026-04-22T12:00:00Z'),
        target_user_message_id: 'user-legacy',
        target_assistant_message_id: 'assistant-legacy',
        conversation_messages: [
          {
            id: 'user-legacy',
            role: 'user',
            createdAt: '2026-04-22T11:05:00Z',
            uiMessage: null,
            metadata: null,
            textParts: [{ type: 'text', text: 'legacy question' }]
          }
        ],
        target_assistant_message: {
          id: 'assistant-legacy',
          role: 'assistant',
          createdAt: '2026-04-22T11:06:00Z',
          uiMessage: null,
          metadata: null,
          textParts: [{ type: 'text', text: 'legacy answer' }]
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples[0]).toMatchObject({
      userQuery: 'legacy question',
      modelAnswer: 'legacy answer',
      searchMode: 'chat',
      modelType: 'speed'
    })
    expect(samples[0].metadataTags).toContain('mode_metadata_missing')
  })

  it('preserves build user mode as chat search mode with build intent', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-build',
        created_at: new Date('2026-04-22T12:00:00Z'),
        target_user_message_id: 'user-build',
        target_assistant_message_id: 'assistant-build',
        conversation_messages: [
          {
            id: 'user-build',
            role: 'user',
            createdAt: '2026-04-22T11:05:00Z',
            uiMessage: {
              id: 'user-build',
              role: 'user',
              parts: [{ type: 'text', text: 'Make a dashboard' }],
              metadata: {
                userMode: 'build',
                intent: 'build',
                modelType: 'quality'
              }
            },
            metadata: {
              userMode: 'build',
              intent: 'build',
              modelType: 'quality'
            },
            textParts: [{ type: 'text', text: 'legacy build question' }]
          }
        ],
        target_assistant_message: {
          id: 'assistant-build',
          role: 'assistant',
          createdAt: '2026-04-22T11:06:00Z',
          uiMessage: {
            id: 'assistant-build',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Here is a dashboard.' }]
          },
          metadata: {},
          textParts: [{ type: 'text', text: 'legacy build answer' }]
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples[0]).toMatchObject({
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build',
      modelType: 'quality'
    })
    expect(samples[0].metadataTags).toContain('user-mode:build')
  })

  it('falls back to assistant build user mode when user metadata lacks mode', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-assistant-build',
        created_at: new Date('2026-04-22T12:00:00Z'),
        target_user_message_id: 'user-assistant-build',
        target_assistant_message_id: 'assistant-assistant-build',
        conversation_messages: [
          {
            id: 'user-assistant-build',
            role: 'user',
            createdAt: '2026-04-22T11:05:00Z',
            uiMessage: {
              id: 'user-assistant-build',
              role: 'user',
              parts: [{ type: 'text', text: 'Build a pricing table' }],
              metadata: { modelType: 'speed' }
            },
            metadata: { modelType: 'speed' },
            textParts: [{ type: 'text', text: 'legacy question' }]
          }
        ],
        target_assistant_message: {
          id: 'assistant-assistant-build',
          role: 'assistant',
          createdAt: '2026-04-22T11:06:00Z',
          uiMessage: {
            id: 'assistant-assistant-build',
            role: 'assistant',
            parts: [{ type: 'text', text: 'Here is a pricing table.' }],
            metadata: { userMode: 'build' }
          },
          metadata: { userMode: 'build' },
          textParts: [{ type: 'text', text: 'legacy answer' }]
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples[0]).toMatchObject({
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build',
      modelType: 'speed'
    })
    expect(samples[0].metadataTags).toContain('user-mode:build')
  })

  it('dedupes search results when ui_message and legacy parts carry the same payload', async () => {
    const sharedSearchOutput = {
      query: 'shared query',
      results: [
        {
          title: 'Shared Result',
          url: 'https://shared.example.com',
          content: 'shared snippet'
        }
      ]
    }

    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-dup',
        created_at: new Date('2026-04-22T12:00:00Z'),
        target_user_message_id: 'user-dup',
        target_assistant_message_id: 'assistant-dup',
        conversation_messages: [
          {
            id: 'user-dup',
            role: 'user',
            createdAt: '2026-04-22T11:05:00Z',
            uiMessage: {
              id: 'user-dup',
              role: 'user',
              parts: [{ type: 'text', text: 'shared query' }]
            },
            metadata: null,
            textParts: null
          }
        ],
        target_assistant_message: {
          id: 'assistant-dup',
          role: 'assistant',
          createdAt: '2026-04-22T11:06:00Z',
          uiMessage: {
            id: 'assistant-dup',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'answer' },
              { type: 'tool-search', output: sharedSearchOutput }
            ]
          },
          metadata: null,
          textParts: null
        },
        target_search_results: JSON.stringify([sharedSearchOutput]),
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples[0].searchResults).toHaveLength(1)
    expect(samples[0].searchResults[0]).toMatchObject({
      query: 'shared query'
    })
    expect(samples[0].searchResults[0].results[0]).toMatchObject({
      url: 'https://shared.example.com'
    })
  })
})

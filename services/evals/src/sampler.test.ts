import { beforeEach, describe, expect, it, vi } from 'vitest'

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

function sqlText(raw: unknown): string {
  const chunks = (raw as { queryChunks?: unknown[] }).queryChunks ?? []
  return chunks
    .map(chunk => {
      const value = (chunk as { value?: unknown }).value
      return Array.isArray(value) ? value.join('') : ''
    })
    .join('')
}

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
  beforeEach(() => {
    mockDbExecute.mockReset()
  })

  it('prefilters replay-incompatible tools from canonical ui_message parts before sampling', async () => {
    mockDbExecute.mockResolvedValueOnce([])

    await sampleRecentChats()

    const query = sqlText(mockDbExecute.mock.calls[0][0])
    expect(query).toContain("assistant.ui_message->'parts'")
    expect(query).toContain('jsonb_array_elements')
    expect(query).toContain("'tool-createCanvasArtifact'")
    expect(query).toContain("'tool-updateCanvasArtifact'")
    expect(query).toContain("'tool-readCanvasArtifact'")
    expect(query).toContain("'tool-generateImage'")
  })

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
            metadata: { userMode: 'search', modelType: 'speed' }
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
            metadata: {}
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
            }
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
          metadata: { modelId: 'assistant-model' }
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

  it('samples ui_message-only rows without legacy parts projections', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-ui-only',
        created_at: new Date('2026-04-29T12:00:00Z'),
        target_user_message_id: 'user-ui-only',
        target_assistant_message_id: 'assistant-ui-only',
        conversation_messages: [
          {
            id: 'user-ui-only',
            role: 'user',
            createdAt: '2026-04-29T11:05:00Z',
            uiMessage: {
              id: 'user-ui-only',
              role: 'user',
              parts: [{ type: 'text', text: 'ui only question' }],
              metadata: { userMode: 'research', modelType: 'quality' }
            },
            metadata: null
          }
        ],
        target_assistant_message: {
          id: 'assistant-ui-only',
          role: 'assistant',
          createdAt: '2026-04-29T11:06:00Z',
          uiMessage: {
            id: 'assistant-ui-only',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'ui only answer' },
              {
                type: 'tool-search',
                output: {
                  query: 'ui only question',
                  results: [
                    {
                      title: 'Canonical Result',
                      url: 'https://canonical.example.com',
                      snippet: 'Canonical snippet'
                    }
                  ],
                  citationMap: {
                    1: {
                      title: 'Canonical Result',
                      url: 'https://canonical.example.com'
                    }
                  }
                }
              }
            ]
          },
          metadata: null
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples).toHaveLength(1)
    expect(samples[0]).toMatchObject({
      chatId: 'chat-ui-only',
      userQuery: 'ui only question',
      modelAnswer: 'ui only answer',
      searchMode: 'research',
      modelType: 'quality',
      toolNames: ['search']
    })
    expect(samples[0].searchResults).toEqual([
      {
        query: 'ui only question',
        results: [
          {
            title: 'Canonical Result',
            url: 'https://canonical.example.com',
            snippet: 'Canonical snippet'
          }
        ]
      }
    ])
    expect(samples[0].citations).toEqual([
      {
        title: 'Canonical Result',
        url: 'https://canonical.example.com'
      }
    ])
  })

  it('rejects ui_message-only unsupported tools without legacy tool-name projections', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-ui-only-image',
        created_at: new Date('2026-04-29T12:00:00Z'),
        target_user_message_id: 'user-ui-only-image',
        target_assistant_message_id: 'assistant-ui-only-image',
        conversation_messages: [
          {
            id: 'user-ui-only-image',
            role: 'user',
            createdAt: '2026-04-29T11:05:00Z',
            uiMessage: {
              id: 'user-ui-only-image',
              role: 'user',
              parts: [{ type: 'text', text: 'draw this' }],
              metadata: { userMode: 'search' }
            },
            metadata: null
          }
        ],
        target_assistant_message: {
          id: 'assistant-ui-only-image',
          role: 'assistant',
          createdAt: '2026-04-29T11:06:00Z',
          uiMessage: {
            id: 'assistant-ui-only-image',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'here is the image' },
              { type: 'tool-generateImage', output: { status: 'completed' } }
            ]
          },
          metadata: null
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples).toHaveLength(0)
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
            }
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
          metadata: {}
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
            metadata: { modelType: 'speed' }
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
          metadata: { userMode: 'build' }
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

  it('reads modelType from assistant metadata when user metadata omits it', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-assistant-modeltype',
        created_at: new Date('2026-04-28T00:00:00Z'),
        target_user_message_id: 'user-1',
        target_assistant_message_id: 'assistant-1',
        conversation_messages: [
          {
            id: 'user-1',
            role: 'user',
            createdAt: '2026-04-28T00:00:00Z',
            uiMessage: {
              id: 'user-1',
              role: 'user',
              parts: [{ type: 'text', text: 'hello' }],
              metadata: { userMode: 'search' }
            },
            metadata: { userMode: 'search' }
          }
        ],
        target_assistant_message: {
          id: 'assistant-1',
          role: 'assistant',
          createdAt: '2026-04-28T00:00:01Z',
          uiMessage: {
            id: 'assistant-1',
            role: 'assistant',
            parts: [{ type: 'text', text: 'hi' }],
            metadata: { modelType: 'quality', modelId: 'openrouter:x/y' }
          },
          metadata: { modelType: 'quality', modelId: 'openrouter:x/y' }
        },
        target_search_results: null,
        target_citations: null,
        target_tool_names: null
      }
    ])

    const samples = await sampleRecentChats()

    expect(samples[0].modelType).toBe('quality')
  })

  it('rejects samples whose target assistant used canvas tools', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-canvas',
        created_at: new Date('2026-04-28T00:00:00Z'),
        target_user_message_id: 'user-1',
        target_assistant_message_id: 'assistant-1',
        conversation_messages: JSON.stringify([
          {
            id: 'user-1',
            role: 'user',
            createdAt: '2026-04-28T00:00:00Z',
            uiMessage: {
              id: 'user-1',
              role: 'user',
              parts: [{ type: 'text', text: 'make a chart' }]
            },
            metadata: {}
          }
        ]),
        target_assistant_message: JSON.stringify({
          id: 'assistant-1',
          role: 'assistant',
          createdAt: '2026-04-28T00:00:01Z',
          uiMessage: {
            id: 'assistant-1',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'here you go' },
              { type: 'tool-createCanvasArtifact', output: { ok: true } }
            ]
          },
          metadata: {}
        }),
        target_search_results: null,
        target_citations: null,
        target_tool_names: JSON.stringify(['createCanvasArtifact'])
      }
    ])

    const samples = await sampleRecentChats()
    expect(samples).toHaveLength(0)
  })

  it('rejects samples whose target assistant used generateImage', async () => {
    mockDbExecute.mockResolvedValueOnce([
      {
        chat_id: 'chat-image',
        created_at: new Date('2026-04-28T00:00:00Z'),
        target_user_message_id: 'user-1',
        target_assistant_message_id: 'assistant-1',
        conversation_messages: JSON.stringify([
          {
            id: 'user-1',
            role: 'user',
            createdAt: '2026-04-28T00:00:00Z',
            uiMessage: {
              id: 'user-1',
              role: 'user',
              parts: [{ type: 'text', text: 'draw a cat' }]
            },
            metadata: {}
          }
        ]),
        target_assistant_message: JSON.stringify({
          id: 'assistant-1',
          role: 'assistant',
          createdAt: '2026-04-28T00:00:01Z',
          uiMessage: {
            id: 'assistant-1',
            role: 'assistant',
            parts: [
              { type: 'text', text: 'here is a cat' },
              { type: 'tool-generateImage', output: { status: 'completed' } }
            ]
          },
          metadata: {}
        }),
        target_search_results: null,
        target_citations: null,
        target_tool_names: JSON.stringify(['generateImage'])
      }
    ])

    const samples = await sampleRecentChats()
    expect(samples).toHaveLength(0)
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
            metadata: null
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
          metadata: null
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

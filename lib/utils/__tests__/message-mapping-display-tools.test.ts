import { describe, expect, it, vi } from 'vitest'

import type { DBMessagePartSelect } from '@/lib/types/message-persistence'

import {
  mapDBPartToUIMessagePart,
  mapUIMessagePartsToDBParts
} from '../message-mapping'

// All 9 display tools that exist today
const DISPLAY_TOOLS = [
  'displayPlan',
  'displayTable',
  'displayCitations',
  'displayLinkPreview',
  'displayOptionList',
  'displayCallout',
  'displayChart',
  'displayGeoMap',
  'displayTimeline'
]

function makeDisplayToolPart(
  name: string,
  overrides?: Record<string, unknown>
) {
  return {
    type: `tool-${name}`,
    toolCallId: `call-${name}`,
    state: 'output-available',
    input: { query: 'test' },
    output: { result: name },
    ...overrides
  }
}

function makeDBDisplayPart(
  name: string,
  overrides?: Partial<DBMessagePartSelect>
): DBMessagePartSelect {
  return {
    id: `id-${name}`,
    messageId: 'msg-1',
    order: 0,
    type: 'tool-dynamic',
    tool_toolCallId: `call-${name}`,
    tool_state: 'output-available',
    tool_dynamic_name: name,
    tool_dynamic_type: 'display',
    tool_dynamic_input: { query: 'test' },
    tool_dynamic_output: { result: name },
    tool_errorText: null,
    providerMetadata: null,
    text_text: null,
    reasoning_text: null,
    file_mediaType: null,
    file_filename: null,
    file_url: null,
    source_url_sourceId: null,
    source_url_url: null,
    source_url_title: null,
    source_document_sourceId: null,
    source_document_mediaType: null,
    source_document_title: null,
    source_document_filename: null,
    source_document_url: null,
    source_document_snippet: null,
    tool_search_input: null,
    tool_search_output: null,
    tool_fetch_input: null,
    tool_fetch_output: null,
    tool_question_input: null,
    tool_question_output: null,
    tool_todoWrite_input: null,
    tool_todoWrite_output: null,
    tool_todoRead_input: null,
    tool_todoRead_output: null,
    data_prefix: null,
    data_content: null,
    data_id: null,
    ...overrides
  } as DBMessagePartSelect
}

function makeCanvasToolPart(
  name: 'createCanvasArtifact' | 'updateCanvasArtifact',
  overrides?: Record<string, unknown>
) {
  return {
    type: `tool-${name}`,
    toolCallId: `call-${name}`,
    state: 'output-available',
    input: {
      draftSource: {
        'App.tsx': 'export default function App() { return <div>Hello</div> }'
      },
      ...(name === 'updateCanvasArtifact' ? { baseRevision: 3 } : {})
    },
    output: {
      artifactId: 'art-1',
      chatId: 'chat-1',
      title: 'Canvas Artifact',
      status: 'ready',
      draftRevision: 4,
      currentVersionId: null
    },
    callProviderMetadata: {
      provider: {
        requestId: `${name}-request`
      }
    },
    ...overrides
  }
}

function makeCompetitorResearchToolPart(overrides?: Record<string, unknown>) {
  return {
    type: 'tool-competitorResearch',
    toolCallId: 'call-competitorResearch',
    state: 'output-available',
    input: {
      market: 'AI coding assistants',
      competitors: ['AlphaCode', 'BetaDev'],
      dimensions: ['UX', 'Reliability']
    },
    output: {
      summary:
        'AlphaCode leads on UX while BetaDev is stronger on reliability.',
      cards: [
        {
          competitor: 'AlphaCode',
          strengths: ['Fast onboarding'],
          weaknesses: ['Limited controls']
        }
      ],
      matrix: [
        {
          competitor: 'AlphaCode',
          UX: 'Strong',
          Reliability: 'Moderate'
        }
      ]
    },
    callProviderMetadata: {
      provider: {
        requestId: 'competitor-research-request'
      }
    },
    ...overrides
  }
}

function makeDBDynamicPart(
  name: string,
  overrides?: Partial<DBMessagePartSelect>
): DBMessagePartSelect {
  return {
    ...makeDBDisplayPart(name, overrides),
    tool_dynamic_type: 'dynamic'
  } as DBMessagePartSelect
}

describe('display tool persistence', () => {
  describe('mapUIMessagePartsToDBParts', () => {
    it.each(DISPLAY_TOOLS)(
      'maps %s to tool-dynamic with display type',
      toolName => {
        const parts = mapUIMessagePartsToDBParts(
          [makeDisplayToolPart(toolName)],
          'msg-1'
        )

        expect(parts).toHaveLength(1)
        expect(parts[0]).toMatchObject({
          type: 'tool-dynamic',
          tool_toolCallId: `call-${toolName}`,
          tool_state: 'output-available',
          tool_dynamic_name: toolName,
          tool_dynamic_type: 'display',
          tool_dynamic_input: { query: 'test' },
          tool_dynamic_output: { result: toolName }
        })
      }
    )

    it('handles a hypothetical future display tool (displayFuture)', () => {
      const parts = mapUIMessagePartsToDBParts(
        [makeDisplayToolPart('displayFuture')],
        'msg-1'
      )

      expect(parts).toHaveLength(1)
      expect(parts[0]).toMatchObject({
        type: 'tool-dynamic',
        tool_dynamic_name: 'displayFuture',
        tool_dynamic_type: 'display'
      })
    })

    it('generates a toolCallId when none is provided', () => {
      const parts = mapUIMessagePartsToDBParts(
        [makeDisplayToolPart('displayCallout', { toolCallId: undefined })],
        'msg-1'
      )

      expect(parts[0].tool_toolCallId).toBeTruthy()
    })

    it('defaults state to input-available when missing', () => {
      const parts = mapUIMessagePartsToDBParts(
        [makeDisplayToolPart('displayChart', { state: undefined })],
        'msg-1'
      )

      expect(parts[0].tool_state).toBe('input-available')
    })

    it('stores errorText only for output-error state', () => {
      const errorPart = makeDisplayToolPart('displayTimeline', {
        state: 'output-error',
        errorText: 'render failed'
      })
      const okPart = makeDisplayToolPart('displayTimeline', {
        state: 'output-available'
      })

      const [dbError] = mapUIMessagePartsToDBParts([errorPart], 'msg-1')
      const [dbOk] = mapUIMessagePartsToDBParts([okPart], 'msg-1')

      expect(dbError.tool_errorText).toBe('render failed')
      expect(dbOk.tool_errorText).toBeUndefined()
    })
  })

  describe('mapDBPartToUIMessagePart', () => {
    it.each(DISPLAY_TOOLS)(
      'reconstructs tool-%s from tool-dynamic DB row',
      toolName => {
        const uiPart = mapDBPartToUIMessagePart(makeDBDisplayPart(toolName))

        expect(uiPart).toMatchObject({
          type: `tool-${toolName}`,
          toolCallId: `call-${toolName}`,
          state: 'output-available',
          input: { query: 'test' },
          output: { result: toolName }
        })
      }
    )

    it('reconstructs a hypothetical future display tool', () => {
      const uiPart = mapDBPartToUIMessagePart(
        makeDBDisplayPart('displayFuture')
      )

      expect(uiPart).toMatchObject({
        type: 'tool-displayFuture',
        state: 'output-available'
      })
    })
  })

  describe('unrecognized tool-* warning', () => {
    it('warns when an unknown tool-* part falls through', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const parts = mapUIMessagePartsToDBParts(
        [{ type: 'tool-unknownThing', data: 'test' }],
        'msg-1'
      )

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('tool-unknownThing')
      )
      // Falls through to generic data storage
      expect(parts[0]).toMatchObject({
        data_prefix: 'tool-unknownThing'
      })

      warnSpy.mockRestore()
    })

    it('does not warn for display tools', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mapUIMessagePartsToDBParts(
        [makeDisplayToolPart('displayCallout')],
        'msg-1'
      )

      expect(warnSpy).not.toHaveBeenCalled()

      warnSpy.mockRestore()
    })
  })

  describe('round-trip', () => {
    it.each(DISPLAY_TOOLS)('%s survives UI → DB → UI round-trip', toolName => {
      const originalPart = makeDisplayToolPart(toolName)
      const [dbPart] = mapUIMessagePartsToDBParts([originalPart], 'msg-1')

      // Simulate reading back from DB by adding the required select fields
      const dbSelect = makeDBDisplayPart(toolName, {
        type: dbPart.type,
        tool_toolCallId: dbPart.tool_toolCallId,
        tool_state: dbPart.tool_state,
        tool_dynamic_name: dbPart.tool_dynamic_name,
        tool_dynamic_type: dbPart.tool_dynamic_type,
        tool_dynamic_input: dbPart.tool_dynamic_input,
        tool_dynamic_output: dbPart.tool_dynamic_output,
        tool_errorText: dbPart.tool_errorText ?? null
      })

      const restored = mapDBPartToUIMessagePart(dbSelect)

      expect(restored).toMatchObject({
        type: `tool-${toolName}`,
        toolCallId: `call-${toolName}`,
        state: 'output-available',
        input: { query: 'test' },
        output: { result: toolName }
      })
    })
  })
})

// --- Canvas data part persistence ---

describe('canvas data part persistence', () => {
  describe('persisted canvas parts', () => {
    it('persists data-canvasArtifact parts', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          {
            type: 'data-canvasArtifact',
            data: {
              artifactId: 'art-1',
              chatId: 'chat-1',
              title: 'My App',
              status: 'ready',
              draftRevision: 1,
              currentVersionId: null
            }
          }
        ],
        'msg-1'
      )

      expect(parts).toHaveLength(1)
      expect(parts[0]).toMatchObject({
        data_prefix: 'canvasArtifact',
        data_content: {
          artifactId: 'art-1',
          chatId: 'chat-1',
          title: 'My App',
          status: 'ready'
        }
      })
    })

    it('persists data-canvasArtifactStatus parts', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          {
            type: 'data-canvasArtifactStatus',
            data: {
              artifactId: 'art-1',
              chatId: 'chat-1',
              status: 'compiling',
              draftRevision: 2,
              currentVersionId: null,
              updatedAt: '2026-03-19T00:00:00Z',
              guestCanvasToken: 'token-abc'
            }
          }
        ],
        'msg-1'
      )

      expect(parts).toHaveLength(1)
      expect(parts[0]).toMatchObject({
        data_prefix: 'canvasArtifactStatus',
        data_content: expect.objectContaining({
          artifactId: 'art-1',
          status: 'compiling',
          guestCanvasToken: 'token-abc'
        })
      })
    })
  })

  describe('transient canvas parts', () => {
    it('filters out data-canvasArtifactEvent parts (transient)', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          {
            type: 'data-canvasArtifactEvent',
            data: {
              artifactId: 'art-1',
              event: 'compile-progress',
              payload: {
                artifactId: 'art-1',
                title: 'Canvas Artifact',
                source: 'create',
                startedAt: '2026-03-19T00:00:00Z',
                steps: [
                  {
                    id: 'validate',
                    label: 'Validating source',
                    status: 'in-progress'
                  }
                ]
              }
            }
          }
        ],
        'msg-1'
      )

      expect(parts).toHaveLength(0)
    })

    it('filters out data-canvasDiagnostics parts (transient)', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          {
            type: 'data-canvasDiagnostics',
            data: {
              artifactId: 'art-1',
              diagnostics: [
                {
                  severity: 'error',
                  message: 'Type error in App.tsx'
                }
              ]
            }
          }
        ],
        'msg-1'
      )

      expect(parts).toHaveLength(0)
    })

    it('preserves persisted parts while filtering transient ones in a mixed batch', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          { type: 'text', text: 'Here is your app' },
          {
            type: 'data-canvasArtifact',
            data: {
              artifactId: 'art-1',
              chatId: 'chat-1',
              title: 'My App',
              status: 'ready',
              draftRevision: 1,
              currentVersionId: null
            }
          },
          {
            type: 'data-canvasArtifactEvent',
            data: {
              artifactId: 'art-1',
              event: 'compile-progress',
              payload: {
                artifactId: 'art-1',
                title: 'Canvas Artifact',
                source: 'update',
                startedAt: '2026-03-19T00:00:00Z',
                steps: [
                  {
                    id: 'validate',
                    label: 'Validating source',
                    status: 'completed'
                  },
                  {
                    id: 'bundle',
                    label: 'Building React components',
                    status: 'in-progress'
                  }
                ],
                outcome: 'failed',
                errorMessage: 'Type error in App.tsx'
              }
            }
          },
          {
            type: 'data-canvasDiagnostics',
            data: {
              artifactId: 'art-1',
              diagnostics: []
            }
          },
          {
            type: 'data-canvasArtifactStatus',
            data: {
              artifactId: 'art-1',
              chatId: 'chat-1',
              status: 'ready',
              draftRevision: 1,
              currentVersionId: null,
              updatedAt: '2026-03-19T00:00:00Z'
            }
          }
        ],
        'msg-1'
      )

      // text + canvasArtifact + canvasArtifactStatus = 3 persisted parts
      // canvasArtifactEvent + canvasDiagnostics = 2 transient parts (filtered out)
      expect(parts).toHaveLength(3)
      expect(parts[0].type).toBe('text')
      expect(parts[1].data_prefix).toBe('canvasArtifact')
      expect(parts[2].data_prefix).toBe('canvasArtifactStatus')
    })
  })

  describe('canvas data part round-trip', () => {
    it('data-canvasArtifact survives UI -> DB -> UI round-trip', () => {
      const originalData = {
        artifactId: 'art-1',
        chatId: 'chat-1',
        title: 'My App',
        status: 'ready',
        draftRevision: 1,
        currentVersionId: null
      }

      const [dbPart] = mapUIMessagePartsToDBParts(
        [{ type: 'data-canvasArtifact', data: originalData }],
        'msg-1'
      )

      const dbSelect = makeDBDisplayPart('unused', {
        type: dbPart.type,
        data_prefix: dbPart.data_prefix,
        data_content: dbPart.data_content,
        data_id: dbPart.data_id ?? null,
        // Clear tool-specific fields that don't apply to data parts
        tool_toolCallId: null,
        tool_state: null,
        tool_dynamic_name: null,
        tool_dynamic_type: null,
        tool_dynamic_input: null,
        tool_dynamic_output: null
      })

      const restored = mapDBPartToUIMessagePart(dbSelect)

      expect(restored).toMatchObject({
        type: 'data-canvasArtifact',
        data: originalData
      })
    })
  })
})

describe('canvas tool persistence', () => {
  it.each(['createCanvasArtifact', 'updateCanvasArtifact'] as const)(
    'persists tool-%s parts as tool-dynamic with provider metadata',
    toolName => {
      const parts = mapUIMessagePartsToDBParts(
        [makeCanvasToolPart(toolName)],
        'msg-1'
      )

      expect(parts).toHaveLength(1)
      expect(parts[0]).toMatchObject({
        type: 'tool-dynamic',
        tool_toolCallId: `call-${toolName}`,
        tool_state: 'output-available',
        tool_dynamic_name: toolName,
        tool_dynamic_type: 'dynamic',
        tool_dynamic_input: expect.objectContaining({
          draftSource: {
            'App.tsx':
              'export default function App() { return <div>Hello</div> }'
          }
        }),
        tool_dynamic_output: expect.objectContaining({
          artifactId: 'art-1',
          title: 'Canvas Artifact'
        }),
        providerMetadata: {
          provider: {
            requestId: `${toolName}-request`
          }
        }
      })
    }
  )

  it.each(['createCanvasArtifact', 'updateCanvasArtifact'] as const)(
    'round-trips tool-%s through UI -> DB -> UI',
    toolName => {
      const originalPart = makeCanvasToolPart(toolName)
      const [dbPart] = mapUIMessagePartsToDBParts([originalPart], 'msg-1')

      const restored = mapDBPartToUIMessagePart(
        makeDBDynamicPart(toolName, {
          type: dbPart.type,
          tool_toolCallId: dbPart.tool_toolCallId,
          tool_state: dbPart.tool_state,
          tool_dynamic_name: dbPart.tool_dynamic_name,
          tool_dynamic_type: dbPart.tool_dynamic_type,
          tool_dynamic_input: dbPart.tool_dynamic_input,
          tool_dynamic_output: dbPart.tool_dynamic_output,
          tool_errorText: dbPart.tool_errorText ?? null,
          providerMetadata: dbPart.providerMetadata ?? null
        })
      )

      expect(restored).toMatchObject({
        type: `tool-${toolName}`,
        toolCallId: `call-${toolName}`,
        state: 'output-available',
        input: expect.objectContaining({
          draftSource: {
            'App.tsx':
              'export default function App() { return <div>Hello</div> }'
          }
        }),
        output: expect.objectContaining({
          artifactId: 'art-1',
          title: 'Canvas Artifact'
        }),
        callProviderMetadata: {
          provider: {
            requestId: `${toolName}-request`
          }
        }
      })
    }
  )
})

describe('registered rich dynamic tool persistence', () => {
  it('persists tool-competitorResearch as tool-dynamic with metadata intact', () => {
    const parts = mapUIMessagePartsToDBParts(
      [makeCompetitorResearchToolPart()],
      'msg-1'
    )

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({
      type: 'tool-dynamic',
      tool_toolCallId: 'call-competitorResearch',
      tool_state: 'output-available',
      tool_dynamic_name: 'competitorResearch',
      tool_dynamic_type: 'dynamic',
      tool_dynamic_input: {
        market: 'AI coding assistants',
        competitors: ['AlphaCode', 'BetaDev'],
        dimensions: ['UX', 'Reliability']
      },
      tool_dynamic_output: expect.objectContaining({
        summary:
          'AlphaCode leads on UX while BetaDev is stronger on reliability.'
      }),
      providerMetadata: {
        provider: {
          requestId: 'competitor-research-request'
        }
      }
    })
  })

  it('persists tool-competitorResearch errorText in dynamic columns', () => {
    const parts = mapUIMessagePartsToDBParts(
      [
        makeCompetitorResearchToolPart({
          state: 'output-error',
          output: undefined,
          errorText: 'research failed'
        })
      ],
      'msg-1'
    )

    expect(parts).toHaveLength(1)
    expect(parts[0]).toMatchObject({
      type: 'tool-dynamic',
      tool_toolCallId: 'call-competitorResearch',
      tool_state: 'output-error',
      tool_dynamic_name: 'competitorResearch',
      tool_dynamic_type: 'dynamic',
      tool_dynamic_input: {
        market: 'AI coding assistants',
        competitors: ['AlphaCode', 'BetaDev'],
        dimensions: ['UX', 'Reliability']
      },
      tool_errorText: 'research failed',
      providerMetadata: {
        provider: {
          requestId: 'competitor-research-request'
        }
      }
    })
    expect(parts[0].tool_dynamic_output).toBeUndefined()
  })

  it('restores persisted competitorResearch dynamic rows to tool-competitorResearch', () => {
    const originalPart = makeCompetitorResearchToolPart()
    const [dbPart] = mapUIMessagePartsToDBParts([originalPart], 'msg-1')

    const restored = mapDBPartToUIMessagePart(
      makeDBDynamicPart('competitorResearch', {
        type: dbPart.type,
        tool_toolCallId: dbPart.tool_toolCallId,
        tool_state: dbPart.tool_state,
        tool_dynamic_name: dbPart.tool_dynamic_name,
        tool_dynamic_type: dbPart.tool_dynamic_type,
        tool_dynamic_input: dbPart.tool_dynamic_input,
        tool_dynamic_output: dbPart.tool_dynamic_output,
        tool_errorText: dbPart.tool_errorText ?? null,
        providerMetadata: dbPart.providerMetadata ?? null
      })
    )

    expect(restored).toMatchObject({
      type: 'tool-competitorResearch',
      toolCallId: 'call-competitorResearch',
      state: 'output-available',
      input: {
        market: 'AI coding assistants',
        competitors: ['AlphaCode', 'BetaDev'],
        dimensions: ['UX', 'Reliability']
      },
      output: expect.objectContaining({
        summary:
          'AlphaCode leads on UX while BetaDev is stronger on reliability.'
      }),
      callProviderMetadata: {
        provider: {
          requestId: 'competitor-research-request'
        }
      }
    })
  })

  it('restores competitorResearch error rows with errorText and metadata intact', () => {
    const restored = mapDBPartToUIMessagePart(
      makeDBDynamicPart('competitorResearch', {
        tool_toolCallId: 'call-competitorResearch-error',
        tool_state: 'output-error',
        tool_dynamic_name: 'competitorResearch',
        tool_dynamic_type: 'dynamic',
        tool_dynamic_input: {
          market: 'AI coding assistants',
          competitors: ['AlphaCode', 'BetaDev'],
          dimensions: ['UX', 'Reliability']
        },
        tool_dynamic_output: null,
        tool_errorText: 'research failed',
        providerMetadata: {
          provider: {
            requestId: 'competitor-research-error-request'
          }
        }
      })
    )

    expect(restored).toMatchObject({
      type: 'tool-competitorResearch',
      toolCallId: 'call-competitorResearch-error',
      state: 'output-error',
      input: {
        market: 'AI coding assistants',
        competitors: ['AlphaCode', 'BetaDev'],
        dimensions: ['UX', 'Reliability']
      },
      errorText: 'research failed',
      callProviderMetadata: {
        provider: {
          requestId: 'competitor-research-error-request'
        }
      }
    })
  })
})

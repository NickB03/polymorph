import { describe, expect, it, vi } from 'vitest'

import type { ArtifactData, ArtifactStatusData } from '@/lib/types/artifact'
import type { DBMessagePartSelect } from '@/lib/types/message-persistence'

import {
  mapDBPartToUIMessagePart,
  mapUIMessagePartsToDBParts
} from '../message-mapping'

// All 8 display tools that exist today
const DISPLAY_TOOLS = [
  'displayPlan',
  'displayTable',
  'displayCitations',
  'displayLinkPreview',
  'displayOptionList',
  'displayCallout',
  'displayChart',
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

function makeDBArtifactPart(
  dataPrefix: 'artifact' | 'artifactStatus',
  data: ArtifactData | ArtifactStatusData,
  overrides?: Partial<DBMessagePartSelect>
): DBMessagePartSelect {
  return {
    id: `id-${dataPrefix}`,
    messageId: 'msg-1',
    order: 0,
    type: `data-${dataPrefix}`,
    tool_toolCallId: null,
    tool_state: null,
    tool_dynamic_name: null,
    tool_dynamic_type: null,
    tool_dynamic_input: null,
    tool_dynamic_output: null,
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
    data_prefix: dataPrefix,
    data_content: data,
    data_id: `${dataPrefix}-part-1`,
    ...overrides
  } as DBMessagePartSelect
}

function makeArtifactToolPart(
  name:
    | 'createWebappArtifact'
    | 'updateWebappArtifact'
    | 'getArtifactStatus'
    | 'restartArtifactPreview',
  overrides?: Record<string, unknown>
) {
  return {
    type: `tool-${name}`,
    toolCallId: `call-${name}`,
    state: 'output-available',
    input: { artifactId: 'artifact-1' },
    output: { id: 'artifact-1', status: 'ready' },
    ...overrides
  }
}

function makeDBArtifactToolPart(
  name:
    | 'createWebappArtifact'
    | 'updateWebappArtifact'
    | 'getArtifactStatus'
    | 'restartArtifactPreview',
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
    tool_dynamic_type: 'artifact',
    tool_dynamic_input: { artifactId: 'artifact-1' },
    tool_dynamic_output: { id: 'artifact-1', status: 'ready' },
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

  describe('artifact data persistence', () => {
    const artifactData: ArtifactData = {
      id: 'artifact-1',
      title: 'Landing page',
      status: 'ready',
      previewUrl: 'https://preview.example.com',
      revisionId: 'revision-1'
    }

    const artifactStatus: ArtifactStatusData = {
      id: 'artifact-1',
      status: 'building',
      previewUrl: 'https://preview.example.com'
    }

    it('persists data-artifact and data-artifactStatus parts', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          {
            type: 'data-artifact',
            id: 'artifact-part-1',
            data: artifactData
          },
          {
            type: 'data-artifactStatus',
            id: 'artifact-status-part-1',
            data: artifactStatus
          }
        ],
        'msg-1'
      )

      expect(parts).toEqual([
        expect.objectContaining({
          data_prefix: 'artifact',
          data_content: artifactData,
          data_id: 'artifact-part-1'
        }),
        expect.objectContaining({
          data_prefix: 'artifactStatus',
          data_content: artifactStatus,
          data_id: 'artifact-status-part-1'
        })
      ])
    })

    it('does not persist transient artifact log and event parts', () => {
      const parts = mapUIMessagePartsToDBParts(
        [
          {
            type: 'data-artifactLog',
            id: 'artifact-log-1',
            data: {
              artifactId: 'artifact-1',
              message: 'npm run dev started'
            }
          },
          {
            type: 'data-artifactEvent',
            id: 'artifact-event-1',
            data: {
              artifactId: 'artifact-1',
              event: 'preview-ready'
            }
          }
        ],
        'msg-1'
      )

      expect(parts).toHaveLength(0)
    })

    it('round-trips persisted artifact data parts with reconciliation ids', () => {
      expect(
        mapDBPartToUIMessagePart(makeDBArtifactPart('artifact', artifactData))
      ).toEqual({
        type: 'data-artifact',
        id: 'artifact-part-1',
        data: artifactData
      })

      expect(
        mapDBPartToUIMessagePart(
          makeDBArtifactPart('artifactStatus', artifactStatus)
        )
      ).toEqual({
        type: 'data-artifactStatus',
        id: 'artifactStatus-part-1',
        data: artifactStatus
      })
    })
  })

  describe('artifact tool persistence', () => {
    it.each([
      'createWebappArtifact',
      'updateWebappArtifact',
      'getArtifactStatus',
      'restartArtifactPreview'
    ] as const)('maps %s to tool-dynamic with artifact type', toolName => {
      const parts = mapUIMessagePartsToDBParts(
        [makeArtifactToolPart(toolName)],
        'msg-1'
      )

      expect(parts).toHaveLength(1)
      expect(parts[0]).toMatchObject({
        type: 'tool-dynamic',
        tool_toolCallId: `call-${toolName}`,
        tool_state: 'output-available',
        tool_dynamic_name: toolName,
        tool_dynamic_type: 'artifact',
        tool_dynamic_input: { artifactId: 'artifact-1' },
        tool_dynamic_output: { id: 'artifact-1', status: 'ready' }
      })
    })

    it.each([
      'createWebappArtifact',
      'updateWebappArtifact',
      'getArtifactStatus',
      'restartArtifactPreview'
    ] as const)(
      'reconstructs tool-%s from tool-dynamic artifact rows',
      toolName => {
        const uiPart = mapDBPartToUIMessagePart(
          makeDBArtifactToolPart(toolName)
        )

        expect(uiPart).toMatchObject({
          type: `tool-${toolName}`,
          toolCallId: `call-${toolName}`,
          state: 'output-available',
          input: { artifactId: 'artifact-1' },
          output: { id: 'artifact-1', status: 'ready' }
        })
      }
    )
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

  describe('authenticated persistence stores artifact tool calls through tool-dynamic', () => {
    it('createWebappArtifact round-trips with full input/output payload', () => {
      const createInput = {
        title: 'Landing Page',
        description: 'A responsive landing page',
        files: {
          'src/App.tsx':
            'export default function App() { return <div>Hello</div> }',
          'src/styles.css': 'body { margin: 0 }'
        }
      }
      const createOutput = {
        success: true,
        action: 'create',
        title: 'Landing Page',
        description: 'A responsive landing page',
        files: createInput.files
      }

      const uiPart = {
        type: 'tool-createWebappArtifact',
        toolCallId: 'call-create-1',
        state: 'output-available',
        input: createInput,
        output: createOutput
      }

      const [dbPart] = mapUIMessagePartsToDBParts([uiPart], 'msg-1')

      expect(dbPart).toMatchObject({
        type: 'tool-dynamic',
        tool_dynamic_name: 'createWebappArtifact',
        tool_dynamic_type: 'artifact',
        tool_dynamic_input: createInput,
        tool_dynamic_output: createOutput
      })

      // Round-trip back
      const dbSelect = makeDBArtifactToolPart('createWebappArtifact', {
        tool_toolCallId: 'call-create-1',
        tool_dynamic_input: createInput,
        tool_dynamic_output: createOutput
      })

      const restored = mapDBPartToUIMessagePart(dbSelect)

      expect(restored).toMatchObject({
        type: 'tool-createWebappArtifact',
        toolCallId: 'call-create-1',
        input: createInput,
        output: createOutput
      })
    })

    it('updateWebappArtifact round-trips preserving file diffs', () => {
      const updateInput = {
        description: 'Fix header colors',
        files: { 'src/Header.tsx': 'updated header content' }
      }
      const updateOutput = {
        success: true,
        action: 'update',
        description: 'Fix header colors',
        files: updateInput.files
      }

      const uiPart = {
        type: 'tool-updateWebappArtifact',
        toolCallId: 'call-update-1',
        state: 'output-available',
        input: updateInput,
        output: updateOutput
      }

      const [dbPart] = mapUIMessagePartsToDBParts([uiPart], 'msg-1')

      expect(dbPart.tool_dynamic_type).toBe('artifact')
      expect(dbPart.tool_dynamic_name).toBe('updateWebappArtifact')

      const dbSelect = makeDBArtifactToolPart('updateWebappArtifact', {
        tool_toolCallId: 'call-update-1',
        tool_dynamic_input: updateInput,
        tool_dynamic_output: updateOutput
      })

      const restored = mapDBPartToUIMessagePart(dbSelect)
      expect(restored).toMatchObject({
        type: 'tool-updateWebappArtifact',
        input: updateInput,
        output: updateOutput
      })
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

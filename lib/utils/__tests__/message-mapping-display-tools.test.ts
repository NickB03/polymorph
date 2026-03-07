import { describe, expect, it, vi } from 'vitest'

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

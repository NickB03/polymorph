import { describe, expect, it } from 'vitest'

import type { DBMessagePartSelect } from '@/lib/types/message-persistence'

import { buildBackfilledUIMessage } from '../backfill-chat-ui-message'

function makeTextPart(
  overrides: Partial<DBMessagePartSelect> = {}
): DBMessagePartSelect {
  return {
    id: 'part-1',
    messageId: 'msg-1',
    order: 0,
    type: 'text',
    text_text: 'Summary:',
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
    tool_toolCallId: null,
    tool_state: null,
    tool_errorText: null,
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
    tool_dynamic_input: null,
    tool_dynamic_output: null,
    tool_dynamic_name: null,
    tool_dynamic_type: null,
    data_prefix: null,
    data_content: null,
    data_id: null,
    providerMetadata: null,
    createdAt: new Date('2026-04-24T12:00:00.000Z'),
    ...overrides
  } as DBMessagePartSelect
}

function makeDisplayToolPart(
  overrides: Partial<DBMessagePartSelect> = {}
): DBMessagePartSelect {
  return makeTextPart({
    id: 'part-2',
    order: 1,
    type: 'tool-dynamic',
    text_text: null,
    tool_toolCallId: 'call-displayOptionList',
    tool_state: 'output-available',
    tool_dynamic_name: 'displayOptionList',
    tool_dynamic_type: 'display',
    tool_dynamic_input: {
      id: 'choice',
      options: [{ id: 'a', label: 'A' }]
    },
    tool_dynamic_output: 'a',
    ...overrides
  })
}

describe('buildBackfilledUIMessage', () => {
  it('rebuilds legacy text and display tool parts into a canonical UIMessage', () => {
    const createdAt = new Date('2026-04-24T12:00:00.000Z')

    const message = buildBackfilledUIMessage({
      id: 'msg-1',
      role: 'assistant',
      metadata: { traceId: 'trace-1' },
      createdAt,
      parts: [makeTextPart({ text_text: 'Summary:' }), makeDisplayToolPart()]
    })

    expect(message).toMatchObject({
      id: 'msg-1',
      role: 'assistant',
      parts: [
        { type: 'text', text: 'Summary:' },
        {
          type: 'tool-displayOptionList',
          toolCallId: 'call-displayOptionList',
          state: 'output-available',
          input: {
            id: 'choice',
            options: [{ id: 'a', label: 'A' }]
          },
          output: 'a'
        }
      ],
      metadata: {
        traceId: 'trace-1',
        createdAt
      }
    })
  })
})

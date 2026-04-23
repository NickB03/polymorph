import { describe, expect, it } from 'vitest'

import type { UIMessage } from '@/lib/types/ai'

import {
  buildUIMessageFromDB,
  mapUIMessageToDBMessage
} from '../message-mapping'

describe('message mapping canonical UIMessage storage', () => {
  it('stores the canonical uiMessage payload on the message row', () => {
    const message: UIMessage & { chatId: string } = {
      id: 'msg-1',
      chatId: 'chat-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'hello world' }],
      metadata: { modelId: 'gateway:test-model' }
    }

    const mapped = mapUIMessageToDBMessage(message)

    expect(mapped).toMatchObject({
      id: 'msg-1',
      chatId: 'chat-1',
      role: 'assistant',
      uiMessage: {
        id: 'msg-1',
        role: 'assistant',
        parts: [{ type: 'text', text: 'hello world' }]
      }
    })
  })

  it('prefers canonical uiMessage payload when rebuilding messages from storage', () => {
    const rebuilt = buildUIMessageFromDB(
      {
        id: 'msg-1',
        role: 'assistant',
        uiMessage: {
          id: 'msg-1',
          role: 'assistant',
          parts: [{ type: 'text', text: 'canonical payload' }],
          metadata: { modelId: 'gateway:model-a' }
        },
        metadata: { traceId: 'trace-1' },
        createdAt: '2026-04-23T12:00:00.000Z'
      },
      [
        {
          id: 'part-1',
          messageId: 'msg-1',
          order: 0,
          type: 'text',
          text_text: 'legacy part payload',
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
          createdAt: new Date('2026-04-23T12:00:00.000Z')
        }
      ]
    )

    expect(rebuilt.parts).toEqual([{ type: 'text', text: 'canonical payload' }])
    expect(rebuilt.metadata).toMatchObject({
      modelId: 'gateway:model-a',
      traceId: 'trace-1'
    })
  })
})

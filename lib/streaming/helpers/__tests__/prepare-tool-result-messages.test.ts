import { beforeEach, describe, expect, it, vi } from 'vitest'

import { upsertMessage } from '@/lib/actions/chat'
import { loadChatWithMessages } from '@/lib/db/actions'
import type { Chat } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'

import {
  prepareToolResultMessages,
  ToolResultValidationError
} from '../prepare-tool-result-messages'
import type { StreamContext } from '../types'

vi.mock('@/lib/actions/chat')
vi.mock('@/lib/db/actions')

function makeContext(
  overrides: Partial<StreamContext> & {
    initialChat: StreamContext['initialChat']
  }
): StreamContext {
  return {
    chatId: 'chat-1',
    userId: 'user-1',
    modelId: 'gpt-4',
    trigger: 'tool-result',
    isNewChat: false,
    ...overrides
  }
}

function makeChat(messages: UIMessage[]): Chat & { messages: UIMessage[] } {
  return {
    id: 'chat-1',
    title: 'Test',
    userId: 'user-1',
    visibility: 'private' as const,
    createdAt: new Date(),
    messages
  }
}

const TOOL_CALL_ID = 'tc-abc123'

describe('prepareToolResultMessages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('normal flow', () => {
    it('should apply tool result to matching interactive part', async () => {
      const assistantMessage: UIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Here are some options' },
          {
            type: 'tool-displayOptionList',
            toolCallId: TOOL_CALL_ID,
            state: 'input-available',
            args: {}
          } as never
        ]
      }

      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Show me options' }]
        },
        assistantMessage
      ])

      vi.mocked(upsertMessage).mockResolvedValue({
        id: 'msg-2',
        chatId: 'chat-1',
        role: 'assistant',
        metadata: {},
        uiMessage: null,
        createdAt: new Date(),
        updatedAt: new Date()
      })

      const result = await prepareToolResultMessages(
        makeContext({ initialChat: chat }),
        { toolCallId: TOOL_CALL_ID, output: { selected: 'option-1' } }
      )

      expect(result).toHaveLength(2)
      const updatedPart = result[1].parts[1] as Record<string, unknown>
      expect(updatedPart.state).toBe('output-available')
      expect(updatedPart.output).toEqual({ selected: 'option-1' })
      expect(upsertMessage).toHaveBeenCalledOnce()
    })
  })

  describe('idempotent duplicate handling', () => {
    it('should return existing messages when state is already output-available', async () => {
      const assistantMessage: UIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          { type: 'text', text: 'Here are some options' },
          {
            type: 'tool-displayOptionList',
            toolCallId: TOOL_CALL_ID,
            state: 'output-available',
            output: { selected: 'option-1' }
          } as never
        ]
      }

      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Show me options' }]
        },
        assistantMessage
      ])

      const result = await prepareToolResultMessages(
        makeContext({ initialChat: chat }),
        { toolCallId: TOOL_CALL_ID, output: { selected: 'option-1' } }
      )

      // Should return messages unchanged — no DB write
      expect(result).toHaveLength(2)
      expect(upsertMessage).not.toHaveBeenCalled()
    })
  })

  describe('invalid state transitions', () => {
    it('should throw for output-error state', async () => {
      const assistantMessage: UIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-displayOptionList',
            toolCallId: TOOL_CALL_ID,
            state: 'output-error',
            error: 'something went wrong'
          } as never
        ]
      }

      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Show me options' }]
        },
        assistantMessage
      ])

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: {}
        })
      ).rejects.toThrow(ToolResultValidationError)

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: {}
        })
      ).rejects.toThrow(/not awaiting input.*output-error/)
    })

    it('should throw for input-streaming state', async () => {
      const assistantMessage: UIMessage = {
        id: 'msg-2',
        role: 'assistant',
        parts: [
          {
            type: 'tool-displayOptionList',
            toolCallId: TOOL_CALL_ID,
            state: 'input-streaming'
          } as never
        ]
      }

      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Show me options' }]
        },
        assistantMessage
      ])

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: {}
        })
      ).rejects.toThrow(/not awaiting input.*input-streaming/)
    })
  })

  describe('validation errors', () => {
    it('should throw when chat has no messages', async () => {
      const chat = makeChat([])

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: {}
        })
      ).rejects.toThrow('Chat not found or has no messages')
    })

    it('should throw when last message is not assistant', async () => {
      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        }
      ])

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: {}
        })
      ).rejects.toThrow('Last message is not an assistant message')
    })

    it('should throw when toolCallId is not found (after DB retry)', async () => {
      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [{ type: 'text', text: 'Answer' }]
        }
      ])

      vi.mocked(loadChatWithMessages).mockResolvedValue(chat)

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: 'nonexistent-id',
          output: {}
        })
      ).rejects.toThrow(/No tool part found.*after DB retry/)
    })

    it('should throw when matched part is not interactive', async () => {
      const chat = makeChat([
        {
          id: 'msg-1',
          role: 'user',
          parts: [{ type: 'text', text: 'Hello' }]
        },
        {
          id: 'msg-2',
          role: 'assistant',
          parts: [
            {
              type: 'tool-invocation',
              toolCallId: TOOL_CALL_ID,
              toolName: 'search',
              state: 'result',
              result: {}
            } as never
          ]
        }
      ])

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: {}
        })
      ).rejects.toThrow('is not an interactive tool')
    })
  })
})

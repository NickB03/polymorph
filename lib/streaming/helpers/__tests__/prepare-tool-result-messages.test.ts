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

function makeInteractiveToolChat(part: Record<string, unknown>) {
  return makeChat([
    { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Pick' }] },
    {
      id: 'msg-2',
      role: 'assistant',
      parts: [part as never]
    }
  ])
}

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
            input: {
              id: 'theme',
              options: [
                { id: 'dark', label: 'Dark' },
                { id: 'light', label: 'Light' }
              ]
            }
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
        { toolCallId: TOOL_CALL_ID, output: 'dark' }
      )

      expect(result).toHaveLength(2)
      const updatedPart = result[1].parts[1] as Record<string, unknown>
      expect(updatedPart.state).toBe('output-available')
      expect(updatedPart.output).toBe('dark')
      expect(upsertMessage).toHaveBeenCalledOnce()
    })

    it('should apply valid displayQuestionWizard result to matching interactive part', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayQuestionWizard',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'style',
              title: 'Style',
              options: [{ id: 'minimal', label: 'Minimal' }],
              selectionMode: 'single'
            },
            {
              id: 'tone',
              title: 'Tone',
              options: [{ id: 'friendly', label: 'Friendly' }],
              selectionMode: 'single'
            }
          ]
        }
      })

      const result = await prepareToolResultMessages(
        makeContext({ initialChat: chat }),
        {
          toolCallId: TOOL_CALL_ID,
          output: { style: 'minimal', tone: 'friendly' }
        }
      )

      const updatedPart = result[1].parts[0] as Record<string, unknown>
      expect(updatedPart.state).toBe('output-available')
      expect(updatedPart.output).toEqual({
        style: 'minimal',
        tone: 'friendly'
      })
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
            input: {
              id: 'theme',
              options: [
                { id: 'dark', label: 'Dark' },
                { id: 'light', label: 'Light' }
              ]
            },
            output: 'dark'
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
        { toolCallId: TOOL_CALL_ID, output: 'dark' }
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
            input: {
              id: 'theme',
              options: [{ id: 'dark', label: 'Dark' }]
            },
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
          output: 'dark'
        })
      ).rejects.toThrow(ToolResultValidationError)

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: 'dark'
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
            state: 'input-streaming',
            input: {
              id: 'theme',
              options: [{ id: 'dark', label: 'Dark' }]
            }
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
          output: 'dark'
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

    it('rejects invalid displayOptionList output before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayOptionList',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'theme',
          options: [
            { id: 'dark', label: 'Dark' },
            { id: 'light', label: 'Light' }
          ]
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: { value: 'dark' }
        })
      ).rejects.toThrow(/Invalid output for displayOptionList/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects displayOptionList output with an unknown option id before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayOptionList',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'theme',
          options: [
            { id: 'dark', label: 'Dark' },
            { id: 'light', label: 'Light' }
          ],
          selectionMode: 'single'
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: 'neon'
        })
      ).rejects.toThrow(/Invalid output for displayOptionList/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects displayOptionList output below minSelections before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayOptionList',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'features',
          options: [
            { id: 'chat', label: 'Chat' },
            { id: 'search', label: 'Search' }
          ],
          selectionMode: 'multi',
          minSelections: 2
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: ['chat']
        })
      ).rejects.toThrow(/Invalid output for displayOptionList/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects displayOptionList output above maxSelections before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayOptionList',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'features',
          options: [
            { id: 'chat', label: 'Chat' },
            { id: 'search', label: 'Search' }
          ],
          selectionMode: 'multi',
          maxSelections: 1
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: ['chat', 'search']
        })
      ).rejects.toThrow(/Invalid output for displayOptionList/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects invalid displayQuestionWizard output before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayQuestionWizard',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'style',
              title: 'Style',
              options: [{ id: 'minimal', label: 'Minimal' }]
            },
            {
              id: 'density',
              title: 'Density',
              options: [{ id: 'compact', label: 'Compact' }]
            }
          ]
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: { style: 42 }
        })
      ).rejects.toThrow(/Invalid output for displayQuestionWizard/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects displayQuestionWizard output missing a required step before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayQuestionWizard',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'style',
              title: 'Style',
              options: [{ id: 'minimal', label: 'Minimal' }],
              selectionMode: 'single'
            },
            {
              id: 'tone',
              title: 'Tone',
              options: [{ id: 'friendly', label: 'Friendly' }],
              selectionMode: 'single'
            }
          ]
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: { style: 'minimal' }
        })
      ).rejects.toThrow(/Invalid output for displayQuestionWizard/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects displayQuestionWizard output with an unknown option id before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayQuestionWizard',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'style',
              title: 'Style',
              options: [{ id: 'minimal', label: 'Minimal' }],
              selectionMode: 'single'
            },
            {
              id: 'tone',
              title: 'Tone',
              options: [{ id: 'friendly', label: 'Friendly' }],
              selectionMode: 'single'
            }
          ]
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: { style: 'minimal', tone: 'formal' }
        })
      ).rejects.toThrow(/Invalid output for displayQuestionWizard/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })

    it('rejects displayQuestionWizard output with step min/max violations before persistence', async () => {
      const chat = makeInteractiveToolChat({
        type: 'tool-displayQuestionWizard',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'features',
              title: 'Features',
              options: [
                { id: 'chat', label: 'Chat' },
                { id: 'search', label: 'Search' },
                { id: 'canvas', label: 'Canvas' }
              ],
              selectionMode: 'multi',
              minSelections: 2,
              maxSelections: 2
            },
            {
              id: 'tone',
              title: 'Tone',
              options: [{ id: 'friendly', label: 'Friendly' }],
              selectionMode: 'single'
            }
          ]
        }
      })

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: { features: ['chat'], tone: 'friendly' }
        })
      ).rejects.toThrow(/Invalid output for displayQuestionWizard/)

      await expect(
        prepareToolResultMessages(makeContext({ initialChat: chat }), {
          toolCallId: TOOL_CALL_ID,
          output: { features: ['chat', 'search', 'canvas'], tone: 'friendly' }
        })
      ).rejects.toThrow(/Invalid output for displayQuestionWizard/)

      expect(upsertMessage).not.toHaveBeenCalled()
    })
  })
})

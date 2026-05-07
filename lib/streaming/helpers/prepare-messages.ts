import {
  createChat,
  createChatWithFirstMessage,
  deleteMessagesFromIndex,
  loadChat,
  upsertMessage
} from '@/lib/actions/chat'
import { DEFAULT_CHAT_TITLE } from '@/lib/constants'
import { generateId } from '@/lib/db/schema'
import type { UIMessage } from '@/lib/types/ai'
import { isInteractiveToolPart } from '@/lib/types/dynamic-tools'
import { perfLog, perfTime } from '@/lib/utils/perf-logging'

import { hasNativeInteractiveToolOutput } from './native-tool-output-continuation'
import type { StreamContext } from './types'

type SerializableRecord = Record<string, unknown>
type ToolOutputPart = {
  state?: string
  output?: unknown
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(canonicalize)
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as SerializableRecord)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, entry]) => [key, canonicalize(entry)])
    )
  }
  return value
}

function isEqualSerializable(left: unknown, right: unknown): boolean {
  return (
    JSON.stringify(canonicalize(left)) === JSON.stringify(canonicalize(right))
  )
}

function removeToolOutputFields(part: unknown) {
  const {
    state: _state,
    output: _output,
    errorText: _errorText,
    ...rest
  } = part as SerializableRecord
  return rest
}

function hasPersistedInteractiveToolOutput(parts: UIMessage['parts']) {
  return parts?.some(
    part =>
      isInteractiveToolPart(part) &&
      (part as ToolOutputPart).state === 'output-available' &&
      'output' in (part as ToolOutputPart)
  )
}

async function prepareNativeInteractiveToolOutputMessages(
  context: StreamContext,
  requestMessages: UIMessage[]
): Promise<UIMessage[]> {
  const { chatId, userId, initialChat } = context
  const requestedAssistant = requestMessages[requestMessages.length - 1]
  const persistedAssistant = initialChat?.messages.at(-1)

  if (!initialChat || !persistedAssistant) {
    throw new Error('Chat not found or has no messages')
  }

  if (
    requestedAssistant.role !== 'assistant' ||
    persistedAssistant.role !== 'assistant' ||
    requestedAssistant.id !== persistedAssistant.id
  ) {
    throw new Error(
      'Tool output continuations must update the latest assistant message'
    )
  }

  if (
    !Array.isArray(requestedAssistant.parts) ||
    !Array.isArray(persistedAssistant.parts) ||
    requestedAssistant.parts.length !== persistedAssistant.parts.length
  ) {
    throw new Error(
      'Tool output continuation changed the assistant message shape'
    )
  }

  let changedPartIndex = -1

  for (let index = 0; index < requestedAssistant.parts.length; index++) {
    const requestedPart = requestedAssistant.parts[index]
    const persistedPart = persistedAssistant.parts[index]

    if (isEqualSerializable(requestedPart, persistedPart)) {
      continue
    }

    if (changedPartIndex !== -1) {
      throw new Error(
        'Only one interactive tool output may be submitted at a time'
      )
    }

    changedPartIndex = index

    if (!isInteractiveToolPart(persistedPart)) {
      throw new Error('Updated tool part is not an interactive tool')
    }

    if (!isInteractiveToolPart(requestedPart)) {
      throw new Error(
        'Updated tool output must keep the original tool part type'
      )
    }

    const toolCallId = persistedPart.toolCallId
    const persistedState = (persistedPart as { state?: string }).state
    const requestedState = (requestedPart as { state?: string }).state

    if (persistedState !== 'input-available') {
      throw new Error(
        `Tool part with toolCallId ${toolCallId} is not awaiting input (state: ${persistedState})`
      )
    }

    if (requestedState !== 'output-available' || !('output' in requestedPart)) {
      throw new Error(
        `Tool part with toolCallId ${toolCallId} must submit output-available output`
      )
    }

    if (
      !isEqualSerializable(
        removeToolOutputFields(requestedPart),
        removeToolOutputFields(persistedPart)
      )
    ) {
      throw new Error(
        `Tool part with toolCallId ${toolCallId} changed fields other than output`
      )
    }
  }

  if (changedPartIndex === -1) {
    if (hasPersistedInteractiveToolOutput(persistedAssistant.parts)) {
      perfLog(
        'prepareMessages - native tool output already persisted; returning existing messages'
      )
      return initialChat.messages
    }

    throw new Error('No interactive tool output update found')
  }

  const mergedAssistant: UIMessage = {
    ...persistedAssistant,
    parts: requestedAssistant.parts
  }

  await upsertMessage(chatId, mergedAssistant, userId)
  return [...initialChat.messages.slice(0, -1), mergedAssistant]
}

export async function prepareMessages(
  context: StreamContext,
  requestMessages?: UIMessage[]
): Promise<UIMessage[]> {
  const { chatId, userId, trigger, messageId, initialChat, isNewChat } = context
  const startTime = performance.now()
  perfLog(`prepareMessages - Start: trigger=${trigger}, isNewChat=${isNewChat}`)

  if (trigger === 'regenerate-message' && messageId) {
    // Handle regeneration - use initialChat if available to avoid DB call
    let currentChat = initialChat
    if (!currentChat) {
      currentChat = await loadChat(chatId, userId)
    }
    if (!currentChat || !currentChat.messages.length) {
      throw new Error('No messages found')
    }

    const messageIndex = currentChat.messages.findIndex(m => m.id === messageId)

    if (messageIndex === -1) {
      throw new Error(`Message ${messageId} not found`)
    }

    const targetMessage = currentChat.messages[messageIndex]
    if (targetMessage.role === 'assistant') {
      await deleteMessagesFromIndex(chatId, messageId, userId)
      // Reload chat to get the updated message list after deletion
      const updatedChat = await loadChat(chatId, userId)
      return (
        updatedChat?.messages || currentChat.messages.slice(0, messageIndex)
      )
    } else {
      // User message edit
      const editedMessage = requestMessages?.find(
        entry => entry.id === messageId && entry.role === 'user'
      )
      if (editedMessage) {
        await upsertMessage(chatId, editedMessage, userId)
      }
      const messagesToDelete = currentChat.messages.slice(messageIndex + 1)
      if (messagesToDelete.length > 0) {
        await deleteMessagesFromIndex(chatId, messagesToDelete[0].id, userId)
      }
      const updatedChat = await loadChat(chatId, userId)
      return (
        updatedChat?.messages || currentChat.messages.slice(0, messageIndex + 1)
      )
    }
  } else {
    if (requestMessages && requestMessages.length > 0) {
      const normalizedMessages = requestMessages.map((entry, index) => {
        if (entry.id) return entry
        return {
          ...entry,
          id: generateId()
        }
      })

      const lastMessage = normalizedMessages[normalizedMessages.length - 1]

      if (!lastMessage) {
        throw new Error('No messages provided')
      }

      if (lastMessage.role === 'assistant') {
        if (hasNativeInteractiveToolOutput(normalizedMessages)) {
          const toolOutputStart = performance.now()
          const toolOutputMessages =
            await prepareNativeInteractiveToolOutputMessages(
              context,
              normalizedMessages
            )
          perfTime(
            'prepareMessages - Total (native tool output)',
            toolOutputStart
          )
          return toolOutputMessages
        }

        throw new Error(
          'Existing chat submissions must end with a user message before streaming'
        )
      }

      if (isNewChat) {
        if (lastMessage.role !== 'user') {
          throw new Error(
            'New chat submissions must end with a user message before streaming'
          )
        }

        const createStart = performance.now()
        const persistencePromise = createChatWithFirstMessage(
          chatId,
          lastMessage,
          userId,
          DEFAULT_CHAT_TITLE
        )
          .then(result => {
            perfTime('createChatWithFirstMessage completed', createStart)
            perfTime('prepareMessages - Total', startTime)
            return result
          })
          .catch(error => {
            console.error('Error creating chat with first message:', error)
            throw error
          })

        context.pendingInitialSave = persistencePromise
        context.pendingInitialUserMessage = lastMessage

        perfTime('prepareMessages - Total (using client messages)', startTime)
        return normalizedMessages
      }

      if (lastMessage.role !== 'user') {
        throw new Error(
          'Existing chat submissions must end with a user message before streaming'
        )
      }

      if (!initialChat) {
        const createStart = performance.now()
        await createChat(chatId, DEFAULT_CHAT_TITLE, userId)
        perfTime('createChat completed', createStart)
      }

      const persistableLastMessage = {
        ...lastMessage,
        id: lastMessage.id || generateId()
      }

      const upsertStart = performance.now()
      await upsertMessage(chatId, persistableLastMessage, userId)
      perfTime('upsertMessage completed', upsertStart)

      if (initialChat && initialChat.messages) {
        perfTime('prepareMessages - Total (using cached chat)', startTime)
        return [...initialChat.messages, persistableLastMessage]
      }

      const loadStart = performance.now()
      const updatedChat = await loadChat(chatId, userId)
      perfTime('loadChat (fallback) completed', loadStart)
      perfTime('prepareMessages - Total', startTime)
      return updatedChat?.messages || [persistableLastMessage]
    }

    throw new Error('messages are required')
  }
}

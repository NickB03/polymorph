import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  pruneMessages,
  smoothStream,
  UIMessage,
  UIMessageStreamWriter
} from 'ai'
import { randomUUID } from 'crypto'
import { Langfuse } from 'langfuse'

import { researcher } from '@/lib/agents/researcher'
import { DEFAULT_CHAT_TITLE } from '@/lib/constants'
import { createModelId } from '@/lib/utils'
import { isTracingEnabled } from '@/lib/utils/telemetry'

import { loadChat } from '../actions/chat'
import { generateChatTitle } from '../agents/title-generator'
import { maybeTruncateMessages } from '../utils/context-window'
import { getTextFromParts } from '../utils/message-utils'
import { perfLog, perfTime } from '../utils/perf-logging'

import { persistStreamResults } from './helpers/persist-stream-results'
import { prepareMessages } from './helpers/prepare-messages'
import {
  prepareToolResultMessages,
  ToolResultValidationError
} from './helpers/prepare-tool-result-messages'
import { streamRelatedQuestions } from './helpers/stream-related-questions'
import { stripReasoningParts } from './helpers/strip-reasoning-parts'
import type { StreamContext } from './helpers/types'
import { BaseStreamConfig } from './types'

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const {
    message,
    toolResult,
    model,
    chatId,
    userId,
    trigger,
    messageId,
    abortSignal,
    isNewChat,
    searchMode,
    modelType
  } = config

  // Verify that chatId is provided
  if (!chatId) {
    return new Response('Chat ID is required', {
      status: 400,
      statusText: 'Bad Request'
    })
  }

  // Skip loading chat for new chats optimization
  let initialChat = null
  if (!isNewChat) {
    const loadChatStart = performance.now()
    // Fetch chat data for authorization check and cache it
    initialChat = await loadChat(chatId, userId)
    perfTime('loadChat completed', loadChatStart)

    // Authorization check: if chat exists, it must belong to the user
    if (initialChat && initialChat.userId !== userId) {
      return new Response('You are not allowed to access this chat', {
        status: 403,
        statusText: 'Forbidden'
      })
    }
  } else {
    perfLog('loadChat skipped for new chat')
  }

  // Create parent trace ID for grouping all operations
  let parentTraceId: string | undefined
  let langfuse: Langfuse | undefined

  if (isTracingEnabled()) {
    parentTraceId = randomUUID()
    langfuse = new Langfuse()

    // Create parent trace with name "research"
    langfuse.trace({
      id: parentTraceId,
      name: 'research',
      metadata: {
        chatId,
        userId,
        modelId: createModelId(model),
        trigger
      }
    })
  }

  // Create stream context with trace ID
  const context: StreamContext = {
    chatId,
    userId,
    modelId: createModelId(model),
    messageId,
    trigger,
    initialChat,
    abortSignal,
    parentTraceId, // Add parent trace ID to context
    isNewChat
  }

  // Declare titlePromise in outer scope for onFinish access
  let titlePromise: Promise<string> | undefined

  // For tool-result continuations, prepare messages before creating the stream
  // so we can pass originalMessages to createUIMessageStream. This ensures the
  // server reuses the existing assistant message ID in the stream's start chunk,
  // preventing the client SDK from pushing a duplicate message.
  let prefetchedMessages: UIMessage[] | undefined
  if (toolResult) {
    try {
      const prepareStart = performance.now()
      perfLog('prepareToolResultMessages - Invoked')
      prefetchedMessages = await prepareToolResultMessages(context, toolResult)
      perfTime('prepareToolResultMessages completed (pre-stream)', prepareStart)
    } catch (error) {
      if (error instanceof ToolResultValidationError) {
        return new Response(error.message, {
          status: 400,
          statusText: 'Bad Request'
        })
      }
      throw error
    }
  }

  // Create the stream
  const stream = createUIMessageStream<UIMessage>({
    ...(prefetchedMessages ? { originalMessages: prefetchedMessages } : {}),
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      try {
        // Prepare messages for the model
        const prepareStart = performance.now()
        let messagesToModel: UIMessage[]
        if (prefetchedMessages) {
          messagesToModel = prefetchedMessages
          perfLog('prepareMessages - Using prefetched messages for tool-result')
        } else {
          perfLog(
            `prepareMessages - Invoked: trigger=${trigger}, isNewChat=${isNewChat}`
          )
          messagesToModel = await prepareMessages(context, message)
        }
        perfTime('prepareMessages completed (stream)', prepareStart)

        // Get the researcher agent with parent trace ID, search mode, and model type
        const researchAgent = researcher({
          model: context.modelId,
          modelConfig: model,
          writer,
          parentTraceId,
          searchMode,
          modelType
        })

        // For OpenAI models, strip reasoning parts from UIMessages before conversion
        // OpenAI's Responses API requires reasoning items and their following items to be kept together
        // See: https://github.com/vercel/ai/issues/11036
        const isOpenAI = context.modelId.startsWith('openai:')
        const messagesToConvert = isOpenAI
          ? stripReasoningParts(messagesToModel)
          : messagesToModel

        // Convert to model messages and apply context window management
        let modelMessages = await convertToModelMessages(messagesToConvert)

        // Prune messages to reduce token usage while keeping recent context
        modelMessages = pruneMessages({
          messages: modelMessages,
          reasoning: 'before-last-message',
          toolCalls: 'before-last-2-messages',
          emptyMessages: 'remove'
        })

        const preTruncationCount = modelMessages.length
        modelMessages = maybeTruncateMessages(modelMessages, model)

        if (
          process.env.NODE_ENV === 'development' &&
          modelMessages.length < preTruncationCount
        ) {
          console.log(
            `Context window limit reached. Truncating from ${preTruncationCount} to ${modelMessages.length} messages`
          )
        }

        // Start title generation in parallel if it's a new chat
        if (!initialChat && message) {
          const userContent = getTextFromParts(message.parts)
          titlePromise = generateChatTitle({
            userMessageContent: userContent,
            modelId: context.modelId,
            abortSignal,
            parentTraceId
          }).catch(error => {
            console.error('Error generating title:', error)
            return DEFAULT_CHAT_TITLE
          })
        }

        const llmStart = performance.now()
        perfLog(
          `researchAgent.stream - Start: model=${context.modelId}, searchMode=${searchMode}`
        )
        const result = await researchAgent.stream({
          messages: modelMessages,
          abortSignal,
          experimental_transform: smoothStream({ chunking: 'word' })
        })
        result.consumeStream()
        // Stream with the research agent, including metadata
        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) => {
              // Send metadata when streaming starts
              if (part.type === 'start') {
                return {
                  traceId: parentTraceId,
                  searchMode,
                  modelId: context.modelId
                }
              }
            }
          })
        )

        const responseMessages = (await result.response).messages
        perfTime('researchAgent.stream completed', llmStart)

        // Check if response ends with a pending interactive tool (e.g. displayOptionList)
        // that is waiting for user input — skip related questions in that case
        const hasPendingInteractiveTool = (() => {
          if (!responseMessages || responseMessages.length === 0) return false
          const lastMsg = responseMessages[responseMessages.length - 1]
          if (
            lastMsg.role !== 'assistant' ||
            typeof lastMsg.content === 'string'
          )
            return false
          const toolCalls = lastMsg.content.filter(p => p.type === 'tool-call')
          if (toolCalls.length === 0) return false
          // Collect all tool-result IDs from subsequent tool messages
          const resolvedIds = new Set(
            responseMessages
              .filter(m => m.role === 'tool')
              .flatMap(m =>
                m.content
                  .filter(p => p.type === 'tool-result')
                  .map(p => p.toolCallId)
              )
          )
          // If any tool call has no result, the agent stopped for user input
          return toolCalls.some(tc => !resolvedIds.has(tc.toolCallId))
        })()

        // Generate related questions (skip for tool-result continuations and pending interactive tools)
        if (
          trigger !== 'tool-result' &&
          !hasPendingInteractiveTool &&
          responseMessages &&
          responseMessages.length > 0
        ) {
          // Find the last user message
          const lastUserMessage = [...modelMessages]
            .reverse()
            .find(msg => msg.role === 'user')
          const messagesForQuestions = lastUserMessage
            ? [lastUserMessage, ...responseMessages]
            : responseMessages

          await streamRelatedQuestions(
            writer,
            messagesForQuestions,
            abortSignal,
            parentTraceId
          )
        }
      } catch (error) {
        console.error('Stream execution error:', error)
        throw error // This error will be handled by the onError callback
      } finally {
        // Flush Langfuse traces if enabled
        if (langfuse) {
          await langfuse.flushAsync()
        }
      }
    },
    onError: (error: unknown) => {
      // console.error('Stream error:', error)
      return error instanceof Error ? error.message : String(error)
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage) return

      // Persist stream results to database
      await persistStreamResults(
        responseMessage,
        chatId,
        userId,
        titlePromise,
        parentTraceId,
        searchMode,
        context.modelId,
        context.pendingInitialSave,
        context.pendingInitialUserMessage
      )
    }
  })

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream
  })
}

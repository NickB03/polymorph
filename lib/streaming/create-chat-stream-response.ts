import {
  consumeStream,
  convertToModelMessages,
  createUIMessageStream,
  createUIMessageStreamResponse,
  pruneMessages,
  smoothStream,
  UIMessageStreamWriter
} from 'ai'
import { randomUUID } from 'crypto'

import { createChatValidationContract } from '@/lib/agents/chat/message-contract'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import { DEFAULT_CHAT_TITLE } from '@/lib/constants'
import { loadCanvasArtifactByChatId } from '@/lib/db/actions'
import type { UIMessage } from '@/lib/types/ai'
import { createModelId } from '@/lib/utils'
import { getErrorMessage } from '@/lib/utils/error'
import { jsonError } from '@/lib/utils/json-error'
import { flushTraces, withOtelRootSpan } from '@/lib/utils/telemetry'

import { loadChat } from '../actions/chat'
import { generateChatTitle } from '../agents/title-generator'
import { loadChatWithMessages } from '../db/actions'
import { maybeTruncateMessages } from '../utils/context-window'
import { getTextFromParts } from '../utils/message-utils'
import { perfLog, perfTime } from '../utils/perf-logging'

import { hasPendingInteractiveTool } from './helpers/has-pending-interactive-tool'
import { inlineFileUrls } from './helpers/inline-file-urls'
import { persistStreamResults } from './helpers/persist-stream-results'
import { prepareMessages } from './helpers/prepare-messages'
import {
  prepareToolResultMessages,
  ToolResultValidationError
} from './helpers/prepare-tool-result-messages'
import { streamRelatedQuestions } from './helpers/stream-related-questions'
import { stripReasoningParts } from './helpers/strip-reasoning-parts'
import type { StreamContext } from './helpers/types'
import { createCanvasEmitter } from './helpers/write-canvas-data'
import { BaseStreamConfig } from './types'

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const {
    message,
    messages: requestMessages,
    toolResult,
    model,
    chatId,
    userId,
    trigger,
    messageId,
    abortSignal,
    isNewChat,
    searchMode,
    userMode,
    intent,
    modelType,
    agentFactory
  } = config

  // Verify that chatId is provided
  if (!chatId) {
    return jsonError('BAD_REQUEST', 'Chat ID is required', 400)
  }

  // Skip loading chat for new chats optimization
  let initialChat = null
  if (!isNewChat) {
    const loadChatStart = performance.now()
    if (toolResult) {
      // Tool-result continuations bypass the unstable_cache layer to avoid a
      // race where a premature revalidateTag re-fetches stale data before
      // onFinish has persisted the latest assistant message.
      initialChat = await loadChatWithMessages(chatId, userId)
      perfTime(
        'loadChatWithMessages (direct DB, tool-result) completed',
        loadChatStart
      )
    } else {
      initialChat = await loadChat(chatId, userId)
      perfTime('loadChat (cached) completed', loadChatStart)
    }

    // Authorization check: if chat exists, it must belong to the user
    if (initialChat && initialChat.userId !== userId) {
      return jsonError(
        'FORBIDDEN',
        'You are not allowed to access this chat',
        403
      )
    }
  } else {
    perfLog('loadChat skipped for new chat')
  }

  const correlationId = randomUUID()
  let otelTraceId: string | undefined

  // Create stream context with correlation ID
  const context: StreamContext = {
    chatId,
    userId,
    modelId: createModelId(model),
    messageId,
    trigger,
    initialChat,
    abortSignal,
    correlationId,
    isNewChat
  }

  const validationContract = createChatValidationContract(context.modelId)

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
      console.log(
        `[tool-result] prepareToolResultMessages: chatId=${chatId}, toolCallId=${toolResult.toolCallId}`
      )
      prefetchedMessages = await prepareToolResultMessages(context, toolResult)
      console.log(
        `[tool-result] prepareToolResultMessages OK: ${prefetchedMessages.length} messages`
      )
      perfTime('prepareToolResultMessages completed (pre-stream)', prepareStart)
    } catch (error) {
      if (error instanceof ToolResultValidationError) {
        console.error(
          `[tool-result] Validation error: chatId=${chatId}, ${error.message}`
        )
        return jsonError('TOOL_ERROR', error.message, 400)
      }
      throw error
    }
  }

  // Create the stream
  const stream = createUIMessageStream<UIMessage>({
    ...(prefetchedMessages || requestMessages
      ? { originalMessages: prefetchedMessages || requestMessages }
      : {}),
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      await withOtelRootSpan(
        {
          name: 'chat-response',
          sessionId: chatId,
          userId,
          metadata: {
            correlationId,
            executionMode: 'chat',
            modelId: context.modelId,
            searchMode,
            userMode,
            intent,
            modelType
          }
        },
        async activeTrace => {
          otelTraceId = activeTrace.otelTraceId
          try {
            // Prepare messages for the model
            const prepareStart = performance.now()
            let messagesToModel: UIMessage[]
            if (prefetchedMessages) {
              messagesToModel = prefetchedMessages
              perfLog(
                'prepareMessages - Using prefetched messages for tool-result'
              )
            } else {
              perfLog(
                `prepareMessages - Invoked: trigger=${trigger}, isNewChat=${isNewChat}`
              )
              messagesToModel = await prepareMessages(
                context,
                message,
                requestMessages
              )
            }
            perfTime('prepareMessages completed (stream)', prepareStart)

            const validatedMessages =
              await validationContract.validate(messagesToModel)

            // Build canvas tool context: load current artifact if one exists.
            // Wrap in try/catch so a DB failure (e.g. missing table, permission
            // denied) degrades gracefully instead of crashing the entire stream.
            // On failure, leave canvasToolContext undefined so canvas tools are
            // not registered — avoids misleading the model into the wrong tool flow.
            let canvasToolContext: CanvasToolContext | undefined
            try {
              const canvasArtifact = await loadCanvasArtifactByChatId(
                chatId,
                userId
              )
              const emitter = createCanvasEmitter(writer)
              canvasToolContext = {
                chatId,
                userId,
                isGuest: false,
                emitter,
                ...(canvasArtifact
                  ? {
                      currentArtifact: {
                        artifactId: canvasArtifact.id,
                        draftRevision: canvasArtifact.draftRevision
                      }
                    }
                  : {})
              }
            } catch (err) {
              console.error(
                '[createChatStreamResponse] Failed to load canvas artifact context; canvas tools will not be registered:',
                err
              )
            }

            const chatAgent = agentFactory({
              modelId: context.modelId,
              writer,
              correlationId,
              otelTraceId,
              parentTraceId: correlationId,
              canvasToolContext,
              imageToolContext: { userId, chatId }
            })

            // For OpenAI models, strip reasoning parts from UIMessages before conversion
            // OpenAI's Responses API requires reasoning items and their following items to be kept together
            // See: https://github.com/vercel/ai/issues/11036
            const isOpenAI = context.modelId.startsWith('openai:')
            const messagesToConvert = isOpenAI
              ? stripReasoningParts(validatedMessages)
              : validatedMessages

            // Convert to model messages and apply context window management
            let modelMessages = await convertToModelMessages(messagesToConvert)

            // Prune messages to reduce token usage while keeping recent context
            modelMessages = pruneMessages({
              messages: modelMessages,
              reasoning: 'before-last-message',
              toolCalls: 'before-last-2-messages',
              emptyMessages: 'remove'
            })

            // Inline any HTTPS file URLs as binary data so the model receives
            // image content directly instead of URLs it cannot fetch.
            modelMessages = await inlineFileUrls(modelMessages)

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
            const lastUserMessageForTitle = [...validatedMessages]
              .reverse()
              .find(entry => entry.role === 'user')

            if (!initialChat && lastUserMessageForTitle) {
              const userContent = getTextFromParts(
                lastUserMessageForTitle.parts
              )
              titlePromise = generateChatTitle({
                userMessageContent: userContent,
                modelId: context.modelId,
                abortSignal,
                correlationId
              }).catch(error => {
                console.error('Error generating title:', error)
                return DEFAULT_CHAT_TITLE
              })
            }

            const llmStart = performance.now()
            if (toolResult) {
              console.log(
                `[tool-result] chatAgent.stream: chatId=${chatId}, model=${context.modelId}, ${modelMessages.length} model messages`
              )
            }
            perfLog(
              `chatAgent.stream - Start: model=${context.modelId}, searchMode=${searchMode}`
            )
            const result = await chatAgent.stream({
              messages: modelMessages,
              abortSignal,
              experimental_transform: smoothStream({ chunking: 'word' })
            })
            // Stream with the research agent, including metadata.
            // NOTE: Do NOT call result.consumeStream() here — writer.merge()
            // already consumes the stream via toUIMessageStream(), making an
            // additional consumeStream() call redundant.
            writer.merge(
              result.toUIMessageStream({
                messageMetadata: ({ part }) => {
                  // Send metadata when streaming starts
                  if (part.type === 'start') {
                    return {
                      correlationId,
                      ...(otelTraceId ? { otelTraceId } : {}),
                      userMode,
                      modelType,
                      modelId: context.modelId
                    }
                  }
                }
              })
            )

            const responseMessages = (await result.response).messages
            perfTime('chatAgent.stream completed', llmStart)

            // Generate related questions (skip for tool-result continuations and pending interactive tools)
            if (
              trigger !== 'tool-result' &&
              !hasPendingInteractiveTool(responseMessages) &&
              responseMessages &&
              responseMessages.length > 0
            ) {
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
                correlationId
              )
            }
          } catch (error) {
            console.error('Stream execution error:', error)
            throw error // This error will be handled by the onError callback
          }
        }
      ) // end withOtelRootSpan
    },
    onError: (error: unknown) => {
      // console.error('Stream error:', error)
      return getErrorMessage(error)
    },
    onFinish: async ({ responseMessage, isAborted }) => {
      if (isAborted || !responseMessage) return

      try {
        // Persist stream results to database
        await persistStreamResults(
          responseMessage,
          chatId,
          userId,
          titlePromise,
          correlationId,
          userMode,
          context.modelId,
          context.pendingInitialSave,
          context.pendingInitialUserMessage,
          modelType,
          otelTraceId
        )
      } catch (error) {
        console.error(
          `[onFinish] Failed to persist stream results for chat ${chatId}:`,
          error
        )
      }

      // Flush OTel spans before the serverless function terminates.
      // Runs after persistence so spans include DB write latency.
      // The 5s timeout (default) is small relative to the 300s maxDuration.
      await flushTraces()
    }
  })

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream
  })
}

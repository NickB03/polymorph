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
import { hasNativeInteractiveToolOutput } from './helpers/native-tool-output-continuation'
import { persistStreamResults } from './helpers/persist-stream-results'
import { prepareMessages } from './helpers/prepare-messages'
import { streamRelatedQuestions } from './helpers/stream-related-questions'
import { stripReasoningParts } from './helpers/strip-reasoning-parts'
import type { StreamContext } from './helpers/types'
import { createCanvasEmitter } from './helpers/write-canvas-data'
import { BaseStreamConfig } from './types'

const NATIVE_TOOL_OUTPUT_RETRY_DELAY_MS = 200

function waitForNativeToolOutputRetry() {
  return new Promise(resolve =>
    setTimeout(resolve, NATIVE_TOOL_OUTPUT_RETRY_DELAY_MS)
  )
}

export async function createChatStreamResponse(
  config: BaseStreamConfig
): Promise<Response> {
  const {
    messages: requestMessages,
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
    if (hasNativeInteractiveToolOutput(requestMessages)) {
      // Native client-side tool outputs bypass the unstable_cache layer to avoid a
      // race where a premature revalidateTag re-fetches stale data before
      // onFinish has persisted the latest assistant message.
      initialChat = await loadChatWithMessages(chatId, userId)
      perfTime(
        'loadChatWithMessages (direct DB, native tool output) completed',
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

  const isNativeToolOutputContinuation =
    hasNativeInteractiveToolOutput(requestMessages)
  let prefetchedMessages: UIMessage[] | undefined

  if (isNativeToolOutputContinuation) {
    try {
      const prepareStart = performance.now()
      prefetchedMessages = await prepareMessages(context, requestMessages)
      perfTime(
        'prepareMessages completed (native tool output pre-stream)',
        prepareStart
      )
    } catch {
      perfLog(
        '[native-tool-output] prepareMessages failed, retrying after direct DB reload'
      )
      await waitForNativeToolOutputRetry()

      try {
        const retryStart = performance.now()
        context.initialChat = await loadChatWithMessages(chatId, userId)
        prefetchedMessages = await prepareMessages(context, requestMessages)
        perfTime(
          'prepareMessages completed after native tool output retry',
          retryStart
        )
      } catch (retryError) {
        const message =
          retryError instanceof Error
            ? retryError.message
            : 'Invalid tool output'
        return jsonError('TOOL_ERROR', message, 400)
      }
    }
  }

  // Create the stream
  const stream = createUIMessageStream<UIMessage>({
    originalMessages: requestMessages,
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
            const messagesToModel =
              prefetchedMessages ??
              (await prepareMessages(context, requestMessages))
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
              canvasToolContext,
              imageToolContext: { userId, chatId }
            })

            // Strip reasoning parts from prior assistant turns before conversion:
            // - OpenAI's Responses API requires reasoning items and their following items to be kept together
            //   (see: https://github.com/vercel/ai/issues/11036)
            // - DeepSeek (via OpenRouter) attaches provider-specific `reasoning_details` metadata that
            //   should not be replayed on the next turn; replaying it risks 400s or silent drops.
            // The current turn's streamed reasoning is unaffected — it flows through writer.merge(),
            // not through messagesToConvert.
            const needsReasoningStrip =
              context.modelId.startsWith('openai:') ||
              context.modelId.startsWith('openrouter:deepseek/')
            const messagesToConvert = needsReasoningStrip
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

            // Generate related questions unless this request is resuming from a
            // client-side interactive tool output or the response is waiting on
            // another interactive tool.
            if (
              !isNativeToolOutputContinuation &&
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

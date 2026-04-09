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

import { researcher } from '@/lib/agents/researcher'
import { verifyGuestCanvasToken } from '@/lib/canvas/guest-token'
import { loadCanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'
import type { UIMessage } from '@/lib/types/ai'
import { createModelId } from '@/lib/utils'
import { jsonError } from '@/lib/utils/json-error'
import {
  flushTraces,
  isTracingEnabled,
  withOtelSession
} from '@/lib/utils/telemetry'

import { maybeTruncateMessages } from '../utils/context-window'

import { hasPendingInteractiveTool } from './helpers/has-pending-interactive-tool'
import { inlineFileUrls } from './helpers/inline-file-urls'
import { streamRelatedQuestions } from './helpers/stream-related-questions'
import { stripReasoningParts } from './helpers/strip-reasoning-parts'
import { createCanvasEmitter } from './helpers/write-canvas-data'
import { BaseStreamConfig } from './types'

type EphemeralStreamConfig = Pick<
  BaseStreamConfig,
  'model' | 'abortSignal' | 'searchMode' | 'modelType' | 'trigger'
> & {
  messages: UIMessage[]
  chatId?: string
  guestCanvasToken?: string
}

export async function createEphemeralChatStreamResponse(
  config: EphemeralStreamConfig
): Promise<Response> {
  const {
    messages,
    model,
    abortSignal,
    searchMode,
    modelType,
    chatId,
    trigger,
    guestCanvasToken
  } = config
  const modelId = createModelId(model)

  if (!messages || messages.length === 0) {
    return jsonError('BAD_REQUEST', 'messages are required', 400)
  }

  // Create parent trace ID for grouping all operations
  const parentTraceId: string | undefined = isTracingEnabled()
    ? randomUUID()
    : undefined

  const stream = createUIMessageStream<UIMessage>({
    // Pass originalMessages so handleUIMessageStreamFinish reuses the
    // assistant message ID on tool-result continuations (prevents duplicate
    // messages on the client when the last message is already assistant).
    originalMessages: messages,
    execute: async ({ writer }: { writer: UIMessageStreamWriter }) => {
      const executeBody = async () => {
        const isOpenAI = modelId.startsWith('openai:')
        const messagesToConvert = isOpenAI
          ? stripReasoningParts(messages)
          : messages

        let modelMessages = await convertToModelMessages(messagesToConvert)

        modelMessages = pruneMessages({
          messages: modelMessages,
          reasoning: 'before-last-message',
          toolCalls: 'before-last-2-messages',
          emptyMessages: 'remove'
        })

        // Inline any HTTPS file URLs as binary data so the model receives
        // image content directly instead of URLs it cannot fetch.
        modelMessages = await inlineFileUrls(modelMessages)

        modelMessages = maybeTruncateMessages(modelMessages, model)

        // Build canvas tool context for guest users
        let canvasToolContext: CanvasToolContext | undefined
        if (chatId) {
          // Verify guest canvas token if provided
          let verifiedToken: Awaited<
            ReturnType<typeof verifyGuestCanvasToken>
          > = null
          if (guestCanvasToken) {
            verifiedToken = await verifyGuestCanvasToken(guestCanvasToken)
          }
          const currentArtifact = verifiedToken
            ? await loadCanvasArtifactState({
                artifactId: verifiedToken.artifactId
              })
            : null

          const emitter = createCanvasEmitter(writer)
          canvasToolContext = {
            chatId,
            userId: 'guest',
            isGuest: true,
            emitter,
            ...(verifiedToken ? { guestCanvasToken } : {}),
            ...(currentArtifact
              ? {
                  currentArtifact: {
                    artifactId: currentArtifact.artifactId,
                    draftRevision: currentArtifact.draftRevision
                  }
                }
              : {})
          }
        }

        const researchAgent = researcher({
          model: modelId,
          modelConfig: model,
          writer,
          parentTraceId,
          searchMode,
          modelType,
          canvasToolContext,
          ...(chatId
            ? {
                imageToolContext: {
                  userId: 'guest',
                  chatId
                }
              }
            : {})
        })

        const result = await researchAgent.stream({
          messages: modelMessages,
          abortSignal,
          experimental_transform: smoothStream({ chunking: 'word' })
        })
        // NOTE: Do NOT call result.consumeStream() here — writer.merge()
        // already consumes the stream via toUIMessageStream(), making an
        // additional consumeStream() call redundant.
        writer.merge(
          result.toUIMessageStream({
            messageMetadata: ({ part }) => {
              if (part.type === 'start') {
                return {
                  traceId: parentTraceId,
                  searchMode,
                  modelType,
                  modelId
                }
              }
            }
          })
        )

        const responseMessages = (await result.response).messages
        if (
          trigger !== 'tool-result' &&
          responseMessages &&
          responseMessages.length > 0 &&
          !hasPendingInteractiveTool(responseMessages)
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
            parentTraceId
          )
        }
      } // end executeBody

      if (chatId) {
        await withOtelSession({ sessionId: chatId }, executeBody)
      } else {
        await executeBody()
      }
    },
    onError: (error: unknown) => {
      return error instanceof Error ? error.message : String(error)
    },
    onFinish: async () => {
      await flushTraces()
    }
  })

  return createUIMessageStreamResponse({
    stream,
    consumeSseStream: consumeStream
  })
}

import { type BaseEvent, EventType, type RunAgentInput } from '@ag-ui/core'
import { EventEncoder } from '@ag-ui/encoder'

import {
  createChatAgentById,
  resolveChatAgentId
} from '@/lib/agents/chat/registry'
import type { UserMode } from '@/lib/types/search'
import { toIntent, toSearchMode } from '@/lib/types/search'
import { createModelId } from '@/lib/utils'
import { getErrorMessage } from '@/lib/utils/error'
import { selectModelForModeAndType } from '@/lib/utils/model-selection'

import {
  aguiMessagesToModelMessages,
  createAguiMapState,
  mapFullStreamPart
} from './adapter'

const VALID_USER_MODES: readonly UserMode[] = ['search', 'research', 'build']

/**
 * Resolve the requested {@link UserMode} from AG-UI `forwardedProps.userMode`,
 * falling back to `search` (lightest agent). External AG-UI clients can opt into
 * the research/build agents by passing `forwardedProps: { userMode: 'research' }`.
 */
function resolveUserMode(forwardedProps: unknown): UserMode {
  if (
    forwardedProps &&
    typeof forwardedProps === 'object' &&
    'userMode' in forwardedProps &&
    VALID_USER_MODES.includes(
      (forwardedProps as { userMode: UserMode }).userMode
    )
  ) {
    return (forwardedProps as { userMode: UserMode }).userMode
  }
  return 'search'
}

/**
 * Run Polymorph's chat agent for an AG-UI `RunAgentInput` and stream the result
 * back as AG-UI protocol events over SSE.
 *
 * This is intentionally stateless: no DB persistence, no canvas/image tool
 * context, no auth-scoped chat history — the AG-UI frontend owns thread state
 * and supplies the full message history on every run.
 */
export function createAguiRunResponse(
  input: RunAgentInput,
  options: { abortSignal?: AbortSignal } = {}
): Response {
  const { threadId, runId } = input
  const userMode = resolveUserMode(input.forwardedProps)
  const searchMode = toSearchMode(userMode)
  const intent = toIntent(userMode)

  const model = selectModelForModeAndType({ searchMode, modelType: 'quality' })
  const modelId = createModelId(model)
  const agentId = resolveChatAgentId({ userMode, searchMode, intent })

  const agent = createChatAgentById(agentId, {
    model: modelId,
    modelConfig: model,
    searchMode,
    userMode,
    intent
  })

  const modelMessages = aguiMessagesToModelMessages(input.messages)

  const encoder = new EventEncoder()
  const textEncoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: BaseEvent) =>
        controller.enqueue(textEncoder.encode(encoder.encodeSSE(event)))

      send({ type: EventType.RUN_STARTED, threadId, runId } as BaseEvent)

      try {
        const result = await agent.stream({
          messages: modelMessages,
          abortSignal: options.abortSignal
        })

        const state = createAguiMapState()
        for await (const part of result.fullStream) {
          for (const event of mapFullStreamPart(part, state)) send(event)
        }

        send({ type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent)
      } catch (error) {
        send({
          type: EventType.RUN_ERROR,
          message: getErrorMessage(error)
        } as BaseEvent)
      } finally {
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': encoder.getContentType(),
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    }
  })
}

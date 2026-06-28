import { type BaseEvent, EventType } from '@ag-ui/core'
import { EventEncoder } from '@ag-ui/encoder'
import type { TextStreamPart, ToolSet } from 'ai'

import { getErrorMessage } from '@/lib/utils/error'

import { createAguiMapState, mapFullStreamPart } from './adapter'

/**
 * A function that starts an agent run and resolves to its AI SDK `fullStream`.
 * Errors thrown here (or while iterating the stream) surface as `RUN_ERROR`.
 */
export type FullStreamFactory = (
  abortSignal?: AbortSignal
) => Promise<AsyncIterable<TextStreamPart<ToolSet>>>

/**
 * Wrap an agent run in the AG-UI lifecycle and stream it as SSE.
 *
 * Emits `RUN_STARTED`, then the mapped per-part events, then `RUN_FINISHED`
 * (or `RUN_ERROR` if starting/iterating the stream throws). Deliberately free
 * of any agent/registry imports so it can be unit-tested with a synthetic
 * `fullStream` without loading the model stack.
 */
export function aguiSseResponse(
  startRun: FullStreamFactory,
  ids: { threadId: string; runId: string },
  options: { abortSignal?: AbortSignal } = {}
): Response {
  const { threadId, runId } = ids
  const encoder = new EventEncoder()
  const textEncoder = new TextEncoder()

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: BaseEvent) =>
        controller.enqueue(textEncoder.encode(encoder.encodeSSE(event)))

      send({ type: EventType.RUN_STARTED, threadId, runId } as BaseEvent)

      try {
        const fullStream = await startRun(options.abortSignal)
        const state = createAguiMapState()
        let terminalError = false
        outer: for await (const part of fullStream) {
          for (const event of mapFullStreamPart(part, state)) {
            send(event)
            // An `error` fullStream part maps to RUN_ERROR, which terminates
            // the run: stop consuming and do not emit RUN_FINISHED.
            if (event.type === EventType.RUN_ERROR) {
              terminalError = true
              break outer
            }
          }
        }

        if (!terminalError) {
          send({ type: EventType.RUN_FINISHED, threadId, runId } as BaseEvent)
        }
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

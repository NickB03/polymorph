import {
  type BaseEvent,
  type CustomEvent,
  EventType,
  type RunErrorEvent,
  type TextMessageContentEvent,
  type TextMessageStartEvent,
  type ToolCallArgsEvent,
  type ToolCallResultEvent,
  type ToolCallStartEvent
} from '@ag-ui/core'

/**
 * Polymorph as an AG-UI *client*: consume an AG-UI SSE event stream produced by
 * any AG-UI-compatible agent and reduce it into a normalized, render-ready
 * result.
 *
 * This is the inverse of {@link import('./sse').aguiSseResponse}: that module
 * turns Polymorph's agent into AG-UI events; this one turns a remote agent's
 * AG-UI events back into structured assistant messages, tool calls, and
 * generative-UI components the Polymorph frontend can render.
 *
 * Deliberately dependency-light — it decodes SSE frames by hand and types the
 * events with `@ag-ui/core` (already a dependency), so it can be unit-tested by
 * piping {@link aguiSseResponse} straight into {@link consumeAguiStream} with no
 * `@ag-ui/client` runtime.
 */

/** A reconstructed tool call, assembled from TOOL_CALL_START/ARGS/END (+ RESULT). */
export type AguiToolCall = {
  toolCallId: string
  name: string
  /** Concatenated TOOL_CALL_ARGS deltas — the raw (usually JSON) input string. */
  args: string
  /** TOOL_CALL_RESULT content, once the result event arrives. */
  result?: string
}

/** A reconstructed assistant message: streamed text plus any tool calls. */
export type AguiAssistantMessage = {
  id: string
  role: 'assistant'
  text: string
  toolCalls: AguiToolCall[]
}

/**
 * A `GenerativeUI` CUSTOM event collected from the stream, carrying enough for
 * the Polymorph frontend to render the matching display component natively.
 */
export type AguiGenerativeUi = {
  component: string
  toolCallId: string
  kind?: string
  props: unknown
}

/** The normalized result of consuming a full AG-UI run. */
export type AguiConsumeResult = {
  status: 'finished' | 'error'
  /** Set when a `RUN_ERROR` terminated the run. */
  error?: string
  messages: AguiAssistantMessage[]
  generativeUI: AguiGenerativeUi[]
}

/**
 * Any source of AG-UI SSE: a `fetch` {@link Response}, a raw byte stream, or an
 * async iterable of SSE text chunks (the chunks need not align to frames).
 */
export type AguiStreamSource =
  | Response
  | ReadableStream<Uint8Array>
  | AsyncIterable<string>

/** Yield decoded SSE text chunks from any supported {@link AguiStreamSource}. */
async function* sourceToTextChunks(
  source: AguiStreamSource
): AsyncIterable<string> {
  const body =
    source instanceof Response ? source.body : (source as ReadableStream | null)

  if (body instanceof ReadableStream) {
    const reader = body.getReader()
    const decoder = new TextDecoder()
    try {
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) yield decoder.decode(value, { stream: true })
      }
      const tail = decoder.decode()
      if (tail) yield tail
    } finally {
      reader.releaseLock()
    }
    return
  }

  yield* source as AsyncIterable<string>
}

/**
 * Parse a buffered SSE stream into AG-UI event objects. Frames are separated by
 * a blank line; only `data:` lines carry the JSON payload (multi-line `data:`
 * fields are joined with newlines per the SSE spec).
 */
async function* decodeAguiEvents(
  source: AguiStreamSource
): AsyncIterable<BaseEvent> {
  let buffer = ''

  function* drain(final: boolean): Generator<BaseEvent> {
    let index: number
    while ((index = buffer.indexOf('\n\n')) !== -1) {
      const frame = buffer.slice(0, index)
      buffer = buffer.slice(index + 2)
      const event = parseFrame(frame)
      if (event) yield event
    }
    if (final && buffer.trim().length > 0) {
      const event = parseFrame(buffer)
      if (event) yield event
      buffer = ''
    }
  }

  for await (const chunk of sourceToTextChunks(source)) {
    buffer += chunk
    yield* drain(false)
  }
  yield* drain(true)
}

/** Parse one SSE frame into an AG-UI event, or `null` if it carries no data. */
function parseFrame(frame: string): BaseEvent | null {
  const data = frame
    .split('\n')
    .map(line => line.replace(/\r$/, ''))
    .filter(line => line.startsWith('data:'))
    .map(line => line.slice('data:'.length).replace(/^ /, ''))
    .join('\n')

  if (data.length === 0) return null
  try {
    return JSON.parse(data) as BaseEvent
  } catch {
    return null
  }
}

/**
 * Consume an AG-UI event stream and reduce it into a normalized result.
 *
 * Accumulates assistant text by `messageId`, assembles each tool call from its
 * START (name) + concatenated ARGS deltas + END and attaches the RESULT content,
 * collects `GenerativeUI` CUSTOM events, and resolves `status` from the terminal
 * `RUN_FINISHED` / `RUN_ERROR` event.
 */
export async function consumeAguiStream(
  source: AguiStreamSource
): Promise<AguiConsumeResult> {
  const messages: AguiAssistantMessage[] = []
  const messagesById = new Map<string, AguiAssistantMessage>()
  const toolCalls = new Map<string, AguiToolCall>()
  const generativeUI: AguiGenerativeUi[] = []

  let status: AguiConsumeResult['status'] = 'error'
  let error: string | undefined

  const messageFor = (id: string): AguiAssistantMessage => {
    let message = messagesById.get(id)
    if (!message) {
      message = { id, role: 'assistant', text: '', toolCalls: [] }
      messagesById.set(id, message)
      messages.push(message)
    }
    return message
  }

  for await (const event of decodeAguiEvents(source)) {
    switch (event.type) {
      case EventType.TEXT_MESSAGE_START:
        messageFor((event as TextMessageStartEvent).messageId)
        break
      case EventType.TEXT_MESSAGE_CONTENT: {
        const content = event as TextMessageContentEvent
        messageFor(content.messageId).text += content.delta
        break
      }

      case EventType.TOOL_CALL_START: {
        const start = event as ToolCallStartEvent
        toolCalls.set(start.toolCallId, {
          toolCallId: start.toolCallId,
          name: start.toolCallName,
          args: ''
        })
        break
      }
      case EventType.TOOL_CALL_ARGS: {
        const argsEvent = event as ToolCallArgsEvent
        const call = toolCalls.get(argsEvent.toolCallId)
        if (call) call.args += argsEvent.delta
        break
      }
      case EventType.TOOL_CALL_RESULT: {
        const result = event as ToolCallResultEvent
        const call = toolCalls.get(result.toolCallId)
        if (call) call.result = result.content
        break
      }

      case EventType.CUSTOM: {
        const custom = event as CustomEvent
        if (custom.name === 'GenerativeUI') {
          const value = (custom.value ?? {}) as Partial<AguiGenerativeUi>
          generativeUI.push({
            component: String(value.component ?? ''),
            toolCallId: String(value.toolCallId ?? ''),
            kind: value.kind,
            props: value.props
          })
        }
        break
      }

      case EventType.RUN_FINISHED:
        status = 'finished'
        break
      case EventType.RUN_ERROR:
        status = 'error'
        error = (event as RunErrorEvent).message
        break

      // TOOL_CALL_END, TEXT_MESSAGE_END, lifecycle/step events carry no state
      // we need to reduce here.
      default:
        break
    }
  }

  // Attach assembled tool calls to their owning assistant message. AG-UI tool
  // calls aren't tagged with a parent messageId, so attach to the most recent
  // assistant message (the one the model was emitting when it called the tool),
  // falling back to a synthetic message if the stream was tool-calls-only.
  if (toolCalls.size > 0) {
    let host = messages.at(-1)
    if (!host) {
      host = { id: 'assistant', role: 'assistant', text: '', toolCalls: [] }
      messages.push(host)
    }
    host.toolCalls.push(...toolCalls.values())
  }

  return { status, error, messages, generativeUI }
}

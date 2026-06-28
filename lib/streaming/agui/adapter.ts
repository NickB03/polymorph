import { type BaseEvent, EventType, type RunAgentInput } from '@ag-ui/core'
import {
  generateId,
  type ModelMessage,
  type TextStreamPart,
  type ToolSet
} from 'ai'

/**
 * Pure translation layer between Polymorph's agent (Vercel AI SDK) and the
 * AG-UI protocol (https://docs.ag-ui.com).
 *
 * Two directions:
 *  - {@link aguiMessagesToModelMessages}: AG-UI `RunAgentInput.messages` → AI SDK `ModelMessage[]`
 *  - {@link mapFullStreamPart}: AI SDK `fullStream` parts → AG-UI events
 *
 * Lifecycle events (`RUN_STARTED` / `RUN_FINISHED` / `RUN_ERROR`) are owned by
 * the response builder; this module maps the inner text/tool/step stream.
 */

/** Mutable state threaded across {@link mapFullStreamPart} calls for one run. */
export type AguiMapState = {
  /** Tool call ids for which a TOOL_CALL_START was already emitted (streamed input). */
  startedToolCalls: Set<string>
}

export function createAguiMapState(): AguiMapState {
  return { startedToolCalls: new Set() }
}

/**
 * Map AG-UI input messages to AI SDK model messages.
 *
 * Only `system` / `user` / `assistant` text turns are forwarded — these are
 * what an AG-UI frontend supplies as conversation history. `tool` / `activity` /
 * `reasoning` turns are agent-internal and intentionally dropped (the agent
 * re-runs its own tool loop), and assistant tool calls are not replayed.
 */
export function aguiMessagesToModelMessages(
  messages: RunAgentInput['messages']
): ModelMessage[] {
  const result: ModelMessage[] = []

  for (const message of messages) {
    // AG-UI assistant content may be string | InputContent[]; only forward
    // plain-text turns. system/user content is already string-typed.
    const content = message.content
    if (typeof content !== 'string' || content.length === 0) continue

    if (message.role === 'system' || message.role === 'developer') {
      result.push({ role: 'system', content })
    } else if (message.role === 'user') {
      result.push({ role: 'user', content })
    } else if (message.role === 'assistant') {
      result.push({ role: 'assistant', content })
    }
  }

  return result
}

function safeStringify(value: unknown): string {
  if (typeof value === 'string') return value
  // Errors JSON-serialize to '{}', losing the message — surface it directly.
  if (value instanceof Error) return value.message
  try {
    return JSON.stringify(value) ?? ''
  } catch {
    return String(value)
  }
}

/**
 * Translate a single AI SDK `fullStream` part into zero or more AG-UI events.
 *
 * Tool input streaming (`tool-input-start`/`-delta`/`-end`) maps to
 * `TOOL_CALL_START`/`ARGS`/`END`. When a model emits a tool call without
 * streaming its input (no prior `tool-input-start`), the assembled `tool-call`
 * part is expanded into START + ARGS + END so AG-UI consumers always see a
 * complete tool-call lifecycle.
 */
export function mapFullStreamPart(
  part: TextStreamPart<ToolSet>,
  state: AguiMapState
): BaseEvent[] {
  switch (part.type) {
    case 'text-start':
      return [
        {
          type: EventType.TEXT_MESSAGE_START,
          messageId: part.id,
          role: 'assistant'
        } as BaseEvent
      ]
    case 'text-delta':
      return [
        {
          type: EventType.TEXT_MESSAGE_CONTENT,
          messageId: part.id,
          delta: part.text
        } as BaseEvent
      ]
    case 'text-end':
      return [
        { type: EventType.TEXT_MESSAGE_END, messageId: part.id } as BaseEvent
      ]

    case 'tool-input-start':
      state.startedToolCalls.add(part.id)
      return [
        {
          type: EventType.TOOL_CALL_START,
          toolCallId: part.id,
          toolCallName: part.toolName
        } as BaseEvent
      ]
    case 'tool-input-delta':
      return [
        {
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: part.id,
          delta: part.delta
        } as BaseEvent
      ]
    case 'tool-input-end':
      return [
        { type: EventType.TOOL_CALL_END, toolCallId: part.id } as BaseEvent
      ]

    case 'tool-call': {
      // Already surfaced via streamed tool-input-* events.
      if (state.startedToolCalls.has(part.toolCallId)) return []
      state.startedToolCalls.add(part.toolCallId)
      return [
        {
          type: EventType.TOOL_CALL_START,
          toolCallId: part.toolCallId,
          toolCallName: part.toolName
        } as BaseEvent,
        {
          type: EventType.TOOL_CALL_ARGS,
          toolCallId: part.toolCallId,
          delta: safeStringify(part.input)
        } as BaseEvent,
        {
          type: EventType.TOOL_CALL_END,
          toolCallId: part.toolCallId
        } as BaseEvent
      ]
    }

    case 'tool-result':
      return [
        {
          type: EventType.TOOL_CALL_RESULT,
          messageId: generateId(),
          toolCallId: part.toolCallId,
          content: safeStringify(part.output),
          role: 'tool'
        } as BaseEvent
      ]
    case 'tool-error':
      return [
        {
          type: EventType.TOOL_CALL_RESULT,
          messageId: generateId(),
          toolCallId: part.toolCallId,
          content: safeStringify(part.error),
          role: 'tool'
        } as BaseEvent
      ]

    case 'start-step':
      return [{ type: EventType.STEP_STARTED, stepName: 'step' } as BaseEvent]
    case 'finish-step':
      return [{ type: EventType.STEP_FINISHED, stepName: 'step' } as BaseEvent]

    case 'error':
      return [
        {
          type: EventType.RUN_ERROR,
          message: safeStringify(part.error)
        } as BaseEvent
      ]

    // Lifecycle (start/finish) is owned by the response builder; reasoning,
    // source, file, raw and abort parts have no AG-UI v1 mapping and are dropped.
    default:
      return []
  }
}

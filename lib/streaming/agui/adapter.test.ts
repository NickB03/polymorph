import { EventType, type RunAgentInput } from '@ag-ui/core'
import type { TextStreamPart, ToolSet } from 'ai'
import { describe, expect, it } from 'vitest'

import {
  aguiMessagesToModelMessages,
  createAguiMapState,
  mapFullStreamPart
} from './adapter'

type Part = TextStreamPart<ToolSet>

describe('aguiMessagesToModelMessages', () => {
  it('maps system/user/assistant text turns and drops the rest', () => {
    const messages = [
      { id: '1', role: 'system', content: 'be helpful' },
      { id: '2', role: 'user', content: 'hello' },
      { id: '3', role: 'assistant', content: 'hi there' },
      { id: '4', role: 'tool', toolCallId: 't1', content: '{}' },
      { id: '5', role: 'user', content: 'follow up' }
    ] as unknown as RunAgentInput['messages']

    expect(aguiMessagesToModelMessages(messages)).toEqual([
      { role: 'system', content: 'be helpful' },
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'hi there' },
      { role: 'user', content: 'follow up' }
    ])
  })

  it('skips empty-content turns', () => {
    const messages = [
      { id: '1', role: 'assistant', content: '' },
      { id: '2', role: 'user', content: 'q' }
    ] as unknown as RunAgentInput['messages']

    expect(aguiMessagesToModelMessages(messages)).toEqual([
      { role: 'user', content: 'q' }
    ])
  })
})

describe('mapFullStreamPart', () => {
  it('maps a text message lifecycle', () => {
    const state = createAguiMapState()
    expect(
      mapFullStreamPart({ type: 'text-start', id: 'm1' } as Part, state)
    ).toEqual([
      { type: EventType.TEXT_MESSAGE_START, messageId: 'm1', role: 'assistant' }
    ])
    expect(
      mapFullStreamPart(
        { type: 'text-delta', id: 'm1', text: 'hi' } as Part,
        state
      )
    ).toEqual([
      { type: EventType.TEXT_MESSAGE_CONTENT, messageId: 'm1', delta: 'hi' }
    ])
    expect(
      mapFullStreamPart({ type: 'text-end', id: 'm1' } as Part, state)
    ).toEqual([{ type: EventType.TEXT_MESSAGE_END, messageId: 'm1' }])
  })

  it('maps streamed tool input to START/ARGS/END and dedupes the assembled tool-call', () => {
    const state = createAguiMapState()
    expect(
      mapFullStreamPart(
        { type: 'tool-input-start', id: 'tc1', toolName: 'search' } as Part,
        state
      )
    ).toEqual([
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: 'tc1',
        toolCallName: 'search'
      }
    ])
    expect(
      mapFullStreamPart(
        { type: 'tool-input-delta', id: 'tc1', delta: '{"q"' } as Part,
        state
      )
    ).toEqual([
      { type: EventType.TOOL_CALL_ARGS, toolCallId: 'tc1', delta: '{"q"' }
    ])
    expect(
      mapFullStreamPart({ type: 'tool-input-end', id: 'tc1' } as Part, state)
    ).toEqual([{ type: EventType.TOOL_CALL_END, toolCallId: 'tc1' }])
    // Assembled tool-call for the same id must not re-emit the lifecycle.
    expect(
      mapFullStreamPart(
        {
          type: 'tool-call',
          toolCallId: 'tc1',
          toolName: 'search',
          input: { q: 'x' }
        } as Part,
        state
      )
    ).toEqual([])
  })

  it('expands a non-streamed tool-call into START/ARGS/END', () => {
    const state = createAguiMapState()
    expect(
      mapFullStreamPart(
        {
          type: 'tool-call',
          toolCallId: 'tc2',
          toolName: 'fetch',
          input: { url: 'u' }
        } as Part,
        state
      )
    ).toEqual([
      {
        type: EventType.TOOL_CALL_START,
        toolCallId: 'tc2',
        toolCallName: 'fetch'
      },
      {
        type: EventType.TOOL_CALL_ARGS,
        toolCallId: 'tc2',
        delta: '{"url":"u"}'
      },
      { type: EventType.TOOL_CALL_END, toolCallId: 'tc2' }
    ])
  })

  it('maps tool-result to TOOL_CALL_RESULT with serialized content', () => {
    const state = createAguiMapState()
    const events = mapFullStreamPart(
      {
        type: 'tool-result',
        toolCallId: 'tc1',
        toolName: 'search',
        output: { hits: 3 }
      } as Part,
      state
    )
    expect(events).toHaveLength(1)
    expect(events[0]).toMatchObject({
      type: EventType.TOOL_CALL_RESULT,
      toolCallId: 'tc1',
      content: '{"hits":3}',
      role: 'tool'
    })
    expect(
      (events[0] as unknown as { messageId: string }).messageId
    ).toBeTruthy()
  })

  it('maps steps and errors, and drops lifecycle/unmapped parts', () => {
    const state = createAguiMapState()
    expect(mapFullStreamPart({ type: 'start-step' } as Part, state)).toEqual([
      { type: EventType.STEP_STARTED, stepName: 'step' }
    ])
    expect(mapFullStreamPart({ type: 'finish-step' } as Part, state)).toEqual([
      { type: EventType.STEP_FINISHED, stepName: 'step' }
    ])
    expect(
      mapFullStreamPart(
        { type: 'error', error: new Error('boom') } as Part,
        state
      )
    ).toEqual([{ type: EventType.RUN_ERROR, message: 'boom' }])
    expect(mapFullStreamPart({ type: 'start' } as Part, state)).toEqual([])
    expect(mapFullStreamPart({ type: 'finish' } as Part, state)).toEqual([])
    expect(
      mapFullStreamPart(
        { type: 'reasoning-delta', id: 'r1', text: '...' } as Part,
        state
      )
    ).toEqual([])
  })
})

import { EventType } from '@ag-ui/core'
import type { TextStreamPart, ToolSet } from 'ai'
import { describe, expect, it } from 'vitest'

import { aguiSseResponse } from './sse'

type Part = TextStreamPart<ToolSet>

const IDS = { threadId: 't1', runId: 'r1' }

function fromParts(parts: Part[]): AsyncIterable<Part> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) yield part
    }
  }
}

/** Read an SSE Response body and parse each `data: <json>` frame into an event. */
async function collectEvents(
  response: Response
): Promise<Array<Record<string, unknown>>> {
  const text = await response.text()
  return text
    .split('\n\n')
    .map(frame => frame.trim())
    .filter(frame => frame.startsWith('data:'))
    .map(frame => JSON.parse(frame.slice('data:'.length).trim()))
}

describe('aguiSseResponse', () => {
  it('sets SSE response headers', () => {
    const response = aguiSseResponse(async () => fromParts([]), IDS)
    expect(response.headers.get('Content-Type')).toContain('text/event-stream')
    expect(response.headers.get('Cache-Control')).toContain('no-cache')
  })

  it('wraps a text run in RUN_STARTED … RUN_FINISHED', async () => {
    const parts: Part[] = [
      { type: 'start' } as Part,
      { type: 'start-step' } as Part,
      { type: 'text-start', id: 'm1' } as Part,
      { type: 'text-delta', id: 'm1', text: 'Hello' } as Part,
      { type: 'text-delta', id: 'm1', text: ' world' } as Part,
      { type: 'text-end', id: 'm1' } as Part,
      { type: 'finish-step' } as Part,
      { type: 'finish' } as Part
    ]

    const events = await collectEvents(
      aguiSseResponse(async () => fromParts(parts), IDS)
    )

    expect(events.map(e => e.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.STEP_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.STEP_FINISHED,
      EventType.RUN_FINISHED
    ])
    expect(events[0]).toMatchObject({ threadId: 't1', runId: 'r1' })
    expect(events.at(-1)).toMatchObject({ threadId: 't1', runId: 'r1' })
  })

  it('emits a full tool-call lifecycle in order', async () => {
    const parts: Part[] = [
      { type: 'tool-input-start', id: 'tc1', toolName: 'search' } as Part,
      { type: 'tool-input-delta', id: 'tc1', delta: '{"q":"ag-ui"}' } as Part,
      { type: 'tool-input-end', id: 'tc1' } as Part,
      {
        type: 'tool-call',
        toolCallId: 'tc1',
        toolName: 'search',
        input: { q: 'ag-ui' }
      } as Part,
      {
        type: 'tool-result',
        toolCallId: 'tc1',
        toolName: 'search',
        output: { hits: 2 }
      } as Part
    ]

    const events = await collectEvents(
      aguiSseResponse(async () => fromParts(parts), IDS)
    )

    expect(events.map(e => e.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      // assembled tool-call deduped (no second START/ARGS/END)
      EventType.TOOL_CALL_RESULT,
      EventType.RUN_FINISHED
    ])
    expect(
      events.find(e => e.type === EventType.TOOL_CALL_RESULT)
    ).toMatchObject({
      toolCallId: 'tc1',
      content: '{"hits":2}'
    })
  })

  it('emits RUN_ERROR (and no RUN_FINISHED) when starting the run throws', async () => {
    const events = await collectEvents(
      aguiSseResponse(async () => {
        throw new Error('model exploded')
      }, IDS)
    )

    expect(events.map(e => e.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.RUN_ERROR
    ])
    expect(events[1]).toMatchObject({ message: 'model exploded' })
  })

  it('emits RUN_ERROR when the stream throws mid-iteration', async () => {
    async function* exploding(): AsyncGenerator<Part> {
      yield { type: 'text-start', id: 'm1' } as Part
      yield { type: 'text-delta', id: 'm1', text: 'partial' } as Part
      throw new Error('stream broke')
    }

    const events = await collectEvents(
      aguiSseResponse(async () => exploding(), IDS)
    )

    expect(events.map(e => e.type)).toEqual([
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.RUN_ERROR
    ])
    expect(events.some(e => e.type === EventType.RUN_FINISHED)).toBe(false)
  })
})

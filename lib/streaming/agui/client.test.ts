import type { TextStreamPart, ToolSet } from 'ai'
import { describe, expect, it } from 'vitest'

import { consumeAguiStream } from './client'
import { demoFullStream } from './demo'
import { aguiSseResponse } from './sse'

const IDS = { threadId: 't1', runId: 'r1' }

type Part = TextStreamPart<ToolSet>

function fromParts(parts: Part[]): AsyncIterable<Part> {
  return {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) yield part
    }
  }
}

describe('consumeAguiStream', () => {
  it('round-trips a demo run: text, tool call + result, generative UI, finished', async () => {
    const response = aguiSseResponse(async () => demoFullStream(), IDS)

    const result = await consumeAguiStream(response)

    expect(result.status).toBe('finished')
    expect(result.error).toBeUndefined()

    // Assistant text accumulated across both text-delta parts.
    expect(result.messages).toHaveLength(1)
    const message = result.messages[0]
    expect(message.role).toBe('assistant')
    expect(message.text).toBe(
      'Let me look that up. AG-UI is an open, event-based protocol for ' +
        'agent-user interaction. Here is a plan:'
    )

    // The `search` tool call: name + assembled args + result.
    const search = message.toolCalls.find(call => call.name === 'search')
    expect(search).toBeDefined()
    expect(search?.toolCallId).toBe('call-1')
    expect(JSON.parse(search?.args ?? '')).toEqual({ query: 'AG-UI' })
    expect(JSON.parse(search?.result ?? '')).toEqual({
      results: [{ title: 'AG-UI Protocol', url: 'https://docs.ag-ui.com' }]
    })

    // The `displayPlan` display tool surfaces a GenerativeUI component.
    expect(result.generativeUI).toHaveLength(1)
    const ui = result.generativeUI[0]
    expect(ui).toMatchObject({
      component: 'displayPlan',
      toolCallId: 'call-2',
      kind: 'passive-display'
    })
    expect(ui.props).toMatchObject({
      id: 'plan-learn-agui',
      title: 'Learn AG-UI',
      todos: [
        { id: 'todo-1', label: 'Read the protocol spec', status: 'completed' },
        {
          id: 'todo-2',
          label: 'Wire up the SSE endpoint',
          status: 'in_progress'
        },
        {
          id: 'todo-3',
          label: 'Render generative UI in the frontend',
          status: 'pending'
        }
      ]
    })
  })

  it('reduces an error run to status error with a message and no finished', async () => {
    const parts: Part[] = [
      { type: 'text-start', id: 'm1' } as Part,
      { type: 'text-delta', id: 'm1', text: 'partial' } as Part,
      { type: 'error', error: new Error('stream failed') } as Part,
      // Anything after the error part must not surface.
      { type: 'text-delta', id: 'm1', text: 'should not appear' } as Part
    ]

    const result = await consumeAguiStream(
      aguiSseResponse(async () => fromParts(parts), IDS)
    )

    expect(result.status).toBe('error')
    expect(result.error).toBe('stream failed')
    expect(result.status).not.toBe('finished')
    // The partial text emitted before the error is still reconstructed.
    expect(result.messages[0]?.text).toBe('partial')
  })
})

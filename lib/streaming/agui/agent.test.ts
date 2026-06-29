import { EventType } from '@ag-ui/core'
import type { LanguageModelV3StreamPart } from '@ai-sdk/provider'
import { stepCountIs, tool, ToolLoopAgent } from 'ai'
import { MockLanguageModelV3 } from 'ai/test'
import { describe, expect, it } from 'vitest'
import { z } from 'zod'

import { aguiSseResponse } from './sse'

const IDS = { threadId: 't1', runId: 'r1' }

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

function streamFromParts(parts: LanguageModelV3StreamPart[]) {
  return {
    stream: new ReadableStream<LanguageModelV3StreamPart>({
      start(controller) {
        for (const part of parts) controller.enqueue(part)
        controller.close()
      }
    })
  }
}

const USAGE = {
  inputTokens: {
    total: 1,
    noCache: 1,
    cacheRead: 0,
    cacheWrite: 0
  },
  outputTokens: { total: 1, text: 1, reasoning: 0 }
}

/**
 * AC2: drive a *real* Vercel AI SDK `ToolLoopAgent` backed by a mock model
 * through `aguiSseResponse`, with no API key, and assert the full happy-path
 * AG-UI lifecycle (text + a complete tool call + result).
 */
describe('aguiSseResponse with a real ToolLoopAgent + mock model', () => {
  it('emits the ordered happy-path lifecycle including a tool call and result', async () => {
    let step = 0
    const model = new MockLanguageModelV3({
      doStream: async () => {
        step += 1
        if (step === 1) {
          // First step: the model calls the `search` tool.
          const parts: LanguageModelV3StreamPart[] = [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'm1' },
            { type: 'text-delta', id: 'm1', delta: 'Looking that up.' },
            { type: 'text-end', id: 'm1' },
            {
              type: 'tool-call',
              toolCallId: 'tc1',
              toolName: 'search',
              input: JSON.stringify({ query: 'ag-ui' })
            },
            {
              type: 'finish',
              finishReason: { unified: 'tool-calls', raw: 'tool-calls' },
              usage: USAGE
            }
          ]
          return streamFromParts(parts)
        }
        // Second step: after the tool result, the model answers.
        const parts: LanguageModelV3StreamPart[] = [
          { type: 'stream-start', warnings: [] },
          { type: 'text-start', id: 'm2' },
          { type: 'text-delta', id: 'm2', delta: 'AG-UI is a protocol.' },
          { type: 'text-end', id: 'm2' },
          {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: USAGE
          }
        ]
        return streamFromParts(parts)
      }
    })

    const agent = new ToolLoopAgent({
      model,
      tools: {
        search: tool({
          description: 'Search the web',
          inputSchema: z.object({ query: z.string() }),
          execute: async ({ query }) => ({ hits: 1, query })
        })
      },
      stopWhen: stepCountIs(5)
    })

    const events = await collectEvents(
      aguiSseResponse(async abortSignal => {
        const result = await agent.stream({
          messages: [{ role: 'user', content: 'What is AG-UI?' }],
          abortSignal
        })
        return result.fullStream
      }, IDS)
    )

    const types = events.map(e => e.type)

    // Lifecycle envelope.
    expect(types[0]).toBe(EventType.RUN_STARTED)
    expect(types.at(-1)).toBe(EventType.RUN_FINISHED)
    expect(types).not.toContain(EventType.RUN_ERROR)

    // Required events appear in the expected relative order.
    const order = [
      EventType.RUN_STARTED,
      EventType.TEXT_MESSAGE_START,
      EventType.TEXT_MESSAGE_CONTENT,
      EventType.TEXT_MESSAGE_END,
      EventType.TOOL_CALL_START,
      EventType.TOOL_CALL_ARGS,
      EventType.TOOL_CALL_END,
      EventType.TOOL_CALL_RESULT,
      EventType.RUN_FINISHED
    ]
    let cursor = -1
    for (const expected of order) {
      const at = types.indexOf(expected, cursor + 1)
      expect(at, `expected ${expected} after index ${cursor}`).toBeGreaterThan(
        cursor
      )
      cursor = at
    }

    // The tool call surfaces its name, serialized args, and result.
    expect(
      events.find(e => e.type === EventType.TOOL_CALL_START)
    ).toMatchObject({ toolCallName: 'search' })
    expect(
      events.find(e => e.type === EventType.TOOL_CALL_RESULT)
    ).toMatchObject({ content: expect.stringContaining('"hits":1') })
  })
})

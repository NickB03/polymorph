import type { TextStreamPart, ToolSet } from 'ai'

/**
 * A scripted AI SDK `fullStream` that exercises a complete, realistic AG-UI
 * lifecycle — assistant text, a streamed tool call, and its result — without
 * any model API key or network call.
 *
 * Fed through {@link import('./sse').aguiSseResponse}, it produces the full
 * `RUN_STARTED` → text events → `TOOL_CALL_*` (+ result) → `RUN_FINISHED`
 * sequence. Used by the `AGUI_DEMO` endpoint mode (see `response.ts`) and as a
 * fixture; it deliberately performs no I/O so it is safe in any environment.
 */
export function demoFullStream(): AsyncIterable<TextStreamPart<ToolSet>> {
  type Part = TextStreamPart<ToolSet>
  const parts: Part[] = [
    { type: 'start' } as Part,
    { type: 'start-step' } as Part,
    { type: 'text-start', id: 'msg-1' } as Part,
    {
      type: 'text-delta',
      id: 'msg-1',
      text: 'Let me look that up. '
    } as Part,
    { type: 'tool-input-start', id: 'call-1', toolName: 'search' } as Part,
    { type: 'tool-input-delta', id: 'call-1', delta: '{"query":' } as Part,
    { type: 'tool-input-delta', id: 'call-1', delta: '"AG-UI"}' } as Part,
    { type: 'tool-input-end', id: 'call-1' } as Part,
    {
      type: 'tool-call',
      toolCallId: 'call-1',
      toolName: 'search',
      input: { query: 'AG-UI' }
    } as Part,
    {
      type: 'tool-result',
      toolCallId: 'call-1',
      toolName: 'search',
      output: {
        results: [
          {
            title: 'AG-UI Protocol',
            url: 'https://docs.ag-ui.com'
          }
        ]
      }
    } as Part,
    {
      type: 'text-delta',
      id: 'msg-1',
      text: 'AG-UI is an open, event-based protocol for agent-user interaction.'
    } as Part,
    { type: 'text-end', id: 'msg-1' } as Part,
    { type: 'finish-step' } as Part,
    { type: 'finish' } as Part
  ]

  return {
    async *[Symbol.asyncIterator]() {
      for (const part of parts) yield part
    }
  }
}

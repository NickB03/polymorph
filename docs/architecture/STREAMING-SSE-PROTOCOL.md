# Streaming SSE Protocol

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf documents SSE response headers, event shapes, client consumption, the portable tool boundary, and key files.

## SSE Protocol

### Response Headers

`createUIMessageStreamResponse` returns a `Response` with standard SSE headers:

```
Content-Type: text/event-stream
Cache-Control: no-cache
Connection: keep-alive
```

### Event Format

The Vercel AI SDK's UI message stream protocol sends events in SSE format. Each event is a JSON-encoded object with a `type` field. Key event types include:

| Event Type                  | Description                        | Payload                                                                   |
| --------------------------- | ---------------------------------- | ------------------------------------------------------------------------- |
| `start`                     | Stream begins                      | Metadata: `{ correlationId, otelTraceId?, userMode, modelType, modelId }` |
| `text-delta`                | Incremental text chunk             | `{ textDelta: "word " }`                                                  |
| `tool-call`                 | Agent invokes a tool               | `{ toolCallId, toolName, args }`                                          |
| Tool output                 | Tool execution result              | Tool call ID plus output payload                                          |
| `tool-call-streaming-start` | Tool call begins streaming         | `{ toolCallId, toolName }`                                                |
| `tool-call-delta`           | Streaming tool call argument chunk | `{ toolCallId, argsTextDelta }`                                           |
| `data-relatedQuestions`     | Related questions update           | `{ id, status, questions? }`                                              |
| `finish`                    | Stream complete                    | Final message metadata                                                    |
| `error`                     | Error occurred                     | Error message string                                                      |

### How the Client Consumes the Stream

The React client uses the AI SDK's `useChat` hook (`@ai-sdk/react`) which:

1. Opens an SSE connection to `/api/chat` via `DefaultChatTransport`
2. Parses incoming events and updates the `messages` state reactively
3. Throttles UI updates to every 100ms (`experimental_throttle: 100`) to avoid excessive re-renders during fast streaming
4. Exposes `status` (which can be `'streaming'`, `'awaiting'`, `'ready'`, or `'error'`) for the UI to show loading indicators
5. Fires `onFinish` when the stream completes, dispatching a `chat-history-updated` custom event to refresh the sidebar

The `messages` array is structured as `UIMessage[]` where each message has `parts` (text, tool calls, tool results, reasoning, etc.) that map to the generative UI component tree.

### Portable Tool Boundary

The streaming layer does not special-case `competitorResearch` or other structured specialist tools. `handleChatAgentRoute()` selects an agent factory, the stream helpers call that factory, and the AI SDK emits normal tool parts into the `UIMessage` stream. The Workstream 5 proof in [`lib/agents/chat/__tests__/community-portability.test.ts`](../../lib/agents/chat/__tests__/community-portability.test.ts) covers the downstream adapter chain for one structured specialist: local toolset execution, dedicated Tool UI rendering, and dynamic-part message mapping.

That test is not a substitute for reviewing a future change's diff. It proves the current seams are sufficient for the representative AI SDK `tool({ inputSchema, execute })` pattern; it does not prove that no route, stream helper, or persistence files changed in a separate commit.

---

## Key Files

| File                                                     | Purpose                                                                                |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `app/api/chat/route.ts`                                  | API endpoint; auth, rate limits, model selection, and route-handler delegation         |
| `lib/agents/chat/route-handler.ts`                       | Resolves the chat agent and injects `agentFactory` into auth/guest streams             |
| `lib/agents/chat/registry.ts`                            | Maps `userMode`, `searchMode`, and `intent` to `search`, `research`, or `build` agents |
| `lib/agents/chat/search.ts`                              | Search/chat agent definition and search pacing wrappers                                |
| `lib/agents/chat/research.ts`                            | Research agent definition, research active tools, and `competitorResearch` activation  |
| `lib/agents/chat/build.ts`                               | Build agent definition and artifact-intake prompt wiring                               |
| `lib/streaming/create-chat-stream-response.ts`           | Authenticated stream creation with injected agent factory                              |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Guest/ephemeral stream creation with injected agent factory                            |
| `lib/streaming/helpers/prepare-messages.ts`              | Message history resolution                                                             |
| `lib/streaming/helpers/persist-stream-results.ts`        | Post-stream database persistence                                                       |
| `lib/streaming/helpers/stream-related-questions.ts`      | Related questions streaming                                                            |
| `lib/streaming/helpers/strip-reasoning-parts.ts`         | OpenAI reasoning compatibility                                                         |
| `lib/streaming/helpers/types.ts`                         | `StreamContext` interface                                                              |
| `lib/streaming/types.ts`                                 | `BaseStreamConfig` interface                                                           |
| `lib/agents/chat/registry.ts`                            | Resolves `search`, `research`, and `build` agent IDs                                   |
| `lib/agents/chat/route-handler.ts`                       | Injects selected agent factories into authenticated and guest stream primitives        |
| `lib/agents/title-generator.ts`                          | Parallel title generation                                                              |
| `lib/agents/generate-related-questions.ts`               | Related questions LLM call                                                             |
| `lib/utils/context-window.ts`                            | Token counting and message truncation                                                  |
| `components/chat.tsx`                                    | Client-side `useChat` hook and stream consumption                                      |

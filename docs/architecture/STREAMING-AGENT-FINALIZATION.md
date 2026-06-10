# Streaming Agent Finalization

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf covers message preparation, agent streaming, tool loop execution, related questions, persistence, and response return.

## 7. Message Preparation

Inside `execute`, `prepareMessages(context, messages)` resolves the full conversation history. See [Message Preparation](STREAMING-MESSAGE-PREPARATION.md#message-preparation) for details. The resulting `UIMessage[]` is then:

1. Stripped of reasoning parts (for OpenAI models, to avoid Responses API compatibility issues)
2. Converted to `ModelMessage[]` via `convertToModelMessages`
3. Pruned with `pruneMessages` (removes old reasoning, tool calls, and empty messages)
4. Truncated if the total token count exceeds the model's context window

## 8. Title Generation (Parallel, New Chats Only)

If this is a new chat, `generateChatTitle()` fires immediately and runs concurrently with the main agent stream. It uses the same model to generate a 3-5 word title from the user's first message. The returned promise is stored in `titlePromise` and awaited later in `onFinish`.

## 9. Chat Agent Streaming

The injected `agentFactory` creates a `ToolLoopAgent` through the chat agent registry in `lib/agents/chat/`. Runtime route delegation is owned by:

- `lib/agents/chat/registry.ts`
- `lib/agents/chat/route-handler.ts`
- `lib/agents/chat/search.ts`
- `lib/agents/chat/research.ts`
- `lib/agents/chat/build.ts`

The selected agent is configured with:

- The selected model
- A system prompt based on the resolved agent (`search`, `research`, or `build`)
- Active tools owned by the agent definition
- A step limit (20 for search/build, 50 for research)
- Telemetry configuration for Phoenix

The agent is invoked with:

```typescript
const agent = agentFactory({ modelId, writer, parentTraceId })
const result = await agent.stream({
  messages: modelMessages,
  abortSignal,
  experimental_transform: smoothStream({ chunking: 'word' })
})
```

The `smoothStream` transform buffers output tokens and re-emits them word-by-word. The agent's output stream is then merged into the main writer:

```typescript
writer.merge(
  result.toUIMessageStream({
    messageMetadata: ({ part }) => {
      if (part.type === 'start') {
        return { correlationId, otelTraceId, userMode, modelType, modelId }
      }
    }
  })
)
```

`writer.merge()` is the sole consumer of the agent result stream. (`result.consumeStream()` must NOT be called — `toUIMessageStream()` already consumes the stream internally, making an additional `consumeStream()` call redundant.) The `messageMetadata` callback attaches request, trace, mode, and model context to the stream's `start` event.

## 10. Tool Loop Execution

During streaming, the `ToolLoopAgent` may invoke tools multiple times. Each tool call and result is streamed to the client in real time. The agent continues calling tools until:

- It produces a final text response without a tool call
- It reaches the step limit (`stepCountIs(maxSteps)`)
- The `AbortSignal` fires

## 11. Related Questions Generation

After the agent stream completes, if there are response messages, `streamRelatedQuestions()` is called. This:

1. Writes a `data-relatedQuestions` event with `status: 'loading'`
2. Calls `createRelatedQuestionsStream()` which uses `streamText` with structured output to generate follow-up questions
3. Streams each question as it arrives with `status: 'streaming'`
4. Writes a final event with `status: 'success'` and all questions

## 12. Stream Finalization (`onFinish`)

For authenticated streams, when the stream closes normally (not aborted), the `onFinish` callback calls `persistStreamResults()` which:

1. Attaches stream metadata (`correlationId`, optional `otelTraceId`, `userMode`, `modelType`, `modelId`) to the response message
2. Awaits the `titlePromise` if it was started
3. Awaits any pending initial chat/message persistence (for new chats)
4. Saves the AI response message to the database with retry logic
5. Updates the chat title if one was generated

## 13. Response Return

`createUIMessageStreamResponse({ stream, consumeSseStream: consumeStream })` wraps the stream in a standard `Response` with SSE headers. Back in the API route, cache tags are revalidated and analytics are tracked (non-blocking).

---

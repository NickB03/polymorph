# Research Agent Streaming and Auxiliary Agents

> **Audience:** Architect | Contributor
> **Prerequisites:** [Research Agent](RESEARCH-AGENT.md)

This leaf covers how the agent output enters the SSE stream and which auxiliary LLM calls run around the main agent.

## Streaming Integration

The agent's output is delivered to the client as Server-Sent Events (SSE). The streaming integration connects the `ToolLoopAgent` to the SSE response.

### Stream Creation

Both authenticated and ephemeral paths follow the same pattern:

```typescript
const stream = createUIMessageStream({
  execute: async ({ writer }) => {
    // 1. Prepare messages
    // 2. Create agent
    const result = await researchAgent.stream({
      messages, abortSignal,
      experimental_transform: smoothStream({ chunking: 'word' })
    })
    // 3. Merge agent output into SSE stream (sole consumer — do not also call consumeStream())
    writer.merge(result.toUIMessageStream({ messageMetadata }))
    // 4. Stream related questions
    await streamRelatedQuestions(writer, responseMessages, abortSignal)
  },
  onFinish: async ({ responseMessage }) => {
    // 5. Persist to database (authenticated only)
    await persistStreamResults(responseMessage, ...)
  }
})
return createUIMessageStreamResponse({ stream })
```

### What Gets Streamed

During the tool loop, every tool call and result is streamed in real time:

| Event                | When                         | Client rendering                   |
| -------------------- | ---------------------------- | ---------------------------------- |
| Tool call start      | Agent decides to call a tool | Loading skeleton appears           |
| Tool input streaming | Input parameters arrive      | Parameters shown (if applicable)   |
| Tool result          | Tool execution completes     | SearchSection, FetchSection, etc.  |
| Text delta           | Agent writes answer text     | Markdown text appears word-by-word |
| Data part            | Related questions arrive     | Follow-up question chips appear    |

### Message Metadata

The stream's `start` event includes metadata used by the client for UI and debugging:

```typescript
messageMetadata: ({ part }) => {
  if (part.type === 'start') {
    return { correlationId, otelTraceId, userMode, modelType, modelId }
  }
}
```

### Abort Handling

The `AbortSignal` from the HTTP request propagates through the entire pipeline. When the client disconnects or the 300-second timeout fires, all in-flight operations are canceled: LLM calls, tool executions, title generation, and related questions.

For more details, see [Streaming Architecture](STREAMING.md).

---

## Auxiliary Agents

Beyond the main research agent, two auxiliary LLM calls run as part of the pipeline.

### Title Generator

**Source:** [`lib/agents/title-generator.ts`](../../lib/agents/title-generator.ts)

Generates a 3-5 word chat title from the user's first message. Runs in parallel with the main agent stream for new chats only.

- Uses `generateText` (non-streaming) with the same model as the research agent
- System prompt: requests 3-5 word titles with no prefixes or quotes
- Fallback chain: empty result -> first 75 chars of user message -> `'New Chat'`
- Abort-safe: catches `AbortError` and `ResponseAborted` gracefully

### Related Questions Generator

**Source:** [`lib/agents/generate-related-questions.ts`](../../lib/agents/generate-related-questions.ts)

Generates 3 concise follow-up questions after the main agent completes. Streams results incrementally.

- Uses `streamText` with `Output.array` for structured output
- Model: configured via `getRelatedQuestionsModel()` (default: DeepSeek V4 Flash)
- Receives the last user message + all response messages as context
- Validated against `relatedQuestionSchema` (Zod)
- Questions must be 10-12 words max, unique angles, in the user's language

---

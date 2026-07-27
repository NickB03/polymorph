# Streaming Operations

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf documents smoothing, parallel side effects, and stream error handling.

## Smooth Streaming

The `smoothStream` transform from the Vercel AI SDK controls how tokens are delivered to the client. It is configured with `{ chunking: 'word' }` in both authenticated and ephemeral streams:

```typescript
experimental_transform: smoothStream({ chunking: 'word' })
```

### What It Does

Without `smoothStream`, the LLM's output arrives in irregular bursts. Some providers send large chunks of text at once, while others trickle tokens one by one. This creates a "jumpy" appearance in the UI.

`smoothStream` buffers incoming tokens and re-emits them at a consistent rate:

- **Word chunking**: Tokens are buffered until a complete word boundary is detected (typically a space or punctuation), then the entire word is emitted. This produces a natural "typing" effect without the jitter of character-by-character streaming.

### Effect on Perceived Latency

- **Time-to-first-token** is slightly increased (tokens are held until a word boundary), but the difference is imperceptible (usually < 100ms).
- **Perceived streaming speed** is significantly improved because the output flows at a steady, readable pace rather than arriving in unpredictable bursts.
- The transform only affects text output; tool call results and metadata events pass through immediately.

---

## Parallel Operations

Several operations run concurrently with the main stream to minimize total response time. None of these block the SSE output to the client.

### Title Generation

**When:** New authenticated chats only (first message in a conversation).

**How:** `generateChatTitle()` is called immediately before the agent stream starts. It runs a lightweight `generateText` call with a system prompt requesting a 3-5 word title. The returned promise (`titlePromise`) is awaited later in `onFinish`, so title generation overlaps with the entire agent execution.

**Fallback:** If title generation fails or is aborted, the first 75 characters of the user's message are used as the title. If even that is empty, `'New Chat'` is used.

### Related Questions Generation

**When:** After the agent stream completes, if there are response messages.

**How:** `streamRelatedQuestions()` uses `streamText` with structured output (`Output.array`) to generate 3 follow-up questions. Each question streams to the client as it is generated, giving the user immediate follow-up options.

**Lifecycle events sent to client:**

1. `{ status: 'loading' }` -- spinner shown
2. `{ status: 'streaming', questions: [...] }` -- questions appear one by one
3. `{ status: 'success', questions: [...] }` -- final state

### Database Persistence

**When:** Authenticated streams only, in the `onFinish` callback (after the stream closes).

**How:** `persistStreamResults()` runs after the response has been fully streamed:

1. Awaits the title promise
2. Awaits any pending initial chat save (for new chats that used the optimistic path)
3. Saves the AI response message with `upsertMessage()` (with retry logic via `retryDatabaseOperation`)
4. Updates the chat title if one was generated

**Resilience:** Database operations use retry logic. If the initial chat creation fails, a fallback re-attempts the operation. Duplicate key errors (from race conditions) are caught and treated as success. Title update failures are logged but do not throw, since title updates are non-critical.

### Analytics Tracking

**When:** After the stream response is created but before it is returned.

**How:** An immediately-invoked async function fires analytics tracking (`trackChatEvent`) without awaiting the result. Failures are caught and logged silently.

---

## Error Handling

### Stream Execution Errors

Errors thrown inside the `execute` callback are caught and passed to the `onError` handler:

```typescript
onError: (error: unknown) => {
  return error instanceof Error ? error.message : String(error)
}
```

The error message is sent to the client as part of the SSE stream, where the `useChat` hook's `onError` callback handles it.

### Timeout Handling

The API route sets `maxDuration = 300` (5 minutes). This is the maximum execution time for the serverless function. If the stream exceeds this limit, the connection is terminated by the runtime. The `AbortSignal` from the request (`req.signal`) is passed through the entire pipeline:

- To the agent's `stream()` call
- To title generation
- To related questions generation

When the signal fires, all in-flight LLM calls and tool executions are canceled.

### Client Disconnection

When the client navigates away or closes the tab, the browser terminates the SSE connection. This triggers the `AbortSignal`, which cascades through:

1. `req.signal` in the API route
2. `abortSignal` in the stream config
3. The agent's streaming call
4. Tool executions (search, fetch)
5. Title and related question generation

The `onFinish` callback skips **persistence** if the stream was aborted or produced no response message, but trace flushing runs unconditionally in a `finally` block — aborted streams' spans still reach Phoenix:

```typescript
onFinish: async ({ responseMessage, isAborted }) => {
  try {
    if (!isAborted && responseMessage) {
      // ... persist
    }
  } finally {
    await flushTraces() // always runs, aborted or not
  }
}
```

Aborts are the traces most worth keeping, and flushing after the persistence attempt means the exported spans include DB write latency.

### Database Persistence Errors

The persistence layer (`persistStreamResults`) is designed to never break the stream:

- Message saves use retry logic (`retryDatabaseOperation`)
- Initial chat creation has a fallback path that handles duplicate key errors
- Title update failures are logged but do not throw
- All persistence happens in `onFinish` (after the stream has already been sent to the client)

### Client-Side Error Handling

The `useChat` hook's `onError` callback in `components/chat.tsx` classifies errors:

| Error Type           | Detection                                                    | UI Response                         |
| -------------------- | ------------------------------------------------------------ | ----------------------------------- |
| Rate limit (429)     | Message contains `429`, `rate limit`, or `too many requests` | Error modal with rate limit message |
| Authentication (401) | Message contains `401` or `unauthorized`                     | Error modal with auth prompt        |
| Forbidden (403)      | Message contains `403` or `forbidden`                        | Error modal                         |
| General errors       | Everything else                                              | Toast notification                  |

---

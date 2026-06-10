# Architecture Streaming Overview

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf summarizes the high-level streaming architecture, parallel post-processing, and authenticated vs guest paths.

## Streaming Architecture

Both authenticated and ephemeral streams follow the same core pattern: create a `UIMessageStream`, run the agent inside it, merge the agent's output stream, and return an SSE response. The authenticated path adds message preparation, persistence, and title generation.

```mermaid
sequenceDiagram
    participant Client as Browser
    participant API as POST /api/chat
    participant Stream as createUIMessageStream
    participant Prep as prepareMessages()
    participant Agent as ToolLoopAgent
    participant Smooth as smoothStream(word)
    participant LLM as AI Provider
    participant Title as Title Generator
    participant Related as Related Questions
    participant DB as PostgreSQL

    Client->>API: HTTP POST (messages, chatId)
    API->>Stream: createUIMessageStream()

    rect rgb(240, 248, 255)
        Note over Stream,Agent: Stream execute callback
        Stream->>Prep: Prepare messages (load chat, handle regen)
        Prep-->>Stream: UIMessage[]
        Stream->>Stream: convertToModelMessages()
        Stream->>Stream: pruneMessages() + truncateMessages()
        Stream->>Agent: createResearcher({model, writer, searchMode})
        Agent->>LLM: agent.stream(messages)

        loop Tool Loop (up to 20/50 steps)
            LLM-->>Agent: Tool call (search/fetch/etc.)
            Agent-->>Stream: yield { state: 'searching' }
            Agent-->>LLM: yield { state: 'complete', results }
        end

        LLM-->>Agent: Final text response
        Agent->>Smooth: Transform chunks
        Smooth-->>Stream: Word-chunked tokens
        Stream->>Stream: writer.merge(toUIMessageStream)
    end

    par Parallel Post-Processing
        Stream->>Title: generateChatTitle() (new chats only)
        Title-->>Stream: Generated title
    and
        Stream->>Related: streamRelatedQuestions()
        Related-->>Stream: data-relatedQuestions parts
        Note over Related: loading -> streaming -> success
    end

    Stream-->>Client: SSE (UIMessageStreamResponse)

    Note over Stream,DB: onFinish callback
    Stream->>DB: persistStreamResults()
    Stream->>DB: updateChatTitle()
```

### Key implementation details

- **Smooth streaming** uses `smoothStream({ chunking: 'word' })` to deliver text token-by-token at word boundaries, avoiding partial-word flicker in the UI.

- **Title generation** runs in parallel with the agent stream for new chats only. It uses a separate LLM call and falls back to `'Untitled'` on error.

- **Related questions** are streamed incrementally as `data-relatedQuestions` parts with status transitions: `loading` -> `streaming` (with incremental question list) -> `success` (final validated list). Uses Zod schema validation via `relatedSchema`.

- **Message preparation** (`prepareMessages`) handles four scenarios:
  1. **New chat**: Creates chat + saves first message optimistically in the background via `context.pendingInitialSave`
  2. **Existing chat**: Loads history and appends the new message
  3. **Native interactive output**: Validates one registered interactive tool part moving from `input-available` to `output-available`
  4. **Regeneration**: Deletes messages from the target index and returns truncated history

- **Context window management**: Before sending to the LLM, messages pass through `pruneMessages` (removes old reasoning and tool calls) and `truncateMessages` (enforces model-specific token limits).

- **OpenAI compatibility**: For OpenAI models, reasoning parts are stripped before conversion to model messages, due to the Responses API requiring reasoning items and following items to be kept together.

- **Persistence** happens in the `onFinish` callback with retry logic via `retryDatabaseOperation`. Metadata (`correlationId`, optional `otelTraceId`, `userMode`, `modelType`, `modelId`) is attached to the response message before saving.

- **Ephemeral streams** (guest mode) skip persistence entirely — no database writes, no title generation, no analytics.

### Two stream paths

| Feature            |  Authenticated  |     Ephemeral (Guest)     |
| ------------------ | :-------------: | :-----------------------: |
| Load chat history  |       Yes       | No (uses passed messages) |
| Save to database   |       Yes       |            No             |
| Generate title     | Yes (new chats) |            No             |
| Related questions  |       Yes       |            Yes            |
| Analytics tracking |       Yes       |            No             |
| Smooth streaming   |       Yes       |            Yes            |
| Context pruning    |       Yes       |            Yes            |

**Source files:** [`lib/streaming/create-chat-stream-response.ts`](../../lib/streaming/create-chat-stream-response.ts), [`lib/streaming/create-ephemeral-chat-stream-response.ts`](../../lib/streaming/create-ephemeral-chat-stream-response.ts), [`lib/streaming/helpers/`](../../lib/streaming/helpers/)

---

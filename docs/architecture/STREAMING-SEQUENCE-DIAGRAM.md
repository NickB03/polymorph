# Streaming Sequence Diagram

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf keeps the full SSE sequence diagram separate from the lifecycle prose.

## Mermaid Diagram

```mermaid
sequenceDiagram
    participant Client as React Client<br/>(useChat hook)
    participant Route as POST /api/chat
    participant Auth as Auth + Rate Limit
    participant ModelSel as Model Selection
    participant Stream as createUIMessageStream
    participant Prepare as prepareMessages
    participant DB as Database<br/>(Drizzle + Supabase)
    participant Agent as ToolLoopAgent
    participant Smooth as smoothStream
    participant LLM as LLM Provider
    participant Tools as Tools<br/>(search, fetch, display)
    participant Title as Title Generator
    participant Related as Related Questions
    participant Persist as persistStreamResults

    Client->>Route: POST /api/chat {messages, chatId, trigger}
    Route->>Auth: getCurrentUserId()
    Auth-->>Route: userId | null

    alt Guest user
        Route->>Auth: checkAndEnforceGuestLimit(ip)
    else Authenticated user
        Route->>Auth: checkAndEnforceOverallChatLimit(userId)
    end

    Route->>ModelSel: selectModel({cookieStore, searchMode})
    ModelSel-->>Route: Model config

    alt Authenticated
        Route->>Stream: createChatStreamResponse(config)
    else Guest
        Route->>Stream: createEphemeralChatStreamResponse(config)
    end

    Note over Stream: execute callback begins

    Stream->>Prepare: prepareMessages(context, messages)

    alt New chat (submit-message)
        Prepare->>DB: createChatWithFirstMessage() [async, non-blocking]
        Prepare-->>Stream: [userMessage]
    else Existing chat (submit-message)
        Prepare->>DB: upsertMessage()
        Prepare-->>Stream: [...history, userMessage]
    else Regenerate
        Prepare->>DB: deleteMessagesFromIndex()
        Prepare-->>Stream: messages up to regeneration point
    end

    Note over Stream: Convert UIMessage -> ModelMessage
    Stream->>Stream: stripReasoningParts (OpenAI only)
    Stream->>Stream: convertToModelMessages
    Stream->>Stream: pruneMessages (reasoning, toolCalls, empty)
    Stream->>Stream: truncateMessages (if over context window)

    opt New chat
        Stream->>Title: generateChatTitle() [parallel, non-blocking]
    end

    Stream->>Agent: agentFactory({modelId, writer, parentTraceId})
    Agent->>LLM: stream({messages, abortSignal, smoothStream})

    loop Tool Loop (max 20 or 50 steps)
        LLM-->>Agent: tool_call (e.g., search)
        Agent->>Tools: execute tool
        Tools-->>Agent: tool result (streaming)
        Agent-->>Smooth: tool result chunks
        Smooth-->>Client: SSE: tool call + tool output events
        Agent->>LLM: continue with tool results
    end

    LLM-->>Agent: final text response
    Agent-->>Smooth: text tokens
    Smooth-->>Client: SSE: text-delta events (word-by-word)

    Note over Stream: Agent stream complete

    Stream->>Related: streamRelatedQuestions(writer, messages)
    Related-->>Client: SSE: data-relatedQuestions {status: loading}
    Related->>LLM: streamText (structured output)
    loop Each question
        LLM-->>Related: question object
        Related-->>Client: SSE: data-relatedQuestions {status: streaming}
    end
    Related-->>Client: SSE: data-relatedQuestions {status: success}

    Note over Stream: execute callback ends

    opt Authenticated stream
        Stream->>Persist: onFinish(responseMessage)
        Persist->>Persist: await titlePromise
        Persist->>DB: upsertMessage (AI response)
        Persist->>DB: updateChatTitle (if generated)
    end

    Stream-->>Client: SSE: stream close

    Note over Client: useChat updates messages state
    Client->>Client: onFinish -> dispatch 'chat-history-updated'
```

---

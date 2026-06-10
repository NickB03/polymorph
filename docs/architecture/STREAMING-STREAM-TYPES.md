# Streaming Stream Types

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf explains why Polymorph streams responses and how authenticated and ephemeral streams differ.

## Overview

Polymorph uses **Server-Sent Events (SSE)** to stream AI responses from the server to the client in real time. Rather than waiting for the entire research agent to finish before returning a response, the system streams partial results incrementally: tool calls appear as they execute, text tokens arrive word-by-word, and related questions stream in after the main answer completes.

This architecture enables:

- **Progressive rendering**: The UI updates as data arrives. Search results, citations, and answer text appear incrementally rather than all at once.
- **Perceived low latency**: `smoothStream` buffers tokens and emits them word-by-word, creating a natural typing effect even when the LLM produces tokens in bursts.
- **Non-blocking side effects**: Title generation, related question generation, and database persistence all run concurrently with or after the main stream, never blocking the user-facing response.
- **Graceful degradation**: If the user navigates away or the connection drops, the `AbortSignal` propagates through the entire pipeline, canceling LLM calls and tool executions.

The streaming infrastructure lives in `lib/streaming/` and is built on top of the [Vercel AI SDK](https://sdk.vercel.ai/docs)'s `createUIMessageStream` and `createUIMessageStreamResponse` primitives.

---

## Stream Types

Two stream creation functions handle the two authentication contexts:

### Authenticated Streams (`create-chat-stream-response.ts`)

Used when a logged-in user sends a message. This is the full-featured path with database persistence, chat ownership verification, and title generation.

**Source:** `lib/streaming/create-chat-stream-response.ts`

Key characteristics:

- Requires `chatId` and `userId`
- Loads existing chat for authorization (skipped for new chats via `isNewChat` optimization)
- Persists user messages and AI responses to the database via `persistStreamResults`
- Generates chat titles in parallel for new conversations
- Creates Phoenix traces for observability when tracing is enabled
- Handles `submit-message` and `regenerate-message` triggers; interactive tool output continues through the native AI SDK `addToolOutput` submit flow

### Ephemeral Streams (`create-ephemeral-chat-stream-response.ts`)

Used for guest/anonymous users when `ENABLE_GUEST_CHAT=true`. This path has no database persistence and reduced configuration.

**Source:** `lib/streaming/create-ephemeral-chat-stream-response.ts`

Key characteristics:

- Accepts full `messages` array from the client (since there is no server-side history)
- No database reads or writes
- No title generation
- `onFinish` flushes pending traces; it does not persist chat messages
- Still supports related question generation and smooth streaming
- Rate-limited by IP via Upstash Redis (enforced in the API route)

### Comparison Table

| Feature                   | Authenticated                     | Ephemeral                      |
| ------------------------- | --------------------------------- | ------------------------------ |
| Database persistence      | Yes (chat, canonical messages)    | No                             |
| Chat ownership check      | Yes (403 if mismatch)             | No                             |
| Title generation          | Yes (parallel, new chats only)    | No                             |
| Related questions         | Yes                               | Yes                            |
| Smooth streaming          | Yes (`word` chunking)             | Yes (`word` chunking)          |
| Phoenix tracing           | Yes (when enabled)                | Yes (when enabled)             |
| Message source            | Server-side history + new message | Full message array from client |
| `onFinish` callback       | `persistStreamResults`            | `flushTraces` only             |
| Rate limiting             | Overall chat limit per user       | IP-based guest limit           |
| OpenAI reasoning strip    | Yes                               | Yes                            |
| Context window management | Yes                               | Yes                            |

---

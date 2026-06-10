# Streaming Request Dispatch

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf covers request parsing, auth, model selection, stream dispatch, and stream creation.

## 1. Client Sends Message

The React `Chat` component (`components/chat.tsx`) uses the AI SDK's `useChat` hook with a `DefaultChatTransport` configured to POST to `/api/chat`. The transport's `prepareSendMessagesRequest` attaches `chatId`, `trigger`, `messageId`, `isNewChat`, and the full `messages` array.

## 2. API Route Receives Request

`app/api/chat/route.ts` (POST handler, `maxDuration = 300` seconds):

1. Parses the request body
2. Validates the AI SDK v6 body (`messages` must be a non-empty array; `messageId` is required for regenerate)
3. Checks if the request originates from a share page (blocked with 403)
4. Authenticates the user via `getCurrentUserId()`
5. Determines guest status and enforces rate limits (`checkAndEnforceGuestLimit` or `checkAndEnforceOverallChatLimit`)

## 3. Model Selection

The route reads `searchMode` and `modelType` from cookies, then calls `selectModel()` to resolve the appropriate model configuration. The selected model is validated against the provider registry.

## 4. Stream Path Dispatch

After authentication, rate limiting, request validation, model selection, and mode normalization, the route delegates to `handleChatAgentRoute()` in `lib/agents/chat/route-handler.ts`. The route handler resolves the chat agent from `userMode`, `searchMode`, and `intent`, then injects an `agentFactory` into the selected stream primitive.

- `createChatStreamResponse(config)` for authenticated users
- `createEphemeralChatStreamResponse(config)` for guests

The stream primitives own persistence, message preparation, tracing metadata, related questions, and SSE mechanics. They do not choose prompts or active tools.

## 5. Authorization and Chat Loading (Authenticated Only)

For existing chats, `loadChat(chatId, userId)` fetches the chat record and verifies ownership. New chats skip this step entirely (the `isNewChat` optimization avoids an unnecessary database round-trip).

## 6. Stream Creation with `createUIMessageStream`

The Vercel AI SDK's `createUIMessageStream` is called with an `execute` callback, an `onError` handler, and (for authenticated streams) an `onFinish` handler. The `execute` callback receives a `writer` (a `UIMessageStreamWriter`) that can emit events to the client.

# Streaming Message Preparation

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming Architecture](STREAMING.md)

This leaf documents how conversation history is prepared for the LLM for submit, regenerate, and interactive tool continuation flows.

## Message Preparation

The `prepareMessages` function (`lib/streaming/helpers/prepare-messages.ts`) resolves the conversation history that will be sent to the LLM. Its behavior depends on the trigger type and whether this is a new or existing chat.

### Submit Message (New Chat)

For new chats (`isNewChat === true`), the function takes an optimistic approach:

1. Assigns an ID to the latest user message if it does not have one
2. Fires `createChatWithFirstMessage()` as a background promise (stored on `context.pendingInitialSave`)
3. Returns `[userMessage]` immediately without waiting for the database write

This optimization means the LLM begins processing before the chat is even persisted, reducing time-to-first-token.

### Submit Message (Existing Chat)

For existing chats:

1. If the chat does not exist in the database yet, creates it with `createChat()`
2. Persists the new user message with `upsertMessage()`
3. Returns the cached `initialChat.messages` with the new message appended (avoiding an extra database read)
4. Falls back to `loadChat()` only if no cached chat data is available

### Regenerate Message

When the user regenerates a response:

1. Loads the chat (uses cached `initialChat` if available)
2. Finds the target message by ID
3. If the target is an assistant message: deletes it and all subsequent messages, returns the remaining history
4. If the target is a user message (edit + regenerate): updates the message content, deletes everything after it, returns the updated history

### Native Interactive Tool Output

Interactive display tools use the AI SDK v6 continuation path: the client calls `addToolOutput`, the SDK updates the assistant `UIMessage` tool part to `output-available`, and the next request arrives as a normal `submit-message` with the updated `messages` array. The server validates that the latest persisted message is the same assistant message and that exactly one registered interactive tool part moved from `input-available` to `output-available`.

### Post-Preparation Processing

After `prepareMessages` returns, the message array goes through several transformations:

1. **Reasoning part stripping** (`stripReasoningParts`): For OpenAI models only. Removes `reasoning` parts from assistant messages to avoid compatibility issues with OpenAI's Responses API, which requires reasoning items to be paired with their following items.

2. **Model message conversion** (`convertToModelMessages`): Transforms `UIMessage[]` (the SDK's UI-facing format with `parts`) into `ModelMessage[]` (the format expected by LLM providers with `content`).

3. **Message pruning** (`pruneMessages`): Removes stale data to reduce token usage:
   - Reasoning: removed from all messages except the last
   - Tool calls: removed from all messages except the last 2
   - Empty messages: removed entirely

4. **Context window truncation** (`truncateMessages`): If the total token count exceeds the model's context window (minus output tokens and a 10% safety buffer), older messages are dropped while preserving the first user message and as many recent messages as possible. Token counting uses `js-tiktoken` with `cl100k_base` encoding.

---

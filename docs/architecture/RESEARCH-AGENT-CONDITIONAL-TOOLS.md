# Research Agent Conditional Tools

> **Audience:** Architect | Contributor
> **Prerequisites:** [Research Agent](RESEARCH-AGENT.md)

This leaf covers request-context tool registration, canonical persisted messages, and dynamic tool part restoration.

### Conditional Tools

Some tools are registered only when the request context provides the capabilities they need. These are not part of the default chat or research tool lists — they are injected on demand at agent-creation time.

- **`generateImage`** (`lib/tools/generate-image/`) — Text-to-image generation via `gateway:google/gemini-2.5-flash-image`. Registered when a `userId` + `chatId` context is available (authenticated and guest flows both supply this). Accepts `prompt`, optional `aspectRatio`, and an optional `sourceImageUrl` for image editing. Uploaded images are persisted to Supabase Storage under `{userId}/chats/{chatId}/generated-{timestamp}.{ext}` via `lib/supabase/server-storage.ts`.
- **`createCanvasArtifact`, `updateCanvasArtifact`, `readCanvasArtifact`** (`lib/tools/*-canvas-artifact/`) — Canvas authoring tools. Registered when a canvas context is present on the request. Enforce one-artifact-per-chat (see `lib/db/schema.ts` — `canvas_artifacts_chat_id_idx` unique index).

### Message Persistence Contract

Chat messages use `messages.ui_message` as the canonical persisted `UIMessage`. The column is non-null in the active schema and load paths throw if that invariant is violated. Migration `0026_enforce_chat_ui_message.sql` aborts when null rows remain, then enforces `NOT NULL`; data cleanup must happen before deployment rather than through an automatic conversion script.

### Dynamic Tool Parts

Runtime-defined tool parts can be displayed in chat through `components/dynamic-tool-display.tsx`, which recognizes AI SDK dynamic tool part states and falls back to JSON input/output rendering when no registered Tool UI renderer matches the tool name. The current chat agent tool roster is still defined by the static catalogs above; there is no active runtime-defined tool factory wired into the chat agents.

---

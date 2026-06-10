# Architecture Key File Reference

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf maps the architecture overview to the primary source files.

## Key File Reference

| File                                                     | Purpose                                                                                                      |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `app/api/chat/route.ts`                                  | Main chat API endpoint (300s timeout, `force-dynamic`)                                                       |
| `lib/agents/chat/factory.ts`                             | Shared `ToolLoopAgent` factory; canvas/image tools registered conditionally by context                       |
| `lib/agents/chat/registry.ts`                            | Agent ID resolution (`resolveChatAgentId`) and dispatch (`createChatAgent`)                                  |
| `lib/agents/chat/{search,research,build}.ts`             | Per-agent definitions: system prompt, active tools, step limit, search-tool wrapping                         |
| `lib/agents/chat/toolset.ts`                             | `ChatAgentTools` type and the `createChatAgentTools()` factory shared by all three agents                    |
| `lib/agents/prompts/search-mode-prompts.ts`              | System prompts for chat/research modes                                                                       |
| `lib/tools/search.ts`                                    | Multi-provider search tool with streaming generator                                                          |
| `lib/tools/fetch.ts`                                     | Web content extraction (regular + API-based)                                                                 |
| `lib/tools/todo.ts`                                      | Session-scoped task tracking with content-based merge                                                        |
| `lib/tools/display-*.ts`                                 | Display tools (plan, table, chart, citations, link preview, option list, question wizard, callout, timeline) |
| `lib/tools/search/providers/`                            | Search provider implementations (tavily, brave, exa, searxng, firecrawl)                                     |
| `lib/streaming/create-chat-stream-response.ts`           | Authenticated chat streaming with persistence                                                                |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Guest/anonymous streaming (stateless)                                                                        |
| `lib/streaming/helpers/persist-stream-results.ts`        | Database persistence with retry logic                                                                        |
| `lib/streaming/helpers/prepare-messages.ts`              | Message preparation (new chat, existing chat, regeneration)                                                  |
| `lib/streaming/helpers/stream-related-questions.ts`      | Related questions streaming with status transitions                                                          |
| `lib/db/schema.ts`                                       | Drizzle schema with RLS policies and check constraints                                                       |
| `lib/supabase/client.ts`                                 | Browser Supabase client                                                                                      |
| `lib/supabase/server.ts`                                 | Server Supabase client (cookies-based)                                                                       |
| `lib/supabase/middleware.ts`                             | Session refresh middleware with 5s timeout                                                                   |
| `lib/utils/model-selection.ts`                           | Model resolution with fallback chain                                                                         |
| `lib/utils/registry.ts`                                  | AI provider registry (6 providers)                                                                           |
| `lib/config/model-types.ts`                              | Config-to-model resolution                                                                                   |
| `config/models/default.json`                             | Default model assignments per mode/type                                                                      |
| `components/chat-messages.tsx`                           | Section-based message rendering with collapse logic                                                          |
| `components/render-message.tsx`                          | Part-type dispatch with buffer-and-flush strategy                                                            |

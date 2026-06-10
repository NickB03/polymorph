# Research Agent Key Files

> **Audience:** Architect | Contributor
> **Prerequisites:** [Research Agent](RESEARCH-AGENT.md)

This leaf maps the research agent architecture to the primary source files.

## Key Files

| File                                                     | Purpose                                                               |
| -------------------------------------------------------- | --------------------------------------------------------------------- |
| `lib/agents/chat/registry.ts`                            | Resolves `search`, `research`, and `build` agent IDs                  |
| `lib/agents/chat/route-handler.ts`                       | Injects selected agent factories into authenticated and guest streams |
| `lib/agents/chat/factory.ts`                             | Shared `ToolLoopAgent` factory for chat agents                        |
| `lib/agents/chat/search.ts`                              | Search/chat agent definition and search pacing wrappers               |
| `lib/agents/chat/research.ts`                            | Research agent definition, active tools, and specialist activation    |
| `lib/agents/chat/build.ts`                               | Build agent definition with artifact-intake prompt wiring             |
| `lib/agents/chat/specialists/competitor-research.ts`     | Live competitor research specialist tool and schemas                  |
| `lib/agents/prompts/search-mode-prompts.ts`              | System prompts for chat and research modes (environment-aware)        |
| `lib/agents/generate-related-questions.ts`               | Follow-up question generation with structured output                  |
| `lib/agents/title-generator.ts`                          | Parallel chat title generation                                        |
| `lib/tools/search.ts`                                    | Multi-provider search tool with streaming and citation mapping        |
| `lib/tools/fetch.ts`                                     | Web content extraction (regular HTML + API-based for PDFs)            |
| `lib/tools/todo.ts`                                      | Session-scoped task tracking with content-based merge                 |
| `lib/tools/tool-ui/metadata.ts`                          | Tool UI manifest metadata for display-tool mode availability          |
| `lib/tools/tool-ui/server-catalog.ts`                    | Server-only catalog exposing manifest display tools to the toolset    |
| `components/tool-ui/renderer-catalog.tsx`                | Client renderer catalog for passive manifest display outputs          |
| `components/tool-ui/interactive-renderer-catalog.tsx`    | Client renderer catalog for interactive display tool parts            |
| `lib/tools/tool-ui/client-output-validation.ts`          | Validates client-resolved interactive outputs before persistence      |
| `lib/tools/display-plan.ts`                              | Step-by-step guide display tool                                       |
| `lib/tools/display-table.ts`                             | Sortable data table display tool                                      |
| `lib/tools/display-chart.ts`                             | Bar and line chart display tool                                       |
| `lib/tools/display-citations/`                           | Rich citation card display tool module                                |
| `lib/tools/display-link-preview/`                        | Featured link preview display tool module                             |
| `lib/tools/display-option-list/`                         | Interactive option list display tool module                           |
| `lib/tools/search/providers/index.ts`                    | Search provider factory and type exports                              |
| `lib/tools/search/providers/base.ts`                     | `SearchProvider` interface and `BaseSearchProvider` abstract class    |
| `lib/tools/search/providers/brave.ts`                    | Brave search provider (default)                                       |
| `lib/tools/search/providers/tavily.ts`                   | Tavily search provider (fallback)                                     |
| `lib/tools/search/providers/exa.ts`                      | Exa semantic search provider                                          |
| `lib/tools/search/providers/searxng.ts`                  | SearXNG meta-search provider (self-hosted)                            |
| `lib/tools/search/providers/firecrawl.ts`                | Firecrawl search provider                                             |
| `lib/streaming/create-chat-stream-response.ts`           | Authenticated stream with persistence and title generation            |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Guest/ephemeral stream (stateless)                                    |
| `lib/utils/model-selection.ts`                           | Model resolution with fallback chain                                  |
| `lib/utils/registry.ts`                                  | AI provider registry (6 providers)                                    |
| `lib/utils/context-window.ts`                            | Token counting and context window truncation                          |
| `lib/utils/search-config.ts`                             | Environment-aware search provider configuration                       |
| `lib/types/ai.ts`                                        | UI message types, tool part types, data part types                    |
| `lib/types/dynamic-tools.ts`                             | Dynamic and interactive tool part types                               |
| `app/api/chat/route.ts`                                  | API endpoint — auth, model selection, stream dispatch                 |
| `config/models/default.json`                             | Default model assignments per mode and type                           |

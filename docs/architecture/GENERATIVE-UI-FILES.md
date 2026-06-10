# Generative UI Key Files

> **Audience:** Architect | Contributor
> **Prerequisites:** [Generative UI](GENERATIVE-UI.md)

This leaf maps the generative UI system to server tools, manifest runtime, components, rendering, canvas, and type files.

## Key File Reference

### Display tools (server)

| File                                | Purpose                                    |
| ----------------------------------- | ------------------------------------------ |
| `lib/tools/display-plan.ts`         | Plan tool definition + schema              |
| `lib/tools/display-table.ts`        | DataTable tool definition + schema         |
| `lib/tools/display-chart.ts`        | Chart tool definition + schema             |
| `lib/tools/display-citations/`      | Citations tool module + result adapter     |
| `lib/tools/display-link-preview/`   | LinkPreview tool module + result adapter   |
| `lib/tools/display-agent-artifact/` | AgentArtifact tool module + result adapter |
| `lib/tools/display-option-list/`    | OptionList tool module (no execute)        |
| `lib/tools/display-callout.ts`      | Callout tool definition + schema           |
| `lib/tools/display-timeline.ts`     | Timeline tool definition + schema          |

### Tool UI manifest runtime

| File                                                  | Purpose                                                                     |
| ----------------------------------------------------- | --------------------------------------------------------------------------- |
| `lib/tools/tool-ui/metadata.ts`                       | Tool UI manifest metadata for tool names, mode availability, and tool kinds |
| `lib/tools/tool-ui/community-sources.ts`              | Community source inventory for npm packages, ports, licenses, and adapters  |
| `lib/tools/tool-ui/server.ts`                         | Helpers for passive passthrough and client-resolved AI SDK display tools    |
| `lib/tools/tool-ui/server-catalog.ts`                 | Server-only catalog mapping manifest display tools to AI SDK server tools   |
| `lib/tools/tool-ui/client-output-validation.ts`       | Validates client-resolved interactive outputs before server persistence     |
| `components/tool-ui/renderer-catalog.tsx`             | Client renderer catalog for manifest display tool outputs                   |
| `components/tool-ui/interactive-renderer-catalog.tsx` | Client renderer catalog for interactive display tool parts                  |

### Tool UI components (client)

| File                                                   | Purpose                                                                     |
| ------------------------------------------------------ | --------------------------------------------------------------------------- |
| `components/tool-ui/registry.tsx`                      | Compatibility facade over renderer catalogs and additional result renderers |
| `components/tool-ui/plan/plan.tsx`                     | Plan component with progress                                                |
| `components/tool-ui/plan/schema.ts`                    | Plan Zod schema + contract                                                  |
| `components/tool-ui/data-table/data-table.tsx`         | DataTable with sort + responsive                                            |
| `components/tool-ui/data-table/schema.ts`              | DataTable Zod schema + contract                                             |
| `components/tool-ui/data-table/formatters.tsx`         | Column value formatting                                                     |
| `components/tool-ui/chart/chart.tsx`                   | Chart component (bar/line)                                                  |
| `components/tool-ui/chart/schema.ts`                   | Chart Zod schema + contract                                                 |
| `components/tool-ui/citation/citation-list.tsx`        | CitationList with variants                                                  |
| `components/tool-ui/citation/schema.ts`                | Citation Zod schema + contract                                              |
| `components/tool-ui/link-preview/link-preview.tsx`     | LinkPreview card                                                            |
| `components/tool-ui/link-preview/schema.ts`            | LinkPreview Zod schema + contract                                           |
| `components/tool-ui/agent-artifact/agent-artifact.tsx` | AgentArtifact viewer with tabs, copy, and metadata                          |
| `components/tool-ui/agent-artifact/schema.ts`          | AgentArtifact Zod schema + contract                                         |
| `components/tool-ui/option-list/option-list.tsx`       | Interactive OptionList                                                      |
| `components/tool-ui/option-list/schema.ts`             | OptionList Zod schema + contract                                            |
| `components/tool-ui/callout/callout.tsx`               | Callout component with variants                                             |
| `components/tool-ui/callout/schema.ts`                 | Callout Zod schema + contract                                               |
| `components/tool-ui/timeline/timeline.tsx`             | Timeline component with events                                              |
| `components/tool-ui/timeline/schema.ts`                | Timeline Zod schema + contract                                              |
| `components/tool-ui/shared/schema.ts`                  | Shared base schemas (id, role, etc.)                                        |
| `components/tool-ui/shared/contract.ts`                | `defineToolUiContract` helper                                               |
| `components/tool-ui/*/_adapter.tsx`                    | Host dependency adapters                                                    |

### Rendering pipeline

| File                                      | Purpose                             |
| ----------------------------------------- | ----------------------------------- |
| `components/render-message.tsx`           | Part-type dispatcher (buffer/flush) |
| `components/dynamic-tool-display.tsx`     | MCP/dynamic tool renderer           |
| `components/answer-section.tsx`           | Answer text with markdown + actions |
| `components/message.tsx`                  | Streaming markdown via Streamdown   |
| `components/research-process-section.tsx` | Collapsible research steps          |
| `components/reasoning-section.tsx`        | Reasoning display with preview      |

### Canvas / Inspector

| File                                       | Purpose                                        |
| ------------------------------------------ | ---------------------------------------------- |
| `components/canvas/canvas-root.tsx`        | Provider + shell wrapper                       |
| `components/canvas/canvas-context.tsx`     | React context for canvas/inspector state       |
| `components/canvas/chat-canvas-shell.tsx`  | Resizable split-pane layout (desktop + mobile) |
| `components/inspector/inspector-panel.tsx` | Panel chrome with icon + close                 |

### Types

| File                         | Purpose                          |
| ---------------------------- | -------------------------------- |
| `lib/types/dynamic-tools.ts` | DynamicToolPart type definitions |

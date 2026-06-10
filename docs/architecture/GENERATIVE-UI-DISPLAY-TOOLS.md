# Generative UI Display Tools

> **Audience:** Architect | Contributor
> **Prerequisites:** [Generative UI](GENERATIVE-UI.md)

This leaf documents server-side display tool modules, passthrough execution, tool definitions, and schema examples.

## Display Tools (Server)

Display tools are defined either as legacy flat shims (`lib/tools/display-*.ts`) or as per-tool modules under `lib/tools/<tool-name>/`. New and migrated high-friction tools use the module shape and are exposed through the manifest catalog in `lib/tools/tool-ui/*`:

```text
lib/tools/<tool-name>/
  schema.ts    Zod input/output contracts and toolName
  server.ts    AI SDK tool() or dynamicTool() export
  client.tsx   optional browser-side resolver for interactive tools
  result.tsx   optional dedicated result renderer
  index.ts     public module contract
```

Server-side agent code imports `serverTool` from `server.ts` so it does not pull client renderers into the agent runtime. `lib/tools/tool-ui/server-catalog.ts` collects those server tools for the chat toolset, while `components/tool-ui/renderer-catalog.tsx` and `components/tool-ui/interactive-renderer-catalog.tsx` own client rendering. The flat files remain compatibility re-exports for older imports.

Display tools do not perform any computation. They serve as a structured output channel for the AI agent. The agent fills in the schema, and the frontend renders it.

### Tool definitions

| Tool                    | File                                 | Description                                                           | Has `execute`? |
| ----------------------- | ------------------------------------ | --------------------------------------------------------------------- | :------------: |
| `displayPlan`           | `lib/tools/display-plan.ts`          | Step-by-step guides with status                                       |      Yes       |
| `displayTable`          | `lib/tools/display-table.ts`         | Sortable data tables with formatting                                  |      Yes       |
| `displayChart`          | `lib/tools/display-chart.ts`         | Bar and line chart visualizations                                     |      Yes       |
| `displayGeoMap`         | `lib/tools/display-geo-map.ts`       | Leaflet-based geo maps with markers, routes, polygons, and clustering |      Yes       |
| `displayCitations`      | `lib/tools/display-citations/`       | Rich source citation lists                                            |      Yes       |
| `displayLinkPreview`    | `lib/tools/display-link-preview/`    | Link preview cards                                                    |      Yes       |
| `displayAgentArtifact`  | `lib/tools/display-agent-artifact/`  | Inline agent artifacts with preview/code/raw tabs                     |      Yes       |
| `displayOptionList`     | `lib/tools/display-option-list/`     | Interactive option lists                                              |       No       |
| `displayQuestionWizard` | `lib/tools/display-question-wizard/` | Multi-step guided question flows                                      |       No       |
| `displayCallout`        | `lib/tools/display-callout.ts`       | Styled callout boxes                                                  |      Yes       |
| `displayTimeline`       | `lib/tools/display-timeline.ts`      | Chronological event timelines                                         |      Yes       |

All tools with `execute` use the same passthrough pattern:

```ts
execute: async params => params
```

**`displayOptionList`** and **`displayQuestionWizard`** are client-resolved tools. They have no `execute` function because the AI sends the tool call input, the module-local `client.tsx` renders the interactive surface, the user responds through the local `submitInteractiveToolOutput` callback, and `components/chat.tsx` bridges that callback to AI SDK `addToolOutput({ tool, toolCallId, output })`.

### Schema example (displayTable)

The table tool defines a rich schema with column formatting options:

```ts
const FormatSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('text') }),
  z.object({ kind: z.literal('number'), decimals: z.number().optional(), ... }),
  z.object({ kind: z.literal('currency'), currency: z.string(), ... }),
  z.object({ kind: z.literal('percent'), ... }),
  z.object({ kind: z.literal('date'), dateFormat: z.enum(['short', 'long', 'relative']).optional() }),
  z.object({ kind: z.literal('delta'), ... }),
  z.object({ kind: z.literal('boolean'), labels: ... }),
  z.object({ kind: z.literal('link'), hrefKey: ... }),
  z.object({ kind: z.literal('badge'), colorMap: ... }),
  z.object({ kind: z.literal('status'), statusMap: ... }),
  z.object({ kind: z.literal('array'), maxVisible: ... })
])
```

This allows the AI to specify exactly how each column should be formatted — currencies, percentages, status badges, links — and the DataTable component renders them accordingly.

**Source files:** [`lib/tools/display-plan.ts`](../../lib/tools/display-plan.ts), [`lib/tools/display-table.ts`](../../lib/tools/display-table.ts), [`lib/tools/display-chart.ts`](../../lib/tools/display-chart.ts), [`lib/tools/display-geo-map.ts`](../../lib/tools/display-geo-map.ts), [`lib/tools/display-citations/`](../../lib/tools/display-citations), [`lib/tools/display-link-preview/`](../../lib/tools/display-link-preview), [`lib/tools/display-agent-artifact/`](../../lib/tools/display-agent-artifact), [`lib/tools/display-option-list/`](../../lib/tools/display-option-list), [`lib/tools/display-question-wizard/`](../../lib/tools/display-question-wizard), [`lib/tools/display-callout.ts`](../../lib/tools/display-callout.ts), [`lib/tools/display-timeline.ts`](../../lib/tools/display-timeline.ts)

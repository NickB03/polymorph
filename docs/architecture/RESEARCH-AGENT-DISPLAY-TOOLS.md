# Research Agent Display Tools

> **Audience:** Architect | Contributor
> **Prerequisites:** [Research Agent](RESEARCH-AGENT.md)

This leaf documents manifest-managed display tools and the interactive Tool UI continuation bridge.

### Display Tools

Display tools are exposed through the Tool UI manifest runtime. `lib/tools/tool-ui/metadata.ts` records each tool's name, kind, and mode availability; `lib/tools/tool-ui/server-catalog.ts` exposes the server tools to the chat toolset; `components/tool-ui/renderer-catalog.tsx` renders passive outputs; and `components/tool-ui/interactive-renderer-catalog.tsx` renders client-resolved interactive parts. Passive display tools accept structured input, validate it with Zod schemas, and return the input as output (`execute: async params => params`). Interactive display tools declare an `outputSchema` and wait for the client to submit user output before the model continues.

| Tool                    | Purpose                                             | Key input fields                                                                                             | Trigger examples                                                            |
| ----------------------- | --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------- |
| `displayPlan`           | Step-by-step guides and how-to checklists           | `id`, `title`, `todos[]` with `id`, `label`, `status`                                                        | "how to deploy to AWS", "steps to learn Python"                             |
| `displayTable`          | Sortable data tables with formatted columns         | `columns[]` with `key`, `label`, `format`, `data[]`                                                          | "compare React vs Vue", "GPU benchmarks"                                    |
| `displayChart`          | Bar and line chart data visualizations              | `id`, `type`, `data[]`, `xKey`, `series[]` (key, label)                                                      | "show revenue trends", "compare sales by quarter"                           |
| `displayGeoMap`         | Interactive maps with markers, routes, and polygons | `id`, `markers[]`, optional `routes[]`, `polygons[]`, `clustering`, `viewport`, marker `icon`, tooltip modes | "map these offices", "plot a travel route", "show a 20-minute commute area" |
| `displayCitations`      | Rich source citation cards                          | `citations[]` with `id`, `href`, `title`, `snippet`                                                          | "best resources for learning Rust"                                          |
| `displayLinkPreview`    | Single featured link card                           | `id`, `href`, `title`, `description`, `image`                                                                | "where are the React docs"                                                  |
| `displayOptionList`     | Interactive option selector                         | `id`, `options[]` with `id`, `label`, `description`                                                          | "which database should I use"                                               |
| `displayQuestionWizard` | Multi-step guided question wizards                  | `id`, `questions[]` with `id`, `question`, `options`                                                         | "help me choose a framework", "what kind of app do you want?"               |
| `displayCallout`        | Styled callout box for key information              | `id`, `variant`, `title` (optional), `content`                                                               | "This API was deprecated in v3"                                             |
| `displayTimeline`       | Chronological event timeline                        | `id`, `title`, `events[]` with `id`, `date`, `title`, `category`                                             | "history of TypeScript", "timeline of SpaceX launches"                      |

**`displayOptionList`** and **`displayQuestionWizard`** have no `execute` function. Their module-local renderers receive the local `submitInteractiveToolOutput` callback; `components/chat.tsx` bridges that callback to AI SDK `addToolOutput({ tool, toolCallId, output })`; and the next request carries the updated AI SDK `messages` history through `components/chat-request.ts` and `lib/streaming/helpers/prepare-messages.ts`, which validates the output before persistence.

**`displayTable` format types:** `text`, `number`, `currency`, `percent`, `date`, `delta`, `boolean`, `link`, `badge`, `status`, `array` — each with type-specific options (e.g., currency code, decimal places, color maps).

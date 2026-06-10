# Research Agent Core Tools

> **Audience:** Architect | Contributor
> **Prerequisites:** [Research Agent](RESEARCH-AGENT.md)

This leaf documents operational tools that perform search, fetch, task tracking, specialist research, and spatial helper calls.

## Tool System

The agent's tools fall into two categories: **core tools** that perform actual operations and **display tools** that render rich UI components.

### Core Tools

#### `search` — Multi-provider web search

**Source:** [`lib/tools/search.ts`](../../lib/tools/search.ts)

Uses the `async *execute` generator pattern to stream intermediate states to the client:

1. Yields `{ state: 'searching', query }` immediately (shows loading spinner)
2. Selects search provider based on `SEARCH_API` env var and `type` parameter
3. Executes search with configured provider
4. Builds citation mapping (`citationMap`) and attaches `toolCallId` from context
5. Yields `{ state: 'complete', ...searchResults }` with results, images, and citation map

**Parameters:**

- `query` (required): Search query string
- `type` (`'optimized'` | `'general'`): Provider routing (default: `'optimized'`)
- `content_types` (`['web', 'video', 'image', 'news']`): Content filtering (Brave only)
- `max_results` (default: 20, minimum enforced: 10)
- `search_depth` (`'basic'` | `'advanced'`): Search depth
- `include_domains` / `exclude_domains`: Domain filtering

#### `fetch` — Web content extraction

**Source:** [`lib/tools/fetch.ts`](../../lib/tools/fetch.ts)

Also uses the streaming generator pattern. Has two fetch strategies:

| Strategy  | Type param            | Use case                | Details                                                            |
| --------- | --------------------- | ----------------------- | ------------------------------------------------------------------ |
| Regular   | `'regular'` (default) | Standard web pages      | Direct HTTP fetch, HTML tag stripping, 50k char limit, 10s timeout |
| API-based | `'api'`               | PDFs, JS-rendered pages | Jina Reader (if `JINA_API_KEY`) or Tavily Extract (fallback)       |

**Regular fetch processing:**

1. Fetches URL with 10-second timeout
2. Validates content type (text/html or text/plain)
3. Strips `<script>` and `<style>` tags
4. Replaces `<img>` tags with `[IMAGE: alt]` markers
5. Removes all remaining HTML tags
6. Truncates to 50,000 characters

#### `todoWrite` — Research task tracking

**Source:** [`lib/tools/todo.ts`](../../lib/tools/todo.ts)

Session-scoped task management. Each `createTodoTools()` call creates an isolated closure with its own todo state.

**Key behaviors:**

- First call initializes the task list
- Subsequent calls merge by **content matching** (case-insensitive): sending a todo with the same content as an existing one updates its status rather than creating a duplicate
- Returns `{ completedCount, totalCount, todos }` for progress tracking
- New todos without explicit status default to `'pending'`

**Workflow pattern in the agent:**

1. CREATE: Call with all tasks as first action
2. UPDATE: Send only changed tasks (unchanged ones are preserved)
3. FINALIZE: Mark all tasks completed before writing final answer

#### `competitorResearch` — Live competitor specialist

**Source:** [`lib/agents/chat/specialists/competitor-research.ts`](../../lib/agents/chat/specialists/competitor-research.ts)

The research agent exposes one live specialist as a normal tool. It accepts a market, 2-6 competitors, and 1-8 comparison dimensions, then uses live `search` and `fetch` evidence to return a structured summary, competitor cards, and a comparison matrix. It is present in `createChatAgentTools()` but only active in `RESEARCH_AGENT_ACTIVE_TOOLS`, so search/chat/build agents cannot call it.

`competitorResearch` is also the Workstream 5 portability proof for bringing a community-style AI SDK `tool({ inputSchema, execute })` pattern into this repo. [`lib/agents/chat/__tests__/community-portability.test.ts`](../../lib/agents/chat/__tests__/community-portability.test.ts) verifies research-agent activation, local toolset execution, dedicated Tool UI rendering, and dynamic-part persistence mapping. Search and fetch are mocked in that test to keep the proof deterministic; live provider coverage remains in the specialist/tool tests and runtime paths.

The proof does not claim that every future specialist is route/streaming/persistence-free by default. Future structured tools still need to stay within the existing seams: add the tool contract, register it in `createChatAgentTools()`, activate it in the intended agent definition/prompt, add a Tool UI result adapter when the output needs rich rendering, and extend message mapping only if the tool needs rich dynamic-part restoration.

#### Spatial tools — geocoding, routing, isochrones, and static maps

These helpers are ordinary agent tools, not display tools. They usually compose into a final `displayGeoMap` or `getStaticMapImage` response.

| Tool                | Source                                                                         | Return shape                                                  | Notes                                                                                            |
| ------------------- | ------------------------------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `geocodeAddress`    | [`lib/tools/geocode-address.ts`](../../lib/tools/geocode-address.ts)           | Ranked candidates with `lat`, `lng`, `placeName`, `placeType` | Use before placing pins when the user gives a place name rather than coordinates.                |
| `getDirections`     | [`lib/tools/get-directions.ts`](../../lib/tools/get-directions.ts)             | Ordered route points plus duration/distance labels            | Supports `driving`, `walking`, `cycling`; `transit` returns a structured `not_supported` result. |
| `getIsochrone`      | [`lib/tools/get-isochrone.ts`](../../lib/tools/get-isochrone.ts)               | Polygon ring points                                           | Requires `ORS_API_KEY`; intended for `displayGeoMap.polygons[]`.                                 |
| `getStaticMapImage` | [`lib/tools/get-static-map-image.ts`](../../lib/tools/get-static-map-image.ts) | Public PNG URL                                                | Use when the user wants a shareable/static image rather than an interactive card.                |

For the end-to-end compose-first flow, see [Geo & Spatial Tools](GEO-TOOLS.md).

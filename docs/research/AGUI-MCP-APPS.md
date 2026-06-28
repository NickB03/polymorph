# AG-UI & MCP Apps: Research and Showcase Opportunities

> **Status:** Research / proposal — no code changes implied by this document.
> **Audience:** Architect | Product
> **Date:** 2026-06-28
> **Question answered:** What are the AG-UI protocol and the MCP Apps / mcp-ui frameworks, and how could Polymorph advance to showcase them?

## TL;DR

Two complementary open standards have emerged around agent UIs:

- **AG-UI** (Agent-User Interaction Protocol) — an event-based wire protocol for connecting an agent **backend** to a frontend. It standardizes the stream of events (text deltas, tool calls, state sync, lifecycle) that Polymorph already produces internally.
- **MCP Apps** (the first official MCP extension, `SEP-1865`) and its precursor **mcp-ui** — a way for an MCP **server's tools** to ship interactive UI as `ui://` resources that any compliant host renders inline in a sandboxed iframe, with bidirectional `postMessage`/JSON-RPC back to the host.

Polymorph already ships a production-grade generative-UI engine that is conceptually a **superset** of both: an SSE stream of typed message parts (text, tool-call, tool-result, custom `data-*` events), a schema-validated tool-UI registry, client-resolved interactive tools, and a sandboxed-iframe canvas. That means "showcasing" these frameworks is mostly **adapter work over machinery we already have**, not green-field building.

The three highest-leverage showcase moves, in recommended order:

1. **MCP Apps host** — wire a runtime MCP client into the agent loop and render `ui://` UI resources. Highest impact, most natural fit (we already sandbox HTML and already render unknown `mcp__` tools generically).
2. **AG-UI server/endpoint** — expose the existing chat stream as AG-UI events so external AG-UI frontends (e.g. CopilotKit) can drive Polymorph's agent. Cheapest, because our part types map ~1:1 to AG-UI events.
3. **MCP Apps server** — publish Polymorph's bespoke display tools (Plan, Chart, DataTable, GeoMap, Canvas) as MCP Apps `ui://` resources so **any** MCP host (Claude, ChatGPT, VS Code Copilot) renders our generative UI. Biggest distribution/reach.

---

## 1. The frameworks

### 1.1 AG-UI — Agent-User Interaction Protocol

- **Repo:** [`ag-ui-protocol/ag-ui`](https://github.com/ag-ui-protocol/ag-ui) · **Docs:** [docs.ag-ui.com](https://docs.ag-ui.com/introduction)
- **Origin:** Spun out of CopilotKit's LangGraph/CrewAI integrations into a standalone open protocol.
- **Position in the stack:** AG-UI is the **front-of-house** protocol. It is explicitly complementary to MCP (agent ↔ tools/context) and A2A (agent ↔ agent): AG-UI is agent ↔ **user-facing app**.

**Model.** An agent backend emits a stream of typed events; a frontend SDK consumes them and updates the UI in real time. Transport-agnostic — works over **SSE, WebSocket, or webhooks** — with a middleware layer that tolerates loose event-format matching.

**Event types** (the [JS core enum](https://docs.ag-ui.com/sdk/js/core/events), grouped):

| Category | Events |
| --- | --- |
| **Lifecycle** | `RUN_STARTED`, `RUN_FINISHED`, `RUN_ERROR`, `STEP_STARTED`, `STEP_FINISHED` |
| **Text messages** | `TEXT_MESSAGE_START`, `TEXT_MESSAGE_CONTENT`, `TEXT_MESSAGE_END` (+ chunk variant) |
| **Tool calls** | `TOOL_CALL_START`, `TOOL_CALL_ARGS`, `TOOL_CALL_END`, `TOOL_CALL_RESULT` |
| **State management** | `STATE_SNAPSHOT`, `STATE_DELTA` (JSON Patch diffs), `MESSAGES_SNAPSHOT` |
| **Reasoning** | `REASONING_START`/`MESSAGE_*`/`END`, encrypted-value variant |
| **Special** | `RAW`, `CUSTOM`, activity snapshot/delta |

**Key capabilities:**
- **Bidirectional state sync** via `STATE_SNAPSHOT` (full) + `STATE_DELTA` (JSON Patch) — minimizes bandwidth while keeping a shared agent/app state object consistent.
- **Generative UI** — agents drive structured frontend components, not just text.
- **Human-in-the-loop** — approval/interrupt flows expressed as events + user input.

**SDKs:** `@ag-ui/core` (types/protocol) and `@ag-ui/client` (frontend connector) in TS, plus Python, Kotlin/Java, Go, Rust, Dart, Ruby, C++, and .NET in progress.
**Framework integrations:** LangGraph, CrewAI, Mastra, Pydantic AI, Agno, LlamaIndex, AG2, Microsoft Agent Framework, Google ADK, AWS Strands, and the Claude Agent SDK (community).

### 1.2 MCP Apps (`SEP-1865`) and mcp-ui

- **Official spec & SDK:** [`modelcontextprotocol/ext-apps`](https://github.com/modelcontextprotocol/ext-apps) · overview at [modelcontextprotocol.io/extensions/apps](https://modelcontextprotocol.io/extensions/apps/overview) · [announcement](https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/)
- **Precursor / still-maintained SDK:** [`MCP-UI-Org/mcp-ui`](https://github.com/MCP-UI-Org/mcp-ui) — pioneered interactive UI over MCP; its patterns shaped the official extension and the `@mcp-ui/*` packages are now MCP-Apps-compliant.
- **Status:** First **official** MCP extension. Supported hosts already include Claude / Claude Desktop, VS Code GitHub Copilot, Microsoft 365 Copilot, Goose, Postman, MCPJam, Archestra.AI.

**Model.** An MCP tool declares a `ui://` resource holding an HTML interface. Flow:

1. **Tool declares UI** — tool metadata links a `ui://…` resource (`_meta.ui.resourceUri`); `mimeType` is typically `text/html;profile=mcp-app`.
2. **LLM calls the tool** on the server.
3. **Host renders** — fetches the `ui://` resource and displays it in a **sandboxed iframe**.
4. **Bidirectional comms** — host pushes tool data into the iframe via notifications; the iframe can call other MCP tools, request prompts, open links, or notify, **through the host** via a `postMessage` ↔ JSON-RPC bridge.

**Resource kinds** (mcp-ui): `rawHtml` (inline), `externalUrl` (iframe to a remote app), `remoteDom` (component tree rendered with the host's own design system).

**Official SDK packages** (`@modelcontextprotocol/ext-apps`):
- core `App` + `PostMessageTransport` for building Views,
- `/react` hooks (`useApp`, `useHostStyles`),
- `/app-bridge` for host-side embedding,
- `/server` for registering tools+resources with UI metadata.

**mcp-ui SDK packages:** `@mcp-ui/server` (`createUIResource`), `@mcp-ui/client` (`AppRenderer`, `UIResourceRenderer`), plus Ruby/Python server libs. Its `postMessage` action protocol — `tool`, `prompt`, `link`, `notify`, `intent` — is the de-facto interaction vocabulary.

### 1.3 How they relate

```
            ┌──────────────┐   AG-UI events (SSE/WS)   ┌──────────────┐
   User ◄──►│   Frontend   │◄─────────────────────────►│    Agent     │
            │ (AG-UI host) │                            │   backend    │
            └──────────────┘                            └──────┬───────┘
                                                               │ MCP (tools + context)
                                                        ┌──────▼───────┐
                                                        │  MCP servers │  ← tools can ship
                                                        │  (+ MCP Apps)│    ui:// UI resources
                                                        └──────────────┘
```

AG-UI carries the agent↔user conversation; MCP feeds the agent tools/context; **MCP Apps** lets those tools push interactive UI that surfaces back through the host. They are designed to compose, not compete.

---

## 2. Where Polymorph stands today

Polymorph already implements, in-house, most of the primitives both standards define. (Claims below cite `file:line`; the runtime-MCP gap was verified by grep — there is no `experimental_createMCPClient` / `modelcontextprotocol` usage anywhere under `lib/`, `app/`, or `components/`.)

| Capability | AG-UI / MCP Apps concept | Polymorph today |
| --- | --- | --- |
| Event-stream transport | AG-UI SSE/WS event stream | SSE via Vercel AI SDK `UIMessageStream` — `lib/streaming/create-chat-stream-response.ts` |
| Text deltas | `TEXT_MESSAGE_*` | `text-delta` parts (`smoothStream` word chunking) |
| Tool-call events | `TOOL_CALL_START/ARGS/END/RESULT` | `tool-call` / `tool-call-streaming-start` / `tool-call-delta` + tool output parts (`docs/architecture/STREAMING-SSE-PROTOCOL.md`) |
| Custom/state events | `CUSTOM`, `STATE_*` | `data-*` parts (`data-relatedQuestions`, `data-canvasArtifact*`), persistent + transient |
| Schema-validated UI | typed UI resources | Zod tool-UI contracts + registry — `components/tool-ui/registry.tsx`, `renderer-catalog.tsx` |
| Sandboxed iframe UI | MCP Apps `ui://` in sandboxed iframe | Canvas compiled HTML via `iframe.srcdoc sandbox=…` — `components/canvas/*`, `lib/canvas/*` |
| Unknown-tool rendering | host renders any tool's UI | `DynamicToolDisplay` already special-cases `mcp__`/`dynamic__` prefixes — `components/dynamic-tool-display.tsx:47` |
| Client-resolved interaction | host→tool action bridge | Interactive `displayOptionList` resolved client-side, fed back into the loop — `lib/tools/display-option-list/`, `lib/streaming/helpers/prepare-messages.ts` |
| MCP client in agent loop | consume MCP servers at runtime | **Missing.** Only an interface-only `MCPClient` type (`lib/types/dynamic-tools.ts:8`) and a dev/ops `.mcp.json` (Railway/Phoenix/next-devtools for Claude Code CLI, not runtime) |

**The gap is narrow and specific:** we have the rendering, sandboxing, streaming, and registry layers; what we lack is (a) a runtime **MCP client** feeding tools into the agent, (b) an **MCP-Apps iframe bridge** for `ui://` resources, and (c) **outward-facing protocol adapters** (AG-UI event emitter; MCP-Apps server wrapper for our display tools).

---

## 3. Showcase opportunities

Each initiative below lists the natural integration points in our codebase and a rough effort/impact read. They are independent but compose into "the full agentic stack."

### Initiative A — Become an **MCP Apps host** (render `ui://` resources inline) ⭐ highest fit

Let Polymorph consume third-party MCP servers and render their MCP-Apps UI inline in chat. This is the single most visible demo: connect a public MCP App (e.g. a Linear/Stripe/maps server) and watch its native dashboard render inside Polymorph.

**Why us:** we already (1) sandbox untrusted HTML in an iframe (canvas), (2) render unknown `mcp__`-prefixed tools via `DynamicToolDisplay`, and (3) have a transient `data-*` event channel for host→UI pushes.

**Build:**
1. Add a runtime MCP client (Vercel AI SDK `experimental_createMCPClient`, or `@modelcontextprotocol/ext-apps/app-bridge` on the host side). Load tools in `lib/agents/chat/toolset.ts`'s `createChatAgentTools()`; register them as `mcp__{server}__{tool}`.
2. When a tool result carries a `ui://` resource, fetch it and stream a new `data-mcpAppResource` part. Reuse the canvas iframe/`srcdoc` + sandbox plumbing in `components/canvas/*` to render it.
3. Implement the `postMessage` ↔ JSON-RPC bridge so the iframe can call back (`tool`/`prompt`/`link`/`notify`/`intent`) — route `tool` calls back into the agent loop the same way `displayOptionList` resolves client-side (`lib/streaming/helpers/prepare-messages.ts`).

**Effort:** Medium-High (new MCP client + iframe bridge + security review). **Impact:** Very high.
**Security note:** `ui://` HTML is untrusted third-party code. Reuse canvas's strict `sandbox` flags and CSP posture; never grant `allow-same-origin` to remote MCP UIs without isolation. Treat all `postMessage` payloads as untrusted (origin-check, schema-validate).

### Initiative B — Become an **AG-UI server** (expose our agent over the protocol) ⭐ cheapest

Add an AG-UI-compatible endpoint that re-emits the existing chat stream as AG-UI events. Then any AG-UI frontend — CopilotKit components, the AG-UI Dojo, a third-party app — can drive Polymorph's research agent. Strong "interoperability" story with near-zero risk to the main app.

**Why us:** our part types map almost 1:1 onto AG-UI events.

**Build:**
1. New route `app/api/agui/route.ts` that runs the existing agent factory but pipes through a translation layer.
2. A thin adapter (`lib/streaming/agui-adapter.ts`) mapping our parts → AG-UI events:
   - `start` → `RUN_STARTED`; `finish` → `RUN_FINISHED`; errors → `RUN_ERROR`
   - `text-delta` → `TEXT_MESSAGE_CONTENT` (wrap with `TEXT_MESSAGE_START/END`)
   - `tool-call*` → `TOOL_CALL_START/ARGS/END`; tool output → `TOOL_CALL_RESULT`
   - `data-canvasArtifact*` / `data-relatedQuestions` → `CUSTOM` (or model canvas as AG-UI shared `STATE_*`)
3. Optionally consume `@ag-ui/core` types directly so we stay spec-aligned.

**Effort:** Low-Medium (pure adapter; no UI changes). **Impact:** High (interop + ecosystem visibility).
**Stretch:** also *consume* AG-UI — let Polymorph's frontend connect to an external AG-UI agent (LangGraph/Mastra) and render it with our existing generative-UI components, proving the registry is host-agnostic.

### Initiative C — Become an **MCP Apps server** (publish our display tools as `ui://` apps) ⭐ widest reach

Wrap Polymorph's bespoke display library — Plan, DataTable, Chart, GeoMap, Timeline, Callout, Citations, Canvas — as an MCP Apps server. Any MCP host (Claude, ChatGPT, VS Code Copilot, Goose) could then call `displayChart`/`displayGeoMap` and render **Polymorph's** UI inline. This turns an internal asset into a distributable product and is the loudest external showcase.

**Why us:** our display tools are already serializable, Zod-validated, schema-contracted, and host-decoupled via the `_adapter.tsx` pattern (`components/tool-ui/*/_adapter.tsx`) — exactly the seam MCP Apps' `remoteDom`/`rawHtml` resources need.

**Build:**
1. A standalone MCP server (own package, like `services/evals/`) using `@modelcontextprotocol/ext-apps/server` (or `@mcp-ui/server`'s `createUIResource`).
2. For each display tool, expose the MCP tool + a `ui://polymorph/{tool}` resource that renders the existing component. The `_adapter.tsx` indirection lets the same component compile for an external host's design system.
3. Map the component's interactions to the mcp-ui action protocol (`tool`/`prompt`/`link`).

**Effort:** High (new deployable + per-tool packaging + cross-host CSS). **Impact:** Very high reach; start with 2–3 flagship tools (Chart, GeoMap, Plan) as a proof.

### Initiative D — The "full stack" demo (compose A+B+C)

Capstone: a single flow where Polymorph runs as an **AG-UI agent** (B), pulls tools/context from **MCP servers** (A), renders their **MCP Apps UI** inline, and re-exposes its own display tools as **MCP Apps** (C) — visually demonstrating AG-UI + MCP + MCP Apps as one coherent stack. Highest narrative payoff; do it after at least two of A–C land.

---

## 4. Recommended sequencing

| Phase | Initiative | Rationale | Rough effort |
| --- | --- | --- | --- |
| 1 | **B — AG-UI server endpoint** | Cheapest, isolated (new route + adapter), immediate interop story; validates that our part model is protocol-grade | Low-Med |
| 2 | **A — MCP Apps host** | Highest user-visible payoff; reuses canvas sandbox + `DynamicToolDisplay`; unlocks the public MCP App ecosystem inside Polymorph | Med-High |
| 3 | **C — MCP Apps server** | Turns our display library into a cross-host product; biggest reach but most packaging work | High |
| 4 | **D — Full-stack demo** | Marketing/positioning capstone once A & B exist | Med |

Start with **B** to ship something concrete and low-risk, then **A** for the flagship demo.

---

## 5. Open questions / decisions for the user

1. **Goal:** interoperability/credibility (lean AG-UI server, Initiative B) or a flashy product demo (lean MCP Apps host, Initiative A)? They share little code, so the first pick sets the roadmap.
2. **Host vs server emphasis for MCP Apps:** consume others' UIs (A) first, or publish ours (C) first?
3. **Dependency posture:** adopt `@ag-ui/*` / `@modelcontextprotocol/ext-apps` / `@mcp-ui/*` packages, or hand-roll thin adapters to avoid coupling to fast-moving SDKs?
4. **Security appetite:** rendering third-party `ui://` HTML (Initiative A) needs a hardened iframe sandbox + CSP review before any public demo.

---

## Sources

- AG-UI repo — <https://github.com/ag-ui-protocol/ag-ui>
- AG-UI docs / introduction — <https://docs.ag-ui.com/introduction>
- AG-UI core event types — <https://docs.ag-ui.com/sdk/js/core/events>
- MCP Apps overview — <https://modelcontextprotocol.io/extensions/apps/overview>
- MCP Apps announcement — <https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/>
- Official MCP Apps spec & SDK (`ext-apps`) — <https://github.com/modelcontextprotocol/ext-apps>
- `SEP-1865` MCP Apps proposal — <https://github.com/modelcontextprotocol/modelcontextprotocol/pull/1865>
- mcp-ui SDK — <https://github.com/MCP-UI-Org/mcp-ui> · docs <https://idosal.github.io/mcp-ui/>
- Microsoft interactive-UI MCP samples — <https://github.com/microsoft/mcp-interactiveUI-samples>

### Internal references

- Generative UI docs hub — `docs/architecture/GENERATIVE-UI.md`
- SSE protocol — `docs/architecture/STREAMING-SSE-PROTOCOL.md`
- Streaming pipeline — `lib/streaming/create-chat-stream-response.ts`
- Tool-UI registry / renderer catalog — `components/tool-ui/registry.tsx`, `components/tool-ui/renderer-catalog.tsx`
- Dynamic/unknown tool rendering (`mcp__` aware) — `components/dynamic-tool-display.tsx:47`
- Interactive tool resolution — `lib/tools/display-option-list/`, `lib/streaming/helpers/prepare-messages.ts`
- Canvas sandboxed iframe — `components/canvas/*`, `lib/canvas/*`
- MCP client interface (type-only, unused at runtime) — `lib/types/dynamic-tools.ts:8`

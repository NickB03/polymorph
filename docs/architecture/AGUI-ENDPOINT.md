# AG-UI Endpoint

> **Audience:** Architect | Contributor
> **Prerequisites:** [Streaming & SSE](STREAMING.md), [AG-UI / MCP Apps research](../research/AGUI-MCP-APPS.md)

Polymorph exposes its chat agent over the [AG-UI protocol](https://docs.ag-ui.com) — the open, event-based Agent-User Interaction protocol — so any AG-UI-compatible frontend (e.g. CopilotKit, the AG-UI Dojo) can drive the agent. This is Initiative B from the [AG-UI / MCP Apps research](../research/AGUI-MCP-APPS.md): a thin adapter over the existing streaming engine, not a parallel agent.

## Endpoint

`POST /api/agui` — accepts an AG-UI [`RunAgentInput`](https://docs.ag-ui.com) and returns an SSE stream of AG-UI events.

**Disabled by default.** It runs the agent **unauthenticated and statelessly** (no DB persistence, no auth-scoped history, no canvas/image tools), so it is gated behind an env flag:

```bash
ENABLE_AGUI_ENDPOINT=true
```

Only enable it where that cost/abuse surface is acceptable (controlled demo, or behind your own gateway). When unset, the route returns `404`.

## Request

The body is validated with `RunAgentInputSchema` from `@ag-ui/core`. Relevant fields:

- `threadId`, `runId` — echoed back on `RUN_STARTED` / `RUN_FINISHED`.
- `messages` — conversation history. Only `system` / `developer` / `user` / `assistant` **text** turns are forwarded to the model; `tool` / `activity` / `reasoning` turns are dropped (the agent re-runs its own tool loop).
- `forwardedProps.userMode` — optional `'search' | 'research' | 'build'` to select the agent (default `'search'`). The frontend owns thread state and resends history each run.

## Event mapping

The agent is a Vercel AI SDK `ToolLoopAgent`; its `fullStream` parts are translated to AG-UI events. Lifecycle events wrap the run; the rest map per-part:

| AI SDK `fullStream` part                        | AG-UI event                                                                              |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------- |
| (run start, before consuming)                   | `RUN_STARTED`                                                                            |
| `text-start` / `text-delta` / `text-end`        | `TEXT_MESSAGE_START` (role `assistant`) / `TEXT_MESSAGE_CONTENT` / `TEXT_MESSAGE_END`    |
| `tool-input-start` / `-delta` / `-end`          | `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END`                                   |
| `tool-call` (no prior streamed input)           | `TOOL_CALL_START` + `TOOL_CALL_ARGS` + `TOOL_CALL_END`                                   |
| `tool-call` for a Polymorph **display tool**    | the above **plus** a `CUSTOM` `GenerativeUI` event (see [Generative UI](#generative-ui)) |
| `tool-result` / `tool-error`                    | `TOOL_CALL_RESULT`                                                                       |
| `start-step` / `finish-step`                    | `STEP_STARTED` / `STEP_FINISHED`                                                         |
| `error`                                         | `RUN_ERROR`                                                                              |
| (stream complete)                               | `RUN_FINISHED`                                                                           |
| `reasoning-*`, `source`, `file`, `raw`, `abort` | _(dropped — no AG-UI v1 mapping)_                                                        |

Events are serialized to SSE by `EventEncoder.encodeSSE()` from `@ag-ui/encoder`, guaranteeing spec-compliant framing.

### Terminal errors

A run ends in exactly one terminal event. There are two error paths, both emitting `RUN_ERROR` **instead of** `RUN_FINISHED`:

- **Thrown errors** — if starting the run or iterating the `fullStream` throws (e.g. the model call fails), the `aguiSseResponse` catch block emits `RUN_ERROR` with the error message.
- **`error` stream parts** — if the agent's `fullStream` yields an `error` part mid-run, it maps to `RUN_ERROR` and the run **stops immediately**: the stream is not consumed further and no `RUN_FINISHED` follows. Any parts after the `error` part are dropped.

A successful run emits `RUN_FINISHED`; an errored run emits `RUN_ERROR` and never both.

### Generative UI

Polymorph's display tools (`displayPlan`, `displayChart`, `displayTable`, `displayGeoMap`, …) drive bespoke UI components. Beyond the ordinary `TOOL_CALL_*` + `TOOL_CALL_RESULT` events (which any AG-UI frontend renders generically), a `tool-call` for one of these tools **also** emits a `CUSTOM` event so AG-UI frontends can render the matching component natively:

```jsonc
{
  "type": "CUSTOM",
  "name": "GenerativeUI",
  "value": {
    "component": "displayPlan", // the display-tool name
    "toolCallId": "call-2",
    "kind": "passive-display", // or "interactive-display"
    "props": {
      "id": "…",
      "title": "…",
      "todos": [
        /* the tool input */
      ]
    }
  }
}
```

The display-tool set and each tool's `kind` are derived from `TOOL_UI_TOOL_METADATA` in `lib/tools/tool-ui/metadata.ts` (the single source of truth), so the mapping stays in sync as tools are added. The `CUSTOM` event is emitted on the assembled `tool-call` part (where the full input is available) — including when the tool input was already streamed (in which case the `TOOL_CALL_*` lifecycle is **not** re-emitted, only the `CUSTOM` event). Non-UI tools (`search`, `fetch`, …) emit no `GenerativeUI` event.

## Files

| File                                 | Purpose                                                                                                                |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `app/api/agui/route.ts`              | Route: env gate, `RunAgentInput` validation, dispatch                                                                  |
| `lib/streaming/agui/response.ts`     | Builds the agent statelessly and hands its `fullStream` to the SSE encoder                                             |
| `lib/streaming/agui/sse.ts`          | `aguiSseResponse`: wraps a run in `RUN_STARTED`/`RUN_FINISHED`/`RUN_ERROR` and encodes SSE (agent-free, unit-testable) |
| `lib/streaming/agui/adapter.ts`      | Pure mapping: input messages → `ModelMessage[]`; `fullStream` parts → AG-UI events                                     |
| `lib/streaming/agui/client.ts`       | `consumeAguiStream`: Polymorph as an AG-UI _client_ — decodes an AG-UI SSE stream into a normalized result             |
| `lib/streaming/agui/demo.ts`         | Scripted, model-free `fullStream` fixture powering `AGUI_DEMO` mode (see below)                                        |
| `lib/streaming/agui/adapter.test.ts` | Unit tests for the mapping layer                                                                                       |
| `lib/streaming/agui/sse.test.ts`     | Tests the lifecycle wrapping + SSE encoding + terminal-error handling with a synthetic `fullStream`                    |
| `lib/streaming/agui/client.test.ts`  | Loopback round-trip (`aguiSseResponse` → `consumeAguiStream`) + an error-run reduction                                 |
| `lib/streaming/agui/agent.test.ts`   | End-to-end test driving a real `ToolLoopAgent` backed by a mock model (no API key) through `aguiSseResponse`           |

## Consuming AG-UI (Polymorph as a client)

The endpoint above makes Polymorph an AG-UI _server_. The inverse direction —
Polymorph driving an **external** AG-UI agent — lives in
`lib/streaming/agui/client.ts`. `consumeAguiStream(source)` takes any AG-UI SSE
source (a `fetch` `Response`, a `ReadableStream<Uint8Array>`, or an
`AsyncIterable<string>` of SSE text), decodes the `data:` frames into AG-UI
events (typed with `@ag-ui/core`, no `@ag-ui/client` dependency), and **reduces**
them into a normalized, render-ready result:

```ts
{
  status: 'finished' | 'error',
  error?: string,                  // set when a RUN_ERROR was seen
  messages: Array<{
    id: string
    role: 'assistant'
    text: string                   // accumulated by messageId from TEXT_MESSAGE_*
    toolCalls: Array<{
      toolCallId: string
      name: string                 // from TOOL_CALL_START
      args: string                 // concatenated TOOL_CALL_ARGS deltas
      result?: string              // TOOL_CALL_RESULT.content
    }>
  }>,
  generativeUI: Array<{            // collected GenerativeUI CUSTOM events
    component: string
    toolCallId: string
    kind?: string
    props: unknown
  }>
}
```

`status` resolves from the terminal event (`RUN_FINISHED` → `'finished'`,
`RUN_ERROR` → `'error'` with `error` set). It is a pure reducer with no I/O, so
the loopback test pipes `aguiSseResponse(demoFullStream())` straight into it and
asserts the reconstructed text, the `search` tool call + result, the `displayPlan`
generative-UI component, and `status: 'finished'`.

**Frontend wiring:** the consume → render path is implemented in
`components/agui/*`:

- `useAguiAgent({ endpoint })` (`components/agui/use-agui-agent.ts`) — a client
  hook whose `run(input)` POSTs an AG-UI `RunAgentInput` as JSON to `endpoint`
  and pipes the streaming `Response` straight into `consumeAguiStream`. It owns
  only the fetch + React state (`result`, `status`, `error`); all SSE decoding
  is delegated to `lib/streaming/agui/client.ts`.
- `AguiGenerativeUI` (`components/agui/agui-generative-ui.tsx`) — a client
  component that takes an `AguiConsumeResult` and renders (a) the assistant
  message text, (b) a compact list of reconstructed tool calls, and (c) each
  `generativeUI` entry natively. Each entry maps `component` → the matching
  `components/tool-ui/*` renderer via the tool-UI registry
  (`components/tool-ui/registry.tsx`): when `isRegisteredToolUI(component)` is
  true it calls `tryRenderToolUIByName(component, props, ` `agui-${toolCallId}` `)`,
  which validates `props` against the tool's schema and renders the real card —
  the same display components Polymorph emits as a server. An unregistered
  component, or props that fail schema validation (so the registry returns
  `null`), degrade to a labeled fallback card instead of crashing.

`app/agui-demo/page.tsx` is a gated dev page that wires `useAguiAgent` against
the local `/api/agui` endpoint and renders the live result with
`AguiGenerativeUI` (enable the endpoint + demo mode as below).

## Demo mode (no API key)

For exercising the endpoint and AG-UI frontends without any model credentials, the route supports a gated demo mode:

```bash
ENABLE_AGUI_ENDPOINT=true AGUI_DEMO=true bun dev
```

When `AGUI_DEMO=true` **and** the runtime is not a production target (`isProductionTarget()` from `lib/config/env.ts` is false), `createAguiRunResponse` short-circuits before building the real agent and streams a scripted lifecycle from `demo.ts`: `RUN_STARTED`, assistant text, a complete `search` tool call (`TOOL_CALL_START`/`ARGS`/`END`) with a `TOOL_CALL_RESULT`, a `displayPlan` display-tool call (its `TOOL_CALL_*` lifecycle **plus** a `GenerativeUI` `CUSTOM` event) with a `TOOL_CALL_RESULT`, then `RUN_FINISHED`. No model is called and no network I/O happens.

Demo mode is **ignored on production targets** even if `AGUI_DEMO=true` is set, so it cannot accidentally serve fixture output in production.

## Try it

```bash
ENABLE_AGUI_ENDPOINT=true bun dev
```

```bash
curl -N http://localhost:43100/api/agui \
  -H 'Content-Type: application/json' \
  -d '{
    "threadId": "t1",
    "runId": "r1",
    "messages": [{ "id": "1", "role": "user", "content": "What is AG-UI?" }],
    "tools": [],
    "context": [],
    "forwardedProps": { "userMode": "search" }
  }'
```

You should see an SSE stream beginning with a `RUN_STARTED` event and ending with `RUN_FINISHED`.

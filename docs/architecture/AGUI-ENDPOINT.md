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

| AI SDK `fullStream` part                        | AG-UI event                                                                           |
| ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| (run start, before consuming)                   | `RUN_STARTED`                                                                         |
| `text-start` / `text-delta` / `text-end`        | `TEXT_MESSAGE_START` (role `assistant`) / `TEXT_MESSAGE_CONTENT` / `TEXT_MESSAGE_END` |
| `tool-input-start` / `-delta` / `-end`          | `TOOL_CALL_START` / `TOOL_CALL_ARGS` / `TOOL_CALL_END`                                |
| `tool-call` (no prior streamed input)           | `TOOL_CALL_START` + `TOOL_CALL_ARGS` + `TOOL_CALL_END`                                |
| `tool-result` / `tool-error`                    | `TOOL_CALL_RESULT`                                                                    |
| `start-step` / `finish-step`                    | `STEP_STARTED` / `STEP_FINISHED`                                                      |
| `error`                                         | `RUN_ERROR`                                                                           |
| (stream complete)                               | `RUN_FINISHED`                                                                        |
| `reasoning-*`, `source`, `file`, `raw`, `abort` | _(dropped — no AG-UI v1 mapping)_                                                     |

Events are serialized to SSE by `EventEncoder.encodeSSE()` from `@ag-ui/encoder`, guaranteeing spec-compliant framing.

Polymorph's display tools (Plan, Chart, DataTable, GeoMap, …) surface as ordinary `TOOL_CALL_*` + `TOOL_CALL_RESULT` events, which AG-UI frontends render generically. Mapping them to AG-UI generative-UI / `STATE_*` is a future enhancement.

## Files

| File                                 | Purpose                                                                            |
| ------------------------------------ | ---------------------------------------------------------------------------------- |
| `app/api/agui/route.ts`              | Route: env gate, `RunAgentInput` validation, dispatch                              |
| `lib/streaming/agui/response.ts`     | Builds the agent, runs `.stream()`, encodes the SSE event stream                   |
| `lib/streaming/agui/adapter.ts`      | Pure mapping: input messages → `ModelMessage[]`; `fullStream` parts → AG-UI events |
| `lib/streaming/agui/adapter.test.ts` | Unit tests for the mapping layer                                                   |

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

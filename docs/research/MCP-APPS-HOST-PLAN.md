# Initiative A — MCP Apps Host: Implementation Plan

> **Status:** Plan / proposal — **no code written**. Awaiting review before implementation.
> **Audience:** Architect | Product
> **Date:** 2026-06-28
> **Parent:** [AG-UI / MCP Apps research](AGUI-MCP-APPS.md) → Initiative A
> **Decision requested:** approve the native stack + server-config approach below, then I build the gated vertical slice.

## Goal

Let Polymorph **consume third-party MCP servers** and render their **MCP Apps UI** (`ui://` resources) inline in chat — e.g. connect a Linear/Stripe/maps MCP App and watch its native dashboard render inside a Polymorph conversation, with the iframe able to call tools back through the host.

## 1. Key finding — the native stack exists (and shifts the build sharply)

My earlier research note assumed we'd hand-roll the MCP client + iframe bridge. **That's no longer the right call.** As of AI SDK v6, MCP is **stable and first-party**, and there is an **official MCP Apps host renderer**. This is the "native/preferred" path you asked me to review:

| Concern           | Native/preferred answer                                                                                                                                                                                                                              | Source                                                                                                                           |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| MCP client        | AI SDK v6 **`@ai-sdk/mcp`** (`createMCPClient`) — stable, graduated from v5's `experimental_createMCPClient`. Adds OAuth, HTTP transport, resources, prompts, elicitation.                                                                           | [AI SDK 6](https://vercel.com/blog/ai-sdk-6), [createMCPClient](https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client) |
| Transport         | **Streamable HTTP** (`StreamableHTTPClientTransport` from `@modelcontextprotocol/sdk`). It's the recommended remote transport for 2026; **HTTP+SSE is deprecated (sunset 2026-06-30)**; **stdio is local-only** and unusable from Vercel serverless. | [MCP transports spec](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)                                 |
| MCP Apps host SDK | **`@ai-sdk/mcp`** helpers (`mcpAppClientCapabilities`, `splitMCPAppTools`, `readMCPAppResource`) + **`experimental_MCPAppRenderer`** from `@ai-sdk/react` (handles the sandboxed iframe, app-bridge, JSON-RPC-over-postMessage, tool-call proxying). | [Vercel KB: AI SDK + MCP Apps](https://vercel.com/kb/guide/ai-sdk-mcp-apps)                                                      |

> ⚠️ Note: `node_modules/ai@6.0.199` does **not** bundle MCP — it lives in the separate `@ai-sdk/mcp` package, which we'd add.

**Why this matters:** the sandboxed iframe, the `postMessage`↔JSON-RPC bridge, CSP/permission metadata parsing, and tool-call proxying — the parts I previously flagged as the expensive, security-sensitive build — are **provided by the official SDK**. Our job shrinks to: wiring the client into the agent loop, a server-side tool-proxy route with an allow-list, and dropping the renderer into our message list. Polymorph already uses `@ai-sdk/react`'s `useChat` (`components/chat.tsx:13`), so `experimental_MCPAppRenderer` integrates directly.

## 2. Server configuration — recommendation (the decision you flagged)

**MCP does not standardize a host-side _config_ format**, but the de-facto standard is the `mcpServers` JSON object (Claude Desktop / `.mcp.json` shape). For Polymorph specifically:

- **Do NOT reuse the existing `.mcp.json`.** It holds **stdio** dev/ops servers (`railway`, `phoenix`, `next-devtools`) for the Claude Code CLI. stdio can't run in Vercel serverless, and those aren't UI servers — reusing it would conflate tooling with runtime and connect the wrong things.
- **Recommended: a dedicated runtime allow-list of remote (Streamable HTTP) MCP App servers**, separate from `.mcp.json`. Concretely, an env var holding a small JSON array (or a typed config module) of `{ name, url, auth? }` entries, validated with Zod at boot. This keeps an explicit, auditable allow-list (no arbitrary/per-request URLs → no SSRF surface), matches the de-facto `mcpServers` shape, and is the same env-gated posture we used for the AG-UI endpoint.
- **Reject per-request server URLs** for v1 (the third option in the earlier question). Letting the chat payload name an arbitrary MCP URL is the largest abuse/SSRF surface and isn't needed for a showcase. It can be added later behind auth + an allow-list if a real use case appears.

Each server registers its tools as **`mcp__{server}__{tool}`** — which our `DynamicToolDisplay` already special-cases (`components/dynamic-tool-display.tsx:47`), so non-UI MCP tools render immediately with zero new client work.

## 3. Architecture mapping to Polymorph

```
RunAgentInput / chat request
        │
        ▼
lib/agents/chat/toolset.ts  createChatAgentTools()      ← inject MCP tools here (seam at :61)
        │   • createMCPClient(StreamableHTTPClientTransport) per configured server
        │   • splitMCPAppTools(listTools()) → modelVisible vs appVisible
        │   • client.toolsFromDefinitions(modelVisible) registered as mcp__{server}__{tool}
        ▼
agent.stream()  →  tool-call / tool-result parts  (existing streaming, unchanged)
        │
        ▼
components/chat.tsx (useChat) → render-message.tsx
        │   • non-UI mcp__ tools → DynamicToolDisplay (already works)
        │   • tool parts whose tool declared a ui:// resource → experimental_MCPAppRenderer
        ▼
sandboxed iframe (app-bridge) ──postMessage(tools/call)──▶ POST /api/mcp-app-host/call-tool
                                                            • allow-list check vs appVisible
                                                            • client.callTool(...) → result back to iframe
```

Touch points:

- **`lib/agents/chat/toolset.ts:61`** (`createChatAgentTools`) — the injection seam for MCP tools.
- **`lib/mcp/` (new)** — client factory, server config + Zod schema, lifecycle (create/close per request), tool-name prefixing, `readMCPAppResource` caching.
- **`app/api/mcp-app-host/call-tool/route.ts` (new)** — server-side proxy for iframe tool calls, validated against the app-visible allow-list.
- **`components/render-message.tsx`** — branch tool parts with `_meta.ui` to `experimental_MCPAppRenderer`; everything else unchanged.

## 4. Security model (load-bearing — review carefully)

The official renderer handles sandboxing, but the host still owns these:

1. **Untrusted HTML.** `ui://` content is third-party code. Render only via the SDK's sandboxed iframe; never `allow-same-origin` against our own origin. Strongly consider a **separate sandbox origin** for the iframe proxy (Vercel KB explicitly recommends this).
2. **Never expose app-only tools to the model.** Pass only `splitMCPAppTools(...).modelVisible` to the agent; `appVisible` tools are reachable _only_ through the validated proxy.
3. **Validate every iframe → host tool call** server-side against the app-visible allow-list before forwarding (`/api/mcp-app-host/call-tool` returns 403 otherwise). Origin-check and schema-validate all `postMessage` payloads.
4. **CSP + permissions.** `readMCPAppResource` returns CSP/permission metadata — enforce it on the iframe.
5. **Allow-listed servers only.** No arbitrary/per-request server URLs (see §2). Cache resources by URI.
6. **Env-gated + off by default**, like the AG-UI endpoint (`ENABLE_MCP_APPS_HOST`), since it broadens the agent's tool surface and network egress.

## 5. Phased plan (gated vertical slice → iterate)

| Phase                           | Deliverable                                                                                                                                                  | Risk    |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------- |
| **0. Spike (no merge)**         | Connect one public Streamable-HTTP MCP App server in a throwaway script; confirm `listTools` / `readMCPAppResource` shapes against the live SDK.             | Low     |
| **1. Non-UI MCP tools**         | Runtime client + config + `createChatAgentTools` injection; `mcp__` tools callable and rendered via existing `DynamicToolDisplay`. No iframe yet. Env-gated. | Low-Med |
| **2. UI rendering (read-only)** | `experimental_MCPAppRenderer` in the message list; `ui://` resources render in the sandboxed iframe. No write-back.                                          | Med     |
| **3. Interactive bridge**       | `/api/mcp-app-host/call-tool` proxy + allow-list; iframe can call tools back. **Security review gate before exposing.**                                      | High    |
| **4. Polish**                   | Resource caching, error states, per-request client lifecycle/teardown, observability.                                                                        | Low     |

Each phase is independently shippable behind the flag. Phases 0–2 are the "showcase" demo; Phase 3 is the security-sensitive step.

## 6. New dependencies

- `@ai-sdk/mcp` (MCP client + MCP Apps helpers)
- `@modelcontextprotocol/sdk` (transports: `StreamableHTTPClientTransport`)
- `@ai-sdk/react` — already installed; gains `experimental_MCPAppRenderer` usage

All `experimental_`-prefixed APIs — expect churn; isolate behind our own thin module (`lib/mcp/`) as we did for AG-UI.

## 7. Open decisions for you

1. **Sandbox origin:** stand up a separate origin/subdomain for the iframe proxy (recommended, more setup), or rely on iframe `sandbox` flags alone on the main origin (simpler, weaker isolation)?
2. **Auth on MCP servers:** do we need OAuth-authenticated MCP App servers in v1, or only public/no-auth servers for the demo? (`@ai-sdk/mcp` supports OAuth; it adds setup.)
3. **How far now:** you chose "plan first." On approval, my default is to build **Phases 1–2** (gated, read-only render) and stop before the interactive bridge (Phase 3) for a dedicated security review. Confirm or adjust.
4. **Lifecycle:** per-request client create/close (simplest, safe in serverless) vs. a pooled/cached connection (faster, more state to manage). I lean per-request for v1.

## Sources

- AI SDK 6 announcement (stable MCP) — <https://vercel.com/blog/ai-sdk-6>
- AI SDK `createMCPClient` reference — <https://ai-sdk.dev/docs/reference/ai-sdk-core/create-mcp-client>
- Vercel KB — Add MCP Apps to your AI SDK application — <https://vercel.com/kb/guide/ai-sdk-mcp-apps>
- MCP transports specification (2025-11-25) — <https://modelcontextprotocol.io/specification/2025-11-25/basic/transports>
- MCP Apps overview — <https://modelcontextprotocol.io/extensions/apps/overview>
- MCP Apps announcement — <https://blog.modelcontextprotocol.io/posts/2026-01-26-mcp-apps/>
- mcp-ui `UIResourceRenderer` / `AppRenderer` — <https://mcpui.dev/guide/client/resource-renderer>
- Shipping MCP Apps in production (host side) — <https://medium.com/elementor-engineers/shipping-mcp-apps-in-production-45dab11b358c>

### Internal references

- Tool injection seam — `lib/agents/chat/toolset.ts:61`
- Unknown/`mcp__` tool rendering (already present) — `components/dynamic-tool-display.tsx:47`
- Client chat hook (`@ai-sdk/react` `useChat`) — `components/chat.tsx:13`
- Message rendering dispatch — `components/render-message.tsx`
- Prior art for env-gated, stateless protocol endpoint — `docs/architecture/AGUI-ENDPOINT.md`

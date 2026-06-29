# Agent-Driven Portfolio: Plan

> **Status:** Plan / proposal — **no code written**. Awaiting review.
> **Audience:** Architect | Product
> **Date:** 2026-06-29
> **Parent:** [AG-UI Endpoint](../architecture/AGUI-ENDPOINT.md) · [AG-UI / MCP Apps research](AGUI-MCP-APPS.md)
> **Scope note:** Spans **two repos** — Polymorph (this repo, where the gating work lives) and **nickb.net** (a separate repo, specified here at the contract level only).

## Goal

Replace the basic Q&A chat on **nickb.net** with an **agent-driven experience powered by Polymorph's AG-UI agent** — so the portfolio site _is_ a live demo of Polymorph. Visitors chat with the real agent, see Polymorph's generative UI inline, and (later) watch the agent operate the site.

The single prerequisite gating all of this: **a deployed, secured, cost-capped public `/api/agui`.** Everything else builds on that.

## What already exists (leverage, don't rebuild)

| Piece                       | Where                                                                                 | Status                                                                 |
| --------------------------- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| AG-UI endpoint              | `app/api/agui/route.ts` (`POST /api/agui`)                                            | Built; gated by `ENABLE_AGUI_ENDPOINT`; stateless; **unauthenticated** |
| Scripted demo mode (no key) | `AGUI_DEMO=true` → `lib/streaming/agui/demo.ts`                                       | Built — the $0 fallback                                                |
| AG-UI consumer              | `lib/streaming/agui/client.ts` (`consumeAguiStream`)                                  | Built — reusable on nickb.net                                          |
| Generative-UI renderer      | `components/agui/agui-generative-ui.tsx`, `use-agui-agent.ts`                         | Built — reusable/portable                                              |
| Rate-limit infra (Upstash)  | `lib/rate-limit/*` (`enforcePerMinuteLimit`, `checkAndEnforceGuestLimit`, `getRedis`) | Built — reuse for the public endpoint                                  |
| Tracing                     | Phoenix via `instrumentation.ts`                                                      | Built — tag AG-UI runs                                                 |

The endpoint is already `export const dynamic = 'force-dynamic'` with `maxDuration = 300`, so SSE works on Vercel as-is.

## Architecture — server-side proxy (recommended)

```
visitor browser (nickb.net)
   │  POST /api/agent   (no secrets in the browser)
   ▼
nickb.net server route  ──────────────►  Polymorph  POST /api/agui
   • owns visitor identity / session         • Authorization: Bearer AGUI_API_KEY
   • forwards x-visitor-id for rate-limiting  • ENABLE_AGUI_ENDPOINT gate
   • streams SSE straight back                • rate-limit + cost cap + model choice
   ◄────────────────────────────────────────  • streams AG-UI events
   ▼
AG-UI client renders (CopilotKit sidebar, or Polymorph's own consumer/renderer)
```

**Why proxy, not direct browser→Polymorph:**

- The `AGUI_API_KEY` stays **server-side** (never shipped to the browser).
- **No CORS** needed (same-origin call from the browser to nickb.net).
- nickb.net owns visitor identity, its own rate-limiting, and graceful fallback.
- Polymorph stays a clean backend; swapping it later (or A/B-ing demo mode) is trivial.

Alternative (simpler, less control): host a Polymorph **widget/iframe** and embed it on nickb.net — sidesteps porting renderers but couples the page to Polymorph's origin and styling. Recommend the proxy for a portfolio you control end-to-end.

---

## Phased roadmap

| Phase                                                    | Outcome                                               | Effort |
| -------------------------------------------------------- | ----------------------------------------------------- | ------ |
| **1 — Secure + expose `/api/agui`, embed a chat widget** | nickb.net chat is driven by the real Polymorph agent  | Med    |
| **2 — Make it demo Polymorph**                           | Canned prompts render Polymorph generative UI inline  | Med    |
| **3 — Make the agent drive the site**                    | Agent navigates / launches demos via frontend actions | Med    |

Each phase is independently shippable. Phase 1 already beats today's Q&A.

---

## Phase 1 — Secure & expose `/api/agui` + embed (the unlock)

### Polymorph work items (grounded in this repo)

1. **Bearer auth on the endpoint.** No route-level API-key auth exists today — add one. In `app/api/agui/route.ts`, before doing any work: require `Authorization: Bearer <AGUI_API_KEY>` (new env), constant-time compared (reuse `lib/utils/timing-safe`). Keep the `ENABLE_AGUI_ENDPOINT` gate. Anonymous/no-key → either `401`, or fall through to `AGUI_DEMO` scripted mode (decision below).
2. **Rate limiting + cost cap.** Reuse `lib/rate-limit/`:
   - `enforcePerMinuteLimit` keyed on a forwarded `x-visitor-id` (or IP) — burst protection.
   - A daily cap per visitor (pattern of `checkAndEnforceGuestLimit`) and a **global daily budget** kill-switch (new counter in Redis) so a viral moment can't run up an unbounded bill. Over budget → serve `AGUI_DEMO` mode instead of erroring.
3. **Cheap, bounded model for the public agent.** Add an AG-UI-specific model/effort selection (a low-cost model; cap `stopWhen`/max steps). The public agent should be a constrained variant, not the full research agent, unless you want the cost.
4. **Tool surface review.** The public agent runs whatever tools `createChatAgentTools` registers. Decide which are safe to expose publicly (e.g. search/display tools yes; anything with side effects or cost no). Trim `activeTools` for the AG-UI path.
5. **CORS (only if you ever allow direct browser calls).** Restrict to `https://nickb.net`. With the proxy, skip this.
6. **Deploy.** Set in Polymorph's Vercel prod env: `ENABLE_AGUI_ENDPOINT=true`, `AGUI_API_KEY=<secret>`, `OPENROUTER_API_KEY`, Upstash vars, and the daily budget. Verify SSE streams in prod (it's `force-dynamic`, so it should).

### nickb.net work items (contract level — separate repo)

1. **Server proxy route** (`/api/agent` or similar): accept the browser's `RunAgentInput`, attach `Authorization: Bearer AGUI_API_KEY` + an `x-visitor-id` (session cookie or hashed IP), POST to `https://<polymorph>/api/agui`, and **stream the SSE response straight through** (no buffering).
2. **The widget**: either CopilotKit's `<CopilotSidebar>` pointed at the proxy via its AG-UI/`HttpAgent` connector, **or** reuse Polymorph's own `consumeAguiStream` + `AguiGenerativeUI` (portable) for a fully on-brand UI.
3. **Replace** the existing Q&A chat with the widget; keep the old chat as a **fallback** if the agent errors or is rate-limited.

### Decisions for Phase 1

- **Anonymous visitors:** real agent (costs money, needs hard caps) vs `AGUI_DEMO` scripted mode for anonymous + real agent only behind a soft gate (e.g. a "try it" button with a per-IP cap)? Recommend: real agent with strict caps + demo-mode fallback when over budget.
- **Widget choice:** CopilotKit sidebar (fast, but its own generative-UI path) vs Polymorph's own renderer ported to nickb.net (on-brand, reuses your code, more work). Recommend starting with **Polymorph's own consumer/renderer** since it's already built and keeps the generative UI yours.

### Phase 1 acceptance

- `POST /api/agui` returns `401` without the bearer key, `404` when disabled, streams when authorized.
- Per-minute + daily + global-budget limits enforced (verified with a load test); over-budget falls back to demo mode.
- nickb.net's chat is driven by the live Polymorph agent end-to-end, with the old Q&A as fallback.

---

## Phase 2 — Make the site demo Polymorph

- Add 2–3 **canned prompts/suggestions** in the widget that trigger Polymorph's generative UI (e.g. "Show me what Polymorph can do" → agent calls `displayPlan`/`displayChart` → renders inline via the `GenerativeUI` CUSTOM events the adapter already emits).
- **Rendering decision (load-bearing):** to render Polymorph's bespoke components on nickb.net you either (a) **port/publish** `components/agui/*` + the needed `components/tool-ui/*` as a small shared package, or (b) use CopilotKit's component-render path. (a) keeps it truly "your" generative UI; (b) is faster but diverges from Polymorph's renderers.
- **Acceptance:** a visitor prompt renders a real Polymorph generative-UI component inside the portfolio.

## Phase 3 — Make the agent drive the site

- Expose page/site state to the agent (`useCopilotReadable`-style) and 2–3 **frontend actions** (navigate to a project, launch a demo, filter work). With CopilotKit that's `useCopilotAction`; with a custom client, map specific tool calls / AG-UI `CUSTOM` events to site functions.
- Optional: a confirmation step (human-in-the-loop) before destructive/navigational actions, using AG-UI's interrupt/approval pattern.
- **Acceptance:** "take me to your projects" actually navigates the site; "run a demo" launches one.

---

## Cost & abuse model (load-bearing)

A public LLM endpoint on a portfolio is a standing bill and an abuse target. Non-negotiables for Phase 1:

- **Hard global daily budget** in Redis → over it, serve `AGUI_DEMO` (free) instead of the model.
- **Per-visitor per-minute + per-day caps.**
- **Bounded agent:** cheap model, low max-steps, trimmed tool surface (no costly/side-effecting tools).
- **Input limits:** `RunAgentInputSchema` validates shape; also cap message count/length.
- **Secret hygiene:** `AGUI_API_KEY` server-side only (the proxy guarantees this).
- **Observability:** Phoenix traces tagged `surface=portfolio` so you can watch usage/cost.

## Open decisions

1. **Anonymous = real agent (capped) or demo-mode only?** (Cost vs wow.)
2. **Widget:** CopilotKit sidebar vs Polymorph's own renderer ported to nickb.net.
3. **Same Vercel project or separate?** Polymorph and nickb.net likely deploy independently — confirm the public Polymorph URL the proxy targets.
4. **Identity:** anonymous sessions only, or a lightweight "sign in to chat more" gate to control cost?

## Risks / caveats

- **Untested interop:** the endpoint is AG-UI-spec-compliant but hasn't been driven by CopilotKit/the Dojo yet — verify before committing to that widget.
- **Reliability:** a slow/flaky agent on a portfolio hurts more than a static page — the demo-mode + old-Q&A fallbacks are the safety net.
- **AG-UI churn:** AG-UI is v0.x; pin versions.
- **Two-repo coordination:** the contract between nickb.net's proxy and `/api/agui` (auth header, `x-visitor-id`) must stay in sync.

## Recommended first move

Build **Phase 1 in Polymorph only**: bearer auth + rate-limit/budget + bounded model + deploy the public endpoint, verified with the existing `/agui-demo` page hitting it through the proxy contract. That's the contained, gating piece — once it's live and safe, nickb.net is a thin client on top.

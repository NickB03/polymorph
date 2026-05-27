# AI SDK Contract Standardization: Phase 2 Plan

> **Status:** Completed historical plan. Current runtime ownership lives in `lib/agents/chat/*`, and `messages.ui_message` is the canonical persistence contract; use this document only for implementation history.

> **For agentic workers:** Use a repo-grounded execution workflow. Validate each step against the current branch state before editing. Do not widen scope beyond the files and acceptance criteria below.

**Goal:** Turn the phase 1 AI SDK contract work on branch `codex/ai-sdk-contract-phase-1` / PR `#171` into the default feature path for chat features. Phase 2 is where agent ownership, per-tool modularization, canonical `ui_message` persistence, one live specialist, and a community-portability proof become runtime reality instead of scaffolding.

## Phase 3 Gate

- Do **not** write a detailed phase 3 plan during phase 2.
- Phase 2 must end with a pass/fail decision against the acceptance criteria in this document.
- Detailed phase 3 planning is blocked until those acceptance criteria pass on the merge candidate branch.
- The only phase 3 output allowed during phase 2 is a short handoff note capturing:
  - what passed,
  - what did not pass,
  - what residual risks remain,
  - which concrete files and patterns are now stable enough to plan against.

## Current Verified State

- `lib/agents/chat/contract.ts`, `lib/agents/chat/toolset.ts`, and `lib/agents/chat/message-contract.ts` now define a shared chat contract, but `createChatAgent()` still delegates straight to `createResearcher()`.
- `lib/agents/researcher.ts` still owns mode-specific tool activation, prompt selection, search wrappers, and the practical agent runtime behavior.
- `app/api/chat/route.ts` still chooses request flow, validates guest payloads, resolves cookies and auth, derives search mode and intent, and calls the streaming helpers directly.
- `lib/streaming/create-chat-stream-response.ts` still constructs the researcher, loads canvas context, runs message preparation, does title generation, and coordinates related-questions side effects. The agent contract is present, but the stream helper is still the real orchestration layer.
- `components/chat.tsx` now uses AI SDK-native tool completion detection, but the chat client still knows about product-specific continuation surfaces and tool output bridging.
- `components/tool-ui/tool-part-registry.tsx` centralizes tool-part rendering, but the actual per-tool behavior still lives partly in the registry and partly in `components/tool-ui/registry.tsx`.
- `lib/db/schema.ts` now includes `messages.ui_message`, and `lib/utils/message-mapping.ts` can round-trip canonical UI messages, but `lib/db/actions.ts` still dual-writes the legacy `parts` table and still loads `parts` eagerly.
- `lib/tools/` remains mostly flat top-level files such as `display-option-list.ts`, `display-question-wizard.ts`, `generate-image.ts`, `create-canvas-artifact.ts`, and `fetch.ts`; the tool contract exists, but the file layout still makes every new tool feel bespoke.
- `lib/agents/chat/specialists.ts` currently contains a proof fixture, not a live specialist flow.
- `docs/architecture/GENERATIVE-UI.md` still documents the local “AI SDK + bespoke renderer path” as the default integration story. That documentation becomes incorrect once phase 2 succeeds.

## Phase 2 Outcomes

- Agent ownership becomes explicit and local to `lib/agents/chat/*` instead of being spread across `app/api/chat/route.ts`, `lib/streaming/*`, and `lib/agents/researcher.ts`.
- New tool work lands through a predictable per-tool module shape, with compatibility wrappers only where needed to reduce migration churn.
- `messages.ui_message` becomes the canonical read/write contract; `parts` remains a compatibility projection until phase 3 planning decides whether it can shrink further.
- One specialist is live, user-reachable, and exercised through the real orchestrator path.
- One externally inspired AI SDK/community workflow is ported without core-plumbing edits, proving the new contract is actually reusable.

## Out Of Scope

- Writing a detailed phase 3 plan.
- Shipping a large specialist catalog.
- Replacing every existing tool UI component with a new visual design.
- Removing the `parts` table in phase 2.
- Changing provider registry behavior in `lib/utils/registry.ts` or evals architecture in `services/evals`.
- Adopting a third-party UI runtime wholesale.

## Workstream 1: Agent Ownership And Route Delegation

**Problem:** The new contract exists, but the real ownership boundary is still split between `app/api/chat/route.ts`, `lib/streaming/create-chat-stream-response.ts`, and `lib/agents/researcher.ts`.

**Target state:** Route code handles auth, limits, and request normalization; agent modules own prompts, tool sets, step limits, side-channel hooks, and stream creation.

**Primary file targets:**

- Modify `app/api/chat/route.ts`
- Modify `lib/streaming/create-chat-stream-response.ts`
- Modify `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Modify `lib/streaming/helpers/prepare-messages.ts`
- Modify `lib/agents/chat/contract.ts`
- Modify `lib/agents/researcher.ts`
- Add `lib/agents/chat/search.ts`
- Add `lib/agents/chat/research.ts`
- Add `lib/agents/chat/build.ts`
- Add `lib/agents/chat/route-handler.ts`
- Add `lib/agents/chat/registry.ts`

**Plan:**

- Extract the current mode-specific behavior from `lib/agents/researcher.ts` into explicit agent modules:
  - `search.ts` for the current chat/search behavior,
  - `research.ts` for the current research behavior,
  - `build.ts` for the current build-intent path that still maps to `SearchMode = 'chat'` plus `intent = 'build'`.
- Keep `lib/agents/researcher.ts` as a compatibility shim only during the migration. By the end of phase 2 it should either:
  - delegate to the new modules with no unique logic of its own, or
  - be removed from the hot path entirely.
- Move agent selection into `lib/agents/chat/registry.ts`, keyed by a stable agent identifier derived from `userMode`, `searchMode`, and `intent`.
- Add `lib/agents/chat/route-handler.ts` as the boundary that receives validated request context and returns the configured streaming response for authenticated and guest flows.
- Reduce `app/api/chat/route.ts` to:
  - request parsing,
  - auth and rate-limit checks,
  - file validation,
  - search-mode/model resolution,
  - delegation to the agent route handler.
- Reduce `lib/streaming/create-chat-stream-response.ts` and `lib/streaming/create-ephemeral-chat-stream-response.ts` to stream primitives plus cross-cutting concerns. They should not directly know which agent module owns prompts or active tools.

## Workstream 2: Per-Tool Modularization As The Default Feature Path

**Problem:** The contract is standardized, but the tool file layout is still flat and inconsistent. New work still feels like custom glue because schema, server tool, client interaction, and rendering are not grouped together.

**Target state:** A new tool is usually added by creating one folder with a stable contract shape, then registering it locally.

**Primary file targets:**

- Modify `lib/agents/chat/toolset.ts`
- Modify `components/tool-ui/tool-part-registry.tsx`
- Modify `components/tool-ui/registry.tsx`
- Modify `components/chat.tsx`
- Modify `lib/types/ai.ts`
- Modify `lib/types/dynamic-tools.ts`
- Add folders under `lib/tools/` for the highest-value migrated tools:
  - `lib/tools/fetch/`
  - `lib/tools/display-option-list/`
  - `lib/tools/display-question-wizard/`
  - `lib/tools/display-citations/`
  - `lib/tools/display-link-preview/`
  - `lib/tools/generate-image/`
  - `lib/tools/create-canvas-artifact/`
  - `lib/tools/update-canvas-artifact/`
  - `lib/tools/read-canvas-artifact/`
- Reuse the existing `lib/tools/search/` directory and align its exports with the same contract shape.

**Required module shape for migrated tools:**

- `schema.ts` for Zod input/output contracts.
- `server.ts` for the AI SDK `tool()` or `dynamicTool()` export.
- `client.tsx` when the tool requires browser-side resolution or interaction.
- `result.tsx` when the tool has a dedicated rendered result block.
- `index.ts` for the public contract consumed by the agent registry.

**Plan:**

- Start with the tools that currently force the most bespoke behavior:
  - `displayOptionList`,
  - `displayQuestionWizard`,
  - `displayCitations`,
  - `displayLinkPreview`,
  - canvas tools,
  - image generation.
- Use compatibility re-export files during the move so imports like `@/lib/tools/display-option-list` continue to work while the call sites are migrated incrementally.
- Move interactive-tool behavior out of global render logic and into the tool modules:
  - parsing,
  - client submission shape,
  - result rendering,
  - completion behavior.
- Make `components/tool-ui/tool-part-registry.tsx` a dispatcher, not the place where tool-specific state machines live.
- Keep `components/tool-ui/registry.tsx` as a compatibility facade if needed, but the stable source of truth should be the per-tool module contract.

## Workstream 3: Canonical `ui_message` Adoption And Legacy Projection Cleanup

**Problem:** `messages.ui_message` exists, but the repo still behaves as if the `parts` table is the primary persistence model.

**Target state:** `messages.ui_message` is the canonical source of truth for read/write flows. `parts` is maintained only as a derived compatibility projection while phase 3 is still undefined.

**Primary file targets:**

- Modify `lib/db/actions.ts`
- Modify `lib/utils/message-mapping.ts`
- Modify `lib/db/schema.ts`
- Modify `lib/db/relations.ts`
- Modify `lib/actions/chat.ts`
- Modify `lib/streaming/helpers/persist-stream-results.ts`
- Modify `lib/streaming/helpers/prepare-tool-result-messages.ts`
- Add `scripts/backfill-chat-ui-message.ts`
- Add a follow-up Drizzle migration only if schema changes are needed beyond `0020_chat_ui_message_contract.sql`

**Plan:**

- Change the default load path so chat reads operate from `messages.ui_message` first and only reconstruct from `parts` when `ui_message` is null.
- Keep dual-write temporarily, but invert the contract:
  - `ui_message` is primary,
  - `parts` is projected from it.
- Add a one-time backfill script that reconstructs `ui_message` for existing rows where it is null by using the current mapper. Do not attempt heuristic rewrites beyond what the existing persisted parts can faithfully represent.
- Audit persistence helpers so new tools no longer require adding table columns or reconstruction branches to be storable.
- Keep transient canvas event/diagnostic behavior unchanged unless the message contract requires a narrow fix; phase 2 is not the place to redesign transient data semantics.

## Workstream 4: Replace The Specialist Fixture With One Live Specialist

**Problem:** The specialist surface exists only as a fixture. There is no real proof that the orchestrator can call a sub-agent with structured output and a dedicated renderer.

**Target state:** One production-grade specialist is available through the real agent path, with structured input/output and a dedicated result block.

**Primary file targets:**

- Modify `lib/agents/chat/specialists.ts`
- Modify `lib/agents/chat/research.ts`
- Modify `lib/agents/prompts/search-mode-prompts.ts`
- Add `lib/agents/chat/specialists/competitor-research.ts`
- Add `components/tool-ui/competitor-research-result.tsx`
- Add specialist tests under `lib/agents/chat/__tests__/`
- Add UI tests under `components/tool-ui/__tests__/`

**Plan:**

- Use competitor research as the first live specialist because phase 1 already introduced it as the proof fixture and it cleanly exercises:
  - structured input,
  - structured output,
  - citations,
  - comparison rendering,
  - a distinct workflow from the base chat answer path.
- Register the specialist as a callable tool of the research agent instead of wiring it as a second top-level route.
- Keep the specialist registry curated. Phase 2 should ship one real specialist, not five partially overlapping ones.
- Ensure the specialist has its own renderer and does not require special-case logic in the global message renderer.

## Workstream 5: Proof Of Community Portability

**Problem:** The migration is not complete until a community-style pattern can be ported without changing core plumbing.

**Target state:** One externally inspired AI SDK/community workflow is integrated through local adapters only.

**Primary file targets:**

- Modify the live specialist or one migrated tool module from workstreams 2 and 4
- Add a focused proof test under `lib/agents/chat/__tests__/` or `components/tool-ui/__tests__/`
- Update architecture docs once the proof is working:
  - `docs/architecture/GENERATIVE-UI.md`
  - `docs/architecture/STREAMING.md`
  - `docs/architecture/RESEARCH-AGENT.md`
  - `docs/reference/FILE-INDEX.md`

**Plan:**

- Choose one external AI SDK/community pattern that maps cleanly onto the repo’s existing surfaces. The proof should port:
  - prompt shape,
  - tool contract,
  - structured output shape,
  - presentation adapter.
- The proof must **not** require editing route-wide continuation plumbing, persistence internals, or generic renderer internals after the workstreams above are complete.
- If a proof requires core changes, phase 2 is not done; it means the contract is still not the default feature path.

## Sequencing

1. **Agent extraction first**
   - Make ownership explicit before moving tools. Otherwise the tool migration will keep leaking back into `route.ts` and `create-chat-stream-response.ts`.
2. **Migrate the highest-friction tools second**
   - Interactive tools, canvas, citations/link preview, and image generation should move before passive display tools because they currently drive most of the custom plumbing.
3. **Make `ui_message` truly canonical third**
   - Once agent and tool boundaries are stable, persistence cleanup can follow the real contract rather than chasing moving interfaces.
4. **Ship the live specialist fourth**
   - The specialist should be built on the already-migrated tool and agent contracts, not used as a forcing function before those contracts are stable.
5. **Run the portability proof last**
   - It is the audit that confirms the prior steps were sufficient.
6. **Update docs only after behavior is real**
   - Documentation should trail verified runtime behavior, not lead it.

## Acceptance Criteria

- `app/api/chat/route.ts` no longer imports or constructs the current researcher directly. It delegates to an agent-owned route handler after auth, rate-limit, and payload validation.
- `lib/streaming/create-chat-stream-response.ts` and `lib/streaming/create-ephemeral-chat-stream-response.ts` no longer select prompts or active tool lists directly.
- `lib/agents/researcher.ts` is no longer the primary ownership surface for runtime behavior. It is either removed from the hot path or reduced to a compatibility shim.
- The migrated tools listed in Workstream 2 follow the documented per-tool module shape and can be registered without editing global renderer logic beyond dispatch wiring.
- `components/tool-ui/tool-part-registry.tsx` acts as a thin dispatcher. Tool-specific client behavior lives with the tool modules.
- `lib/db/actions.ts` and the chat load paths can round-trip from canonical `messages.ui_message` storage. Legacy `parts` reconstruction is fallback-only.
- A backfill path exists for `messages.ui_message IS NULL`, and phase 2 verification includes exercising at least one backfilled row path.
- One live competitor-research specialist is user-reachable through the real research agent flow and renders through a dedicated tool/result component.
- One external AI SDK/community-inspired pattern is ported without changes to core route, streaming, or persistence plumbing after the phase 2 architecture lands.
- `docs/architecture/GENERATIVE-UI.md`, `docs/architecture/STREAMING.md`, and `docs/architecture/RESEARCH-AGENT.md` are updated to describe the new default path accurately.

## Test Plan

**Static verification**

- `bun lint`
- `bun typecheck`

**Server and agent coverage**

- Extend `app/api/chat/__tests__/route.test.ts` for delegated agent handling in authenticated and guest flows.
- Extend `lib/streaming/helpers/__tests__/prepare-messages.test.ts` and `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts` for the updated canonical persistence path.
- Add or extend tests around the new agent registry and route handler under `lib/agents/chat/__tests__/`.

**Persistence coverage**

- Extend `lib/utils/__tests__/message-mapping-ui-message.test.ts`.
- Extend `lib/utils/__tests__/message-mapping-display-tools.test.ts`.
- Add `lib/db/__tests__/` coverage for load paths that prefer `ui_message` and fallback to `parts` only when needed.
- Add a test for the `scripts/backfill-chat-ui-message.ts` path or equivalent extraction logic.

**UI coverage**

- Extend `components/chat.test.tsx` and `components/chat-request.test.ts` for the updated tool and continuation paths.
- Add targeted tests for migrated interactive tools and the specialist result component.
- Keep canvas and image-generation surfaces covered with focused regression tests rather than a giant all-up snapshot.

**Manual verification**

- Authenticated chat flow in search mode.
- Authenticated chat flow in research mode.
- Build-mode prompt path.
- Guest chat flow.
- Interactive option-list and question-wizard completion.
- Canvas create/read/update flow with progress events.
- Image generation flow.
- Live specialist invocation and render.

## Rollout And Risk Controls

- Land phase 2 behind compatibility shims where needed, but do not leave two permanent first-class architectures behind.
- Keep each workstream reviewable and revertible.
- If a tool migration starts requiring repeated edits to global renderer or persistence internals, stop and fix the local contract before continuing.
- Do not remove the legacy `parts` projection until there is evidence that canonical `ui_message` storage fully covers current product behavior.

## Inputs Required Before Any Phase 3 Planning

- A merged or merge-candidate phase 2 branch that passes the acceptance criteria above.
- Final file locations for:
  - agent registry and route handler,
  - migrated tool modules,
  - canonical persistence helpers,
  - live specialist implementation.
- Test evidence covering guest/auth, interactive tools, canvas, image generation, and the portability proof.
- A short residual-risk summary identifying what still depends on compatibility wrappers or fallback paths.

If those inputs do not exist, phase 3 planning is premature and should not be written in detail.

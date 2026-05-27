# AI SDK Contract Standardization: Phase 1 Foundation

> **Status:** Implemented on branch `codex/ai-sdk-contract-phase-1` and published in PR [#171](https://github.com/NickB03/polymorph/pull/171).
> **2026-05-26 note:** Historical context only; references to `lib/agents/researcher.ts` describe the old ownership boundary before the current `lib/agents/chat/*` split.

**Goal:** Establish AI SDK-native contracts as the primary chat/runtime boundary without breaking the current product surfaces for research UX, canvas, image generation, citations, guest chat, or authenticated chat.

## Original Phase 1 Intent

Phase 1 was intentionally foundation-first:

- introduce an agent-owned contract surface for chat tools and UI messages
- treat validated AI SDK `UIMessage` envelopes as the canonical transport and persistence shape
- replace bespoke continuation and rendering glue where AI SDK-native flows now exist
- preserve product-specific behavior that still differentiates the app:
  - research mode UX
  - citations / link previews
  - canvas artifacts and progress events
  - image generation

This phase was not intended to finish the full standardization. It was intended to create the contract boundary that phase 2 can build on.

## Verified Implemented Scope

### 1. Shared chat-agent contract landed

The repo now has a dedicated `lib/agents/chat/` surface:

- [contract.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/agents/chat/contract.ts)
- [toolset.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/agents/chat/toolset.ts)
- [message-contract.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/agents/chat/message-contract.ts)
- [ui-types.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/agents/chat/ui-types.ts)
- [specialists.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/agents/chat/specialists.ts)

What this changed:

- `ChatAgentTools` is now the shared tool contract instead of `researcher` being the implicit global owner.
- `createChatValidationContract()` validates incoming UI messages against a shared metadata + data-part schema.
- `ChatAgentUIMessage` / `ChatAgentUITools` are now inferred from the shared contract.
- a specialist fixture and registry surface now exist so the next phase can add a live specialist without another contract rewrite.

### 2. Researcher now composes from the shared contract

[researcher.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/agents/researcher.ts) no longer defines the global tool contract itself.

What remains bespoke in `researcher.ts` after phase 1:

- search-mode prompt selection
- request-local search pacing
- mode-specific active tool lists
- eval-mode exclusion of interactive tools

That is acceptable for phase 1. It keeps runtime behavior intact while moving the type and validation boundary into `lib/agents/chat/`.

### 3. Canonical `UIMessage` persistence landed

The `messages` table now stores the canonical message envelope directly:

- [schema.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/db/schema.ts)
- [0020_chat_ui_message_contract.sql](/Users/nick/.codex/worktrees/3a35/vana-v2/drizzle/0020_chat_ui_message_contract.sql)
- [message-mapping.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/utils/message-mapping.ts)

What changed:

- `messages.ui_message` was added as `jsonb`
- DB writes now persist the full canonical `UIMessage`
- DB reads now prefer `ui_message` as the source of truth and only fall back to legacy part reconstruction when necessary

This is the most important structural change in phase 1. New features no longer need to depend on legacy per-part reconstruction as the primary contract.

### 4. Transport and continuation moved closer to AI SDK-native flows

The chat transport now prefers canonical `messages` payloads:

- [route.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/app/api/chat/route.ts)
- [chat-request.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/components/chat-request.ts)
- [prepare-messages.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/streaming/helpers/prepare-messages.ts)
- [create-chat-stream-response.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/streaming/create-chat-stream-response.ts)
- [create-ephemeral-chat-stream-response.ts](/Users/nick/.codex/worktrees/3a35/vana-v2/lib/streaming/create-ephemeral-chat-stream-response.ts)

What changed:

- request normalization now prefers `messages`
- the legacy single `message` shape remains only as a compatibility fallback when `messages` is absent
- guest and authenticated paths both validate normalized messages before model conversion
- continuation now flows through validated message state instead of the earlier custom rewrite path being the default

### 5. Tool rendering was reduced to a registry seam

Rendering logic moved out of the global message renderer into a dedicated tool-part helper:

- [tool-part-registry.tsx](/Users/nick/.codex/worktrees/3a35/vana-v2/components/tool-ui/tool-part-registry.tsx)
- [render-message.tsx](/Users/nick/.codex/worktrees/3a35/vana-v2/components/render-message.tsx)

What changed:

- `displayOptionList` and `displayQuestionWizard` interactive flows now resolve through the tool-part registry seam
- research-mode suppression for citations / link previews is still preserved
- generic tool output rendering remains available through the existing Tool UI registry

This is still not the final per-tool folder model, but it is no longer a large inline special-case block inside `render-message.tsx`.

### 6. Client auto-continuation now uses AI SDK-native completion checks

[chat.tsx](/Users/nick/.codex/worktrees/3a35/vana-v2/components/chat.tsx) now uses:

- `lastAssistantMessageIsCompleteWithToolCalls`
- `addToolOutput`

This replaced the previous custom “fire once, rewrite request, continue” path as the normal continuation mechanism for interactive tools.

## Acceptance Criteria Status

- [x] A shared chat-agent contract exists and owns tool typing plus UI message validation.
- [x] Canonical `UIMessage` storage exists and is preferred on round-trip reads.
- [x] Interactive tool continuations now follow AI SDK-native completion flow in the client.
- [x] Rendering is thinner than before and has a dedicated tool-part registry seam.
- [x] A specialist surface exists and includes one proof fixture.
- [x] Existing search, fetch, citations, guest/auth chat, canvas, and image-generation behavior still has an integration path after the migration.
- [ ] A new community pattern can be dropped in with only local adapters.
  - Not proven yet. Phase 2 must ship the first real portability proof.
- [ ] All remaining runtime ownership is agent-local.
  - Not finished yet. `app/api/chat/route.ts`, `create-chat-stream-response.ts`, and `researcher.ts` still coordinate too much.

## Validation Run

The phase 1 branch was verified with:

- `bun run typecheck`
- `bun run test -- app/api/chat/__tests__/route.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts components/chat.test.tsx components/chat-request.test.ts lib/actions/__tests__/chat.test.ts lib/utils/__tests__/message-mapping-ui-message.test.ts lib/agents/chat/__tests__/specialists.test.ts`

## Known Gaps And Explicit Non-Goals

Phase 1 intentionally did **not** complete the following:

- split the remaining runtime into explicit agent-owned server wrappers
- convert the current flat `lib/tools/*` surface into per-tool contracts
- ship a live specialist with real orchestration and renderer support
- prove community portability by porting an external AI SDK pattern end to end
- remove legacy compatibility paths for older stored messages

Those are phase 2 concerns, not phase 1 defects.

## Phase 2 Handoff

Phase 2 should treat this branch state as the baseline and should not revisit the phase 1 contract decision.

Phase 2 should:

- make the shared chat-agent contract the default path for new work
- modularize real tool verticals behind local contracts
- adopt canonical `ui_message` storage as the normal persisted read/write path
- ship one live specialist
- prove that one external AI SDK/community pattern ports in without core runtime surgery
- write detailed phase 3 planning only after phase 2 acceptance criteria pass

The phase 2 execution document is [2026-04-23-ai-sdk-contract-standardization-phase-2.md](/Users/nick/.codex/worktrees/3a35/vana-v2/docs/superpowers/plans/2026-04-23-ai-sdk-contract-standardization-phase-2.md).

# AI SDK Contract Standardization: Phase 3 Revalidation

> **Status:** Completed/superseded historical plan. `messages.ui_message` is now canonical and migration `0025` removed the legacy `parts` table; use this document only for implementation history.

## Verified Current State

- Current checkout starts from `origin/main` / `main` at `506674f Fix evals dashboard stale suite links`.
- `git ls-tree` and `git log --all --full-history` did not find a committed `docs/superpowers/plans/2026-04-27-ai-sdk-contract-standardization-phase-3.md` before this restoration.
- Phase 2 source files are present:
  - `lib/agents/chat/route-handler.ts`
  - `lib/agents/chat/registry.ts`
  - `lib/agents/chat/factory.ts`
  - `lib/agents/chat/toolset.ts`
  - `lib/utils/message-mapping.ts`
  - `lib/db/actions.ts`
  - `components/tool-ui/registry.tsx`
  - `components/tool-ui/tool-part-registry.tsx`
- `lib/db/schema.ts` contains `messages.ui_message` and the legacy `parts` table.
- `lib/db/actions.ts` loads canonical `messages.ui_message` first and only queries legacy `parts` rows for messages where `uiMessage` is null.
- `services/evals/src/sampler.ts` has already moved its row mapping to a `ui_message`-first reader model. Its SQL still references `parts` for legacy eligibility/projection fallback, so the `parts` table must remain while this bridge exists.
- Root `vitest.config.mts` still excludes `services/**`, so eval sampler coverage must be run from `services/evals`.
- `node_modules` may be absent in fresh Codex worktrees; run `bun install --frozen-lockfile` before treating test-command failures as source failures.

## Decision

The old Phase 3 plan was directionally valid, but stale as an implementation artifact:

- It said the eval sampler still needed to be moved to `ui_message`; current source has already done that.
- It was never committed at the requested path in the current repo history.
- Current source can sample `ui_message`-only rows without legacy projection rows, but the sampler SQL still touches the `parts` table. The current safe first slice is therefore to stop new app-side legacy `parts` projection writes while keeping the table and fallback readers intact.

## Implemented First Slice

This branch starts Phase 3 with the smallest persistence change:

- `upsertMessage()` stores the canonical `messages.ui_message` payload and clears stale legacy `parts` projection rows for that message.
- `createChatWithFirstMessageTransaction()` stores the first message as canonical `messages.ui_message` only.
- New chat/message writes no longer insert derived rows into `parts`.
- Legacy `parts` fallback reads remain for rows whose `messages.ui_message` is null.
- `services/evals/src/sampler.ts` keeps SQL `parts` references as a read-only bridge, but package-local tests cover `ui_message`-only rows with no legacy projections and canonical unsupported-tool prefiltering before the random sample limit.
- Chat detail reloads read directly from canonical DB rows instead of the prior short-lived `unstable_cache` wrapper, after browser QA showed a persisted canvas update could otherwise reload as a stale transcript.
- AI SDK v6 interactive tool continuations are normalized back to the server's `tool-result` trigger when `useChat` resubmits a completed assistant tool-output message.
- The `parts` table and RLS policies remain in place; schema removal is a later deliberate migration, not part of this slice.

This avoids the dangerous half-state where current app writes continue to maintain two first-class persistence contracts.

## Current Non-Goals

- Do not drop the `parts` table.
- Do not remove `loadCompatibilityPartsByMessageId()` until the team decides old local rows and the backfill script can go away.
- Do not remove `scripts/backfill-chat-ui-message.ts` in this slice.
- Do not broaden into Tool UI registry cleanup, render-message cleanup, flat tool wrapper deletion, or agent shim deletion.
- Do not change `services/evals` architecture.

## Trackable Todo List

### Current Persistence Slice

- [x] Restore the missing Phase 3 plan file in this branch's working tree.
- [x] Verify current source state against committed `origin/main` before implementation.
- [x] Stop app-side dual-writing of derived `parts` rows for canonical message writes.
- [x] Keep legacy `parts` fallback reads and the table/schema in place.
- [x] Add DB action coverage proving canonical writes do not insert legacy projections.
- [x] Add `services/evals` sampler coverage for `ui_message`-only rows with no legacy projection columns.
- [x] Fix sampler SQL so canonical unsupported tool parts are filtered before the random sample limit.
- [x] Update architecture/reference docs that still described `parts` as dual-written.
- [x] Fix AI SDK v6 interactive tool continuation request mapping after reload.
- [x] Remove stale chat-detail caching from persisted chat reloads.
- [x] Run root format, lint, typecheck, and full root test suite.
- [x] Run package-local `services/evals` typecheck and full test suite.
- [x] Run browser QA for authenticated search chat create/reload/regenerate.
- [x] Run browser QA for interactive tool continuation after reload.
- [x] Run browser QA for canvas create/read/update/reload.
- [x] Run guest chat sanity QA.
- [x] Commit this persistence slice on a real branch.
- [x] Open or update the PR with the verification evidence above.

### Remaining Phase 3 Cleanup

- [ ] Decide whether to keep `scripts/backfill-chat-ui-message.ts` as a maintenance utility or delete it.
- [ ] Decide when old local rows with `messages.ui_message IS NULL` no longer matter.
- [ ] Remove or narrow `loadCompatibilityPartsByMessageId()` after legacy-row support is no longer needed.
- [ ] Remove or narrow SQL-side `parts` fallback/projection queries in `services/evals/src/sampler.ts`.
- [ ] Keep `parts` table schema until all active code no longer reads it.
- [ ] Plan a separate Drizzle migration for eventual `parts` table removal, if desired.
- [ ] Migrate the next small display-tool batch (`display-plan`, `display-table`, `display-chart`, `display-callout`, `display-timeline`) only with server/UI parity tests.
- [ ] Treat `display-geo-map` as its own later slice.
- [ ] Narrow or remove the `lib/agents/researcher.ts` shim only after `lib/streaming/eval-chat-runner.ts` can use the chat registry/factory directly with identical behavior.
- [ ] Add `displayQuestionWizard` continuation and reload coverage before deleting interactive-tool fallbacks.
- [ ] Reduce `components/render-message.tsx` compatibility paths one proven render contract at a time.

## Remaining Phase 3 Workstreams

### Workstream 1: Persistence Contract Completion

Current status: in progress.

Completed in this slice:

- Stop app-side dual-writing of `parts` for new and updated canonical messages.
- Add DB action tests proving canonical writes do not insert legacy projections.

Still remaining:

- Decide whether to keep or delete the backfill utility.
- Decide when to delete `loadCompatibilityPartsByMessageId()` and legacy reconstruction tests.
- Remove or narrow SQL-side `parts` fallback/projection in `services/evals/src/sampler.ts` once the team is ready to stop supporting legacy sampled rows.
- Run authenticated browser QA for persisted/reloaded chat, tool results, and canvas flows before any broader persistence cleanup.

### Workstream 2: Legacy Load And Backfill Cleanup

Purpose: remove old-row support only after the team accepts that local legacy rows do not matter.

Allowed next actions:

- Keep the script as a low-debt maintenance utility, or delete it with tests updated.
- Remove compatibility read fallback only after current reload and eval coverage passes without it.
- Keep schema removal for a separate migration.

### Workstream 3: Tool Module Contract Cleanup

Purpose: reduce active flat-tool and global-registry coupling without changing product behavior.

Candidate batch:

- `display-plan`
- `display-table`
- `display-chart`
- `display-callout`
- `display-timeline`

Keep `display-geo-map` separate because it has broader schema and map-rendering surface.

### Workstream 4: Agent Compatibility Shim Narrowing

Purpose: remove old `researcher` naming where runtime ownership has moved to `lib/agents/chat/*`.

Guardrail:

- Touch `lib/streaming/eval-chat-runner.ts` only if behavior stays identical and direct chat registry/factory usage is covered by tests.

### Workstream 5: Render Compatibility Reduction

Purpose: convert proven render special cases into named contracts while keeping user-facing rendering stable.

Guardrails:

- Do not rewrite `components/render-message.tsx` wholesale.
- Keep successful `readCanvasArtifact` output non-renderable.
- Keep `not_found` and `output-error` read outputs visible.
- Add `displayQuestionWizard` persistence/continuation/reload coverage before deleting interactive fallbacks.

## Verification Matrix

Required for the persistence slice:

- `bun run test -- --run lib/db/__tests__/chat-ui-message-load.test.ts`
- `cd services/evals && bun run test -- src/sampler.test.ts`
- `bun run typecheck`

Recommended before signoff:

- `bun run lint`
- `bun run test -- --run lib/utils/__tests__/message-mapping-ui-message.test.ts lib/utils/__tests__/message-mapping-display-tools.test.ts`
- Browser QA for authenticated search chat reload, interactive tool continuation after reload, canvas create/read/update reload, and guest chat sanity.

## Acceptance Criteria

- New app writes persist canonical `messages.ui_message` without inserting derived `parts` rows.
- Existing rows with `uiMessage: null` can still use the legacy fallback until the explicit cleanup slice removes it.
- Traffic-monitor eval sampling works from `ui_message`-only rows, even when legacy `parts` projection columns are null.
- Any later compatibility deletion is tied to an import audit, focused tests, and browser QA for the affected surface.

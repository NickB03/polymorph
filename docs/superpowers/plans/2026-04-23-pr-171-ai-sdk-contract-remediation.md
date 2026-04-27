# PR 171 AI SDK Contract Remediation Plan

> **For agentic workers:** Validate all claims against the exact PR ref `origin/main...origin/pr/171` before editing. Do not advance to phase 2 until every acceptance criterion in this document passes on the merge-candidate branch.

**Goal:** Turn PR 171 into a mergeable phase-1 baseline by removing unrelated scope, fixing the new chat/runtime regressions, and re-verifying guest and authenticated chat behavior end to end.

## Current Verified Blockers

- PR 171 is not clean phase-1 scope. `git rev-list --reverse --oneline origin/main..origin/pr/171` shows nine unrelated eval/dashboard commits before the two AI SDK phase-1 commits, and the PR diff still includes `services/evals/*`, `lib/evals/*`, and `components/evals/*` paths.
- Local verification reproduces concrete failures:
  - `bun run format:check` fails on:
    - `lib/agents/chat/contract.ts`
    - `lib/agents/chat/message-contract.ts`
    - `lib/agents/researcher.ts`
  - `bun run test -- lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts app/api/chat/__tests__/route.test.ts components/chat-request.test.ts components/chat.test.tsx lib/utils/__tests__/message-mapping-ui-message.test.ts lib/agents/chat/__tests__/specialists.test.ts` fails in `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts` because the new UI-message validation path rejects messages whose `metadata` field is omitted before the guest stream reaches the researcher/canvas hooks.
- The new authenticated submit path now accepts client-supplied history as the model input source for existing chats instead of loading canonical history from the database first.
- The phase docs already describe PR 171 as an implemented baseline even though the branch is still red and the behavioral regressions above are unresolved.

## Desired End State

- PR 171 contains only AI SDK contract phase-1 work.
- The new validation contract accepts the repo's existing message shape, including messages with no `metadata`.
- Existing authenticated chat submissions use trusted server-side history as the primary context source.
- Guest chat, interactive tool continuation, canvas, and image-generation flows still work after the contract cleanup.
- Phase 1 remains blocked until CI and the targeted manual matrix pass on the cleaned branch.

## Out Of Scope

- Starting phase 2 implementation work
- Shipping a live specialist
- Per-tool folderization from the phase-2 plan
- Evals/dashboard cleanup unrelated to restacking PR scope
- Rewriting the overall chat architecture beyond what is required to restore phase-1 correctness

---

## Worker Completion Protocol

- [ ] Reproduce the current task's failing command or codepath on `origin/pr/171` before editing. Do not patch speculatively.
- [ ] Work from an attached remediation branch created from `origin/main`. Do not keep working from detached `HEAD`, and do not reuse `codex/ai-sdk-contract-phase-1` while another worktree already owns it.
- [ ] Make the smallest scoped code/doc change that resolves the verified failure without widening beyond AI SDK phase-1 remediation.
- [ ] Run the task-local tests named in that task until they pass before moving on.
- [ ] Keep the task open if any targeted test, static check, or manual verification row for the touched surface is still failing.
- [ ] Do not declare the remediation complete until Task 5 passes in full: cleaned branch scope, static checks, full test suite, targeted regression subset, PR/CI verification, and the affected manual matrix rows.

## Task 1: Restack PR 171 To AI SDK Phase-1-Only Scope

**Problem:** The current branch contains AI SDK phase-1 work plus unrelated eval/dashboard commits, so the PR cannot be reviewed or merged as a phase-1 baseline.

**Files and surfaces to validate:**

- Git history for `origin/main..origin/pr/171`
- PR diff for `origin/main...origin/pr/171`
- Any AI SDK docs that currently reference PR 171 as the phase-1 baseline

**Plan:**

- [ ] Capture the exact stack before editing with `git rev-list --reverse --oneline origin/main..origin/pr/171`; treat the eval/dashboard commits as unrelated scope and the AI SDK phase-1 commits as the only changes to carry forward or rewrite.
- [ ] Create a clean attached remediation branch from `origin/main` for the work. Do not keep working from detached `HEAD`, and do not reuse `codex/ai-sdk-contract-phase-1` while another worktree already has it attached.
- [ ] Carry forward only the AI SDK phase-1 commits or their equivalent file changes, including the phase docs and this remediation plan if the phase docs link to it.
- [ ] Remove the unrelated eval/dashboard changes from the PR scope instead of trying to justify them as part of phase 1.
- [ ] If any chat change depends on one of the stacked eval commits, re-implement only the narrow dependency in chat-owned files rather than keeping the broader eval stack.
- [ ] Choose the PR handoff before code changes finish: either force-update `origin/codex/ai-sdk-contract-phase-1` / PR 171 after verification or open a replacement PR and update the docs to point to that branch.
- [ ] Re-check the cleaned diff with:
  - `git status --short --branch`
  - `git rev-list --reverse --oneline origin/main..HEAD`
  - `git log --oneline origin/main..HEAD`
  - `git diff --name-only origin/main...HEAD`
- [ ] Confirm the cleaned branch no longer includes:
  - `services/evals/*`
  - `lib/evals/*`
  - `components/evals/*`
- [ ] Confirm any remediation-plan cross-link resolves on the branch because this file is tracked there.

**Why this is necessary:**

- The phase-1 plan is explicitly about AI SDK contract standardization. A stacked branch prevents accurate review, makes the acceptance criteria meaningless, and risks merging unrelated behavior under the wrong approval surface.

## Task 2: Repair The New Validation Boundary

**Problem:** The shared validation contract is directionally correct, but the new `validateUIMessages()` boundary is stricter than the repo's actual stored/requested message shape. Current messages can omit `metadata`, and the new path crashes before streaming begins.

**Primary files:**

- Modify `lib/agents/chat/message-contract.ts`
- Modify `lib/agents/chat/contract.ts` for formatting cleanup only
- Modify `lib/agents/researcher.ts` for formatting cleanup only
- Add `lib/agents/chat/__tests__/message-contract.test.ts`
- Extend `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`
- Extend `app/api/chat/__tests__/route.test.ts` only if request-boundary coverage is needed after the helper/stream tests are green

**Plan:**

- [ ] Fix the formatting failures in:
  - `lib/agents/chat/contract.ts`
  - `lib/agents/chat/message-contract.ts`
  - `lib/agents/researcher.ts`
- [ ] Reproduce the current validation failure first with `bun run test -- lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`.
- [ ] Change the validation boundary so omitted `metadata` is treated as valid input rather than a hard failure.
- [ ] Preserve schema validation when `metadata` is present; do not weaken the contract into `any`.
- [ ] Do not modify persistence or message-mapping code to inject empty metadata objects; accept omitted `metadata` at the validation boundary only.
- [ ] Add a direct contract test that proves omitted `metadata` is accepted while malformed `metadata` is still rejected.
- [ ] Add regression coverage for guest/auth message payloads that omit `metadata`, using helper/stream tests as the primary proof surface.
- [ ] Re-run the failing guest-stream tests after the validator change and keep this task open until `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts` passes.

**Why this is necessary:**

- The phase-1 branch cannot claim preserved guest/auth behavior while the first validation step rejects the repo's normal message shape.

## Task 3: Restore Trusted History For Authenticated Existing Chats

**Problem:** Existing authenticated submits now flow through client-supplied `messages` as the primary context source. That breaks the prior server-trusted history model and allows earlier conversation state to diverge from persisted chat history.

**Primary files:**

- Modify `components/chat-request.ts`
- Extend `components/chat-request.test.ts`
- Modify `app/api/chat/route.ts`
- Modify `lib/streaming/create-chat-stream-response.ts`
- Modify `lib/streaming/helpers/prepare-messages.ts`
- Add `lib/streaming/__tests__/create-chat-stream-response.test.ts` or an equivalent authenticated stream test
- Extend `lib/streaming/helpers/__tests__/prepare-messages.test.ts`
- Extend `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`
- Extend `app/api/chat/__tests__/route.test.ts` only if request-boundary assertions need to change

**Plan:**

- [ ] Verify the regression on the authenticated `submit-message` path for existing chats; do not widen the fix to `tool-result` continuations that already rebuild from server-side chat state via `prepareToolResultMessages()`.
- [ ] Keep guest flows capable of sending canonical `messages`, because guest chat does not have a persisted chat history to reload from.
- [ ] Keep the AI SDK continuation behavior for interactive tools, but narrow where full client message arrays are trusted.
- [ ] For authenticated existing-chat submit flows, restore a server-sourced history path as the primary model context source.
- [ ] Narrow both the model-context path and any `createUIMessageStream({ originalMessages })` usage for authenticated existing-chat submits so arbitrary prior client history no longer drives AI SDK finish/persistence behavior.
- [ ] If the last client message must still be persisted before streaming, merge only that last message or a narrowly verified assistant tool-output update into canonical DB history instead of replacing the whole history with the client array.
- [ ] Add a helper-level regression test that proves a tampered earlier client message does not replace stored history for authenticated chats.
- [ ] Add a positive regression test that the intended tool-output continuation still works after the narrowing, using `prepare-messages.test.ts` and `prepare-tool-result-messages.test.ts` as the primary proof surfaces.
- [ ] Add request-shape coverage in `components/chat-request.test.ts` so guest and authenticated existing-chat submits cannot silently drift back to the same contract.

**Why this is necessary:**

- Phase 1 was supposed to standardize contracts without breaking authenticated chat behavior. Trusting full client history on existing chats changes the trust boundary, not just the transport shape.

## Task 4: Correct The Phase-1 Status Story

**Problem:** The current docs already describe PR 171 as implemented and ready for phase-2 handoff even though the merge candidate is not yet correct.

**Primary files:**

- Modify `docs/superpowers/plans/2026-04-23-ai-sdk-contract-standardization-phase-1.md`
- Modify `docs/superpowers/plans/2026-04-23-ai-sdk-contract-standardization-phase-2.md`
- Modify `docs/superpowers/plans/2026-04-23-pr-171-ai-sdk-contract-remediation.md` if phase 1 links to it

**Plan:**

- [ ] Change the phase-1 doc status from "implemented" to a blocked/in-remediation state until the cleaned branch is green.
- [ ] Update any text that treats PR 171 as the accepted baseline before remediation is complete.
- [ ] Rewrite or remove the current phase-1 `Acceptance Criteria Status`, `Validation Run`, and `Phase 2 Handoff` sections so they no longer present PR 171 as already accepted.
- [ ] Keep the phase-2 document as a future plan, but explicitly restate that phase-2 work is blocked on phase-1 remediation.
- [ ] Replace worktree-specific absolute file links in the phase docs and this remediation plan with portable repo-relative references or plain code paths while touching the docs.
- [ ] If phase 1 references this remediation plan, make sure this file is tracked on the remediation branch before calling the docs done.

**Why this is necessary:**

- The plan artifacts should reflect actual repo state. They should not be used to justify phase advancement while the baseline branch is still failing.

## Task 5: Re-Verify Phase-1 Acceptance Before Any Phase Advancement

**Problem:** Even after the code fixes land, the branch should not advance unless the cleaned phase-1 surface passes a targeted validation matrix.

**Primary verification surfaces:**

- `bun format:check`
- `bun lint`
- `bun typecheck`
- `bun run test`
- Targeted chat/runtime tests:
  - `app/api/chat/__tests__/route.test.ts`
  - `lib/agents/chat/__tests__/message-contract.test.ts`
  - `lib/streaming/helpers/__tests__/prepare-messages.test.ts`
  - `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`
  - `lib/streaming/__tests__/create-chat-stream-response.test.ts`
  - `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`
  - `components/chat.test.tsx`
  - `components/chat-request.test.ts`
  - `components/render-message.test.tsx`
  - `lib/utils/__tests__/message-mapping-ui-message.test.ts`
  - `lib/utils/__tests__/message-mapping-display-tools.test.ts`
  - `lib/agents/__tests__/researcher.test.ts`

**Manual verification matrix:**

- [ ] Authenticated new chat in search mode
- [ ] Authenticated existing chat submit flow
- [ ] Guest chat submit flow
- [ ] Authenticated research-depth intake prompt that must trigger `displayOptionList`, then resume correctly after selection
- [ ] Guest research-depth intake prompt that must trigger `displayOptionList`, then resume correctly after selection
- [ ] Authenticated broad build prompt that must trigger `displayQuestionWizard`, then resume into artifact creation
- [ ] Guest broad build prompt that must trigger `displayQuestionWizard`, then resume into artifact creation
- [ ] Authenticated image-generation flow
- [ ] Guest image-generation flow
- [ ] Guest canvas continuity: create artifact, observe compile-progress, then read/update after token rotation and confirm the artifact reloads correctly on `ready` or `compile_failed`

**Plan:**

- [ ] Run the static checks after the remediation changes land.
- [ ] After Task 2, run `bun run test -- --run lib/agents/chat/__tests__/message-contract.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts` before starting Task 3.
- [ ] After Task 3, run `bun run test -- --run components/chat-request.test.ts app/api/chat/__tests__/route.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts` before doc/status updates.
- [ ] Extend the focused regression suite wherever coverage is missing before claiming the matrix is satisfied:
  - add `displayQuestionWizard` continuation coverage to `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`
  - add `displayQuestionWizard` persistence coverage to `lib/utils/__tests__/message-mapping-display-tools.test.ts`
  - add `addToolResult` and generated-image render/dedupe coverage to `components/render-message.test.tsx`
- [ ] Run the full main test suite with `bun run test`, not only the originally listed subset.
- [ ] Re-run the targeted chat/runtime tests above with `bun run test -- --run <path...>` if the full suite is noisy.
- [ ] Keep every touched task open until its affected manual matrix rows are verified, not just until the code compiles.
- [ ] For each manual matrix row, record the auth state, exact prompt, expected tool, observed tool, and observed continuation result. If the intended tool never appears, that row is incomplete.
- [ ] Verify the cleaned PR diff and CI state from GitHub before declaring phase 1 complete.
- [ ] Verify the PR destination is correct: either PR 171 now points at the cleaned branch or a replacement PR is explicitly identified.
- [ ] Do not write or execute a detailed phase-2 implementation plan until this validation block passes.

---

## Acceptance Criteria

- The remediated PR diff is AI SDK phase-1-only and no longer carries unrelated eval/dashboard work.
- The remediation work is on an attached branch with an explicit PR destination, and any link to this remediation plan resolves because the file is tracked on that branch.
- `bun run format:check`, `bun run lint`, `bun run typecheck`, and the main `Test` workflow all pass.
- Messages without `metadata` validate successfully in both guest and authenticated flows, and `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts` passes.
- Existing authenticated existing-chat `submit-message` flows no longer use arbitrary client history as the canonical model context source or as the authoritative `originalMessages` stream-finish input, while `tool-result` continuations still rebuild from server-side history.
- Guest continuation, option-list/question-wizard continuation, image-generation, and canvas integration paths still work after the fixes.
- The phase docs describe the branch honestly and no longer present PR 171 as a completed baseline before verification.
- Phase 2 remains blocked until every item above passes on the merge-candidate branch.

## Recommended Execution Order

1. Restack the branch to AI SDK phase-1-only scope.
2. Fix formatting and the validation regression.
3. Restore the authenticated history trust boundary.
4. Update the phase docs to reflect blocked status.
5. Run the validation matrix and only then reconsider phase advancement.

# E2B Artifact Batch 3 — Agent Team Execution Prompt

> **Usage:** Paste this prompt into Claude Code to launch the batch 3 implementation.
> **Branch:** `feat/e2b-artifact-batch-3` (off `main` at `947e0ca`)
> **Plan:** `docs/plans/2026-03-13-e2b-artifact-mvp.md` (Tasks 8-12)

---

## Objective

Implement Tasks 8-12 of the E2B artifact MVP plan. These tasks add the frontend workspace shell, artifact rendering, error handling, guest token crypto, lifecycle tests, and verification. Tasks 1-7 (schema, persistence, types, runtime adapter, validation, tools, streaming) are already merged to `main`.

**You MUST read the full plan before starting:** `docs/plans/2026-03-13-e2b-artifact-mvp.md`

---

## Mandatory Pre-Flight

Before launching any implementation agent, run a **Plan Audit Agent** that:

1. Reads the full plan document (`docs/plans/2026-03-13-e2b-artifact-mvp.md`)
2. Reads every file listed in Tasks 8-12 that already exists (to understand the baseline)
3. Reads the batch 1-7 foundation code to understand interfaces and contracts:
   - `lib/artifacts/runtime/types.ts` — ArtifactRuntime interface
   - `lib/artifacts/tool-context.ts` — ArtifactToolContext interface
   - `lib/artifacts/validation/validate-artifact-source.ts` — validation API
   - `lib/artifacts/template-manifest.ts` — template constants
   - `lib/types/artifact.ts` — all artifact types
   - `lib/types/ai.ts` — data part types
   - `lib/db/schema.ts` — artifact tables
   - `lib/db/actions.ts` — artifact DB actions
   - `lib/streaming/helpers/write-artifact-data.ts` — emitter contract
   - `lib/tools/create-webapp-artifact.ts` — tool shape
   - `lib/tools/update-webapp-artifact.ts` — tool shape
   - `lib/tools/get-artifact-status.ts` — tool shape
   - `lib/tools/restart-artifact-preview.ts` — tool shape
   - `components/artifact/artifact-context.tsx` — current context shape
   - `components/artifact/chat-artifact-container.tsx` — current layout
   - `components/artifact/artifact-content.tsx` — current content renderer
   - `components/tool-ui/registry.tsx` — tool UI registry pattern
   - `components/chat.tsx` — chat component (will be modified by Tasks 9+10)
   - `components/render-message.tsx` — message renderer
   - `components/inspector/inspector-panel.tsx` — inspector panel
   - `components/inspector/inspector-drawer.tsx` — inspector drawer
   - `components/search-section.tsx` — search section (opens inspector)
   - `components/reasoning-section.tsx` — reasoning section (opens inspector)
4. Produces a **Baseline Report** confirming:
   - All plan-referenced existing files are present and match expected interfaces
   - No conflicts between batch 1-7 code and batch 3 plan expectations
   - The dependency graph between Tasks 8-12 is sound
   - File conflict analysis between parallel agents is clean

**Do NOT proceed to implementation until the baseline report is clean.**

---

## Execution Phases

### Phase 1 — Parallel Implementation (worktrees)

Launch two agents in parallel using isolated worktrees:

#### Agent: `workspace-shell` (Task 8)

**Specialization:** React component architecture, context/state management, responsive layouts, shadcn/ui

**Task:** Build artifact client state and workspace shell

**Files to create:**

- `app/api/artifacts/[artifactId]/actions/route.ts`
- `components/artifact/artifact-workspace.tsx`
- `components/artifact/artifact-workspace-header.tsx`
- `components/artifact/artifact-preview-frame.tsx`
- `components/artifact/artifact-logs-panel.tsx`

**Files to modify:**

- `components/artifact/artifact-context.tsx`
- `components/artifact/chat-artifact-container.tsx`
- `components/inspector/inspector-panel.tsx`
- `components/inspector/inspector-drawer.tsx`
- `components/search-section.tsx`
- `components/reasoning-section.tsx`

**Critical constraints:**

- The context refactor MUST maintain backward compatibility. `open(part)` for search/reasoning inspection MUST continue to work exactly as before. The workspace state is ADDITIVE — new `openWorkspace`/`updateWorkspace`/`closeWorkspace` actions alongside existing `open`/`close`.
- The `ArtifactUiState` shape must match the plan exactly:
  ```ts
  interface ArtifactUiState {
    inspectedPart: Part | null
    workspace: ArtifactWorkspaceState
  }
  interface ArtifactWorkspaceState {
    artifactId: string | null
    revisionId: string | null
    title: string | null
    status: ArtifactStatus | null
    previewUrl: string | null
    isOpen: boolean
  }
  ```
- Desktop split view (resizable panels, localStorage persistence, ResizeObserver bounds) and mobile drawer MUST be preserved.
- The workspace should render in the same right-side panel slot as the inspector — when workspace is open, it takes priority; when closed, inspector behavior is unchanged.
- The API route must require auth for persisted chats and validate guest artifact token for guest chats. Guest token validation should call the stub `resolveGuestArtifactToken()` from `lib/artifacts/tool-context.ts` — actual crypto is Task 10.
- `share` action is client-only (clipboard copy of `previewUrl`). Do NOT add server-side share persistence.
- Preview frame should use an iframe with the sandbox's `previewUrl`. Add appropriate sandbox attributes.
- Logs panel should display `ArtifactLogData` entries with level-based styling.

**Verification before committing:**

```bash
bun typecheck
bun lint
```

**Commit message:** `feat: add artifact workspace shell`

---

#### Agent: `backend-security` (Task 10)

**Specialization:** Backend security, cryptographic token handling, rate limiting, error handling, cleanup lifecycle

**Task:** Add artifact-specific error handling and portfolio-friendly guest behavior

**Files to create:**

- `lib/artifacts/guest-token.ts`
- `lib/rate-limit/artifact-limits.ts`
- `lib/artifacts/runtime/cleanup.ts`

**Files to modify:**

- `app/api/chat/route.ts`
- `lib/streaming/create-ephemeral-chat-stream-response.ts`

**Files to modify with tests:**

- `app/api/chat/__tests__/route.test.ts`
- `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

**DO NOT modify:** `components/chat.tsx` — this file is handled in Phase 2 to avoid conflicts with Task 9.

**Critical constraints:**

- Guest token implementation:
  - Sign tokens using HMAC-SHA256 with a server-side secret (`GUEST_ARTIFACT_SECRET` env var)
  - Token payload: `{ artifactId, runtimeSessionId, sandboxId, expiresAt }`
  - `resolveGuestArtifactToken()` must validate signature, check expiry, and return `ValidatedGuestArtifactHandle | null`
  - Successful responses MUST rotate and return a refreshed token
  - Forged or expired tokens MUST fail closed — no raw ID fallback, no trust in client-supplied identifiers
  - Token expiry aligned with cleanup so deleted resources can't be resumed
- Error codes: Define structured artifact error types for `build-failed`, `runtime-unavailable`, `preview-expired`. These should be emittable via the existing `ArtifactEmitter` as `data-artifactStatus` with appropriate status.
- Rate limiting: Use Upstash Redis (matching existing pattern in the codebase). Soft per-session limits, not hard walls. No prominent quota UI.
- Cleanup: Background-safe cleanup for expired runtime sessions and guest artifacts. Should be callable from a cron/scheduled endpoint but NOT automatically registered as one.
- All new functions MUST have JSDoc describing security invariants.

**Verification before committing:**

```bash
bun typecheck
bun lint
bun run test -- app/api/chat/__tests__/route.test.ts
bun run test -- lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts
```

**Commit message:** `feat: add artifact error handling and guest token security`

---

### Phase 2 — Sequential Integration

After Phase 1 agents complete and their changes are merged to the working branch:

#### Agent: `rendering-integration` (Task 9 + Task 10 chat.tsx)

**Specialization:** React rendering, data part mapping, useChat integration, UI state hydration

**Task:** Render artifact data parts, auto-open workspace, and wire error display in chat

**Files to create:**

- `components/tool-ui/artifact-card.tsx`

**Files to modify:**

- `components/render-message.tsx`
- `components/chat.tsx`
- `components/tool-ui/registry.tsx`

**Critical constraints:**

- Artifact card: An inline receipt card shown in the chat message flow when `data-artifact` parts arrive. Should show title, status badge, and a "View" button that opens the workspace. Follow the existing `tool-ui/` pattern (schema parse → component render → error boundary).
- Registry: Add artifact card to the tool UI registry. Follow the exact pattern of existing entries (named entry with `tryRender`).
- Auto-open workspace: When `data-artifact` or `data-artifactStatus` parts arrive in `message.parts`, call `openWorkspace()` from the artifact context (implemented in Phase 1). Reconcile by stable artifact `id` — don't open duplicates.
- `chat.tsx` changes must include BOTH:
  1. Task 9: Auto-open workspace on artifact data parts
  2. Task 10: Display artifact-specific errors inline (build-failed, runtime-unavailable, preview-expired) using the error codes from Phase 1's backend-security agent
- Transient data (`data-artifactLog`, `data-artifactEvent`) is handled via `useChat({ onData })` — it does NOT appear in `message.parts`. Route logs to `appendWorkspaceLog()` on the artifact context.
- Do NOT break existing tool-result continuation logic.
- Do NOT route generic inspector parts (search, reasoning) through the artifact renderer.

**Verification before committing:**

```bash
bun typecheck
bun lint
```

**Commit message:** `feat: render artifact cards and open workspace`

---

### Phase 3 — Testing

After Phase 2 completes:

#### Agent: `lifecycle-tests` (Task 11)

**Specialization:** Vitest, React Testing Library, test architecture, mocking patterns

**Task:** Add focused tests for artifact lifecycle behavior

**Files to create:**

- `components/chat.test.tsx`
- `components/artifact/artifact-workspace.test.tsx`
- `components/artifact/artifact-context.test.tsx`

**Files to modify (extend existing tests):**

- `lib/utils/__tests__/message-mapping-display-tools.test.ts`
- `lib/artifacts/validation/validate-artifact-source.test.ts` (if new cases needed)
- `lib/artifacts/runtime/e2b-runtime.test.ts` (if new cases needed)
- `lib/tools/__tests__/artifact-tools.test.ts` (if new cases needed — note: plan says `create-webapp-artifact.test.ts` and `update-webapp-artifact.test.ts` but existing tests are in `artifact-tools.test.ts`)
- `lib/streaming/helpers/write-artifact-data.test.ts` (if new cases needed)
- `app/api/chat/__tests__/route.test.ts`
- `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

**Required test coverage (from plan):**

1. Create artifact result shape
2. Update artifact preserves artifact id
3. Authenticated persistence stores artifact tool calls through `tool-dynamic`
4. Guest update reuses continuity only from valid signed guest token
5. Forged/expired guest tokens rejected in route and ephemeral-stream
6. Workspace opens on artifact data
7. Legacy search/reasoning inspector still opens after context refactor
8. Validation rejects template-owned file edits
9. Runtime bootstrap validation catches missing E2B configuration
10. Streaming reconciles artifact data by stable id
11. `components/chat.test.tsx` — transient artifact logs/events handled via `useChat({ onData })` without persistence
12. `components/artifact/artifact-workspace.test.tsx` — workspace header action path executes against artifact actions route

**Critical constraints:**

- Do NOT add integration tests requiring a live E2B sandbox.
- Do NOT add snapshot tests — they are brittle and not used elsewhere in this codebase.
- Mock at module boundaries (runtime adapter, DB actions, fetch), not at internal implementation details.
- Follow existing test patterns: check `lib/utils/__tests__/` and `lib/tools/__tests__/` for conventions.
- Every test file must pass individually AND as part of the full suite.

**Verification before committing:**

```bash
bun run test
bun typecheck
bun lint
```

**Commit message:** `test: cover artifact lifecycle flows`

---

### Phase 4 — Verification and Review

After Phase 3 completes:

#### Agent: `verification-and-docs` (Task 12)

**Task:** Run full verification and polish docs

1. Run `bun lint` — expect 0 errors, 0 warnings
2. Run `bun typecheck` — expect 0 errors
3. Run `bun run test` — expect all tests passing, 0 failures
4. Update `docs/plans/2026-03-13-e2b-artifact-mvp-design.md` and `docs/plans/2026-03-13-e2b-artifact-mvp.md` — ensure file paths, constraints, and sequencing match final implementation
5. Commit: `docs: finalize E2B artifact MVP plan`

---

#### Agent: `critical-review` (MANDATORY — runs after all implementation)

**Specialization:** Code review, plan compliance, security audit, scope boundary enforcement

**Task:** Comprehensive critical review of all batch 3 changes

This agent MUST run after all implementation is complete. It reads every file touched by batch 3 and produces a structured review report. The review is BLOCKING — implementation is not considered complete until the review passes.

**Review Checklist:**

##### 1. Plan Compliance

- [ ] Every file listed in Tasks 8-12 exists (no missing files)
- [ ] No files were created that aren't listed in Tasks 8-12 (no scope creep) — deviations must be explicitly justified
- [ ] `ArtifactUiState` and `ArtifactWorkspaceState` interfaces match plan spec exactly
- [ ] API route supports exactly `refresh` and `retry` actions, not more
- [ ] Guest token uses HMAC-SHA256 with fail-closed semantics
- [ ] Token rotation occurs on every successful response
- [ ] Forged/expired tokens fail closed with no raw ID fallback
- [ ] Cleanup aligns token expiry with resource deletion
- [ ] Artifact card follows tool-ui registry pattern
- [ ] Auto-open reconciles by stable artifact `id`

##### 2. Backward Compatibility

- [ ] `open(part)` for search/reasoning inspection still works after context refactor
- [ ] Inspector panel/drawer behavior unchanged for non-artifact parts
- [ ] Desktop split view responsive behavior preserved (resizable, localStorage, ResizeObserver)
- [ ] Mobile drawer behavior preserved
- [ ] Existing tool-result continuation logic in `chat.tsx` unbroken
- [ ] All 375+ existing tests still pass (no regressions)

##### 3. Security

- [ ] No raw artifact/runtime IDs trusted from client in guest flows
- [ ] Guest token secret not hardcoded (env var)
- [ ] Rate limiting uses existing Upstash pattern
- [ ] No new `as any` assertions introduced (flag if found)
- [ ] API route validates auth before any DB/runtime operations
- [ ] iframe preview uses appropriate sandbox attributes
- [ ] No XSS vectors in artifact card rendering

##### 4. Code Quality

- [ ] `bun lint` — 0 errors, 0 warnings
- [ ] `bun typecheck` — 0 errors
- [ ] `bun run test` — all pass
- [ ] No unused imports, variables, or dead code introduced
- [ ] Import order follows `simple-import-sort` convention
- [ ] No semicolons, single quotes, no trailing commas (Prettier)
- [ ] No `console.log` left in production code
- [ ] New components follow existing patterns (error boundaries, loading states)

##### 5. Scope Boundaries (CRITICAL)

- [ ] No modifications to Tasks 1-7 code (schema, runtime adapter, validation, tools, streaming helpers, message-mapping) UNLESS fixing a bug discovered during integration
- [ ] No new database tables or columns added
- [ ] No new AI SDK tool definitions added
- [ ] No new npm dependencies added to `package.json`
- [ ] No modifications to `bun.lock`
- [ ] No changes to build configuration (next.config, tsconfig, tailwind, vite)
- [ ] No changes to middleware or auth flow beyond what Task 10 specifies
- [ ] No UI for quota/rate-limit display (invisible guardrails only)
- [ ] No server-side share persistence (clipboard only)

##### 6. Test Coverage

- [ ] All 12 coverage requirements from Task 11 are addressed
- [ ] No snapshot tests
- [ ] No tests requiring live E2B sandbox
- [ ] Tests mock at module boundaries, not internals
- [ ] Each test file passes individually

**Output:** The critical-review agent must produce a structured report in the format:

```
## Critical Review Report — E2B Artifact Batch 3

### Verification Results
| Check | Result |
|-------|--------|
| bun lint | X errors, X warnings |
| bun typecheck | X errors |
| Tests (X total) | X passed, X failed |

### Plan Compliance: PASS/FAIL
[Details of any deviations]

### Backward Compatibility: PASS/FAIL
[Details of any regressions]

### Security: PASS/FAIL
[Details of any concerns]

### Code Quality: PASS/FAIL
[Details of any issues]

### Scope Boundaries: PASS/FAIL
[Details of any drift]

### Test Coverage: PASS/FAIL
[Details of any gaps]

### Final Verdict: APPROVE / CHANGES REQUIRED
[If CHANGES REQUIRED: numbered list of specific fixes needed]
```

If the verdict is CHANGES REQUIRED, fix all listed issues before proceeding.

---

## Scope Boundaries — Global Rules

These apply to ALL agents across ALL phases:

1. **Do NOT modify any file not listed in Tasks 8-12** unless fixing a bug discovered during integration (must be justified in commit message)
2. **Do NOT add npm dependencies** — everything needed is already installed
3. **Do NOT create documentation files** unless the plan specifies them
4. **Do NOT add features beyond what the plan describes** — no "nice to have" improvements
5. **Do NOT refactor pre-existing code** that isn't being modified by a task
6. **Do NOT add type annotations, comments, or docstrings** to code you didn't write
7. **Every agent must run `bun typecheck` and `bun lint` before committing** — 0 errors, 0 warnings required
8. **Follow existing code patterns** — check adjacent files for conventions before writing new code
9. **Commit messages must use conventional commits** matching the repo's existing style

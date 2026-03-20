> **Archived:** This plan describes the removed E2B artifact system. See the [canvas artifact replacement plan](../superpowers/plans/2026-03-18-canvas-artifact-replacement-implementation.md) for the current architecture.

# E2B Artifact Batch 4: Rollout Readiness

**Goal:** Take the fully-implemented artifact MVP (Tasks 1-12, merged) from code-complete to production-deployable with a feature flag, observability, code viewer, expanded template, and error recovery UX.

**Prerequisite:** All 12 MVP tasks merged on `main`. Zero outstanding TODOs in artifact code.

**Branch:** `feat/e2b-artifact-batch-4` (create from `main`)

---

## Scope Boundary (STRICT)

### In Scope — Batch 4 Only

- Feature flag gating artifact tools behind `ENABLE_ARTIFACTS`
- Environment variable documentation for `E2B_API_KEY`, `GUEST_ARTIFACT_SECRET`, `GUEST_ARTIFACT_TOKEN_TTL_MS`, `ENABLE_ARTIFACTS`
- Read-only code viewer tab in workspace (no editing)
- Template expansion with additional shadcn UI components
- Structured observability logging for artifact lifecycle
- Error recovery UX ("Ask AI to fix" on build failures)

### Explicitly Out of Scope — Do NOT Implement

- File editor / file tree
- Version history UI
- Artifact deployment/export
- Collaboration features
- Arbitrary npm install
- Vercel Sandbox adapter
- New database tables or schema changes
- Changes to guest token security model
- Changes to the E2B runtime adapter interface
- New API routes beyond what exists
- Any changes to non-artifact code (search, auth, chat core)

---

## Agent Team Structure

### Agent 1: `env-and-flag` (Backend)

**Skills:** `next-best-practices`
**Scope:** Task 13 only

**Task 13: Environment Documentation & Feature Flag**

Files to modify:

- `docs/getting-started/ENVIRONMENT.md` — add artifact env var section
- `lib/agents/researcher.ts` — gate artifact tools behind `ENABLE_ARTIFACTS`
- `lib/streaming/create-chat-stream-response.ts` — pass flag to context
- `lib/streaming/create-ephemeral-chat-stream-response.ts` — pass flag to context

Steps:

1. Add to `docs/getting-started/ENVIRONMENT.md`:
   ```
   ## Artifacts (E2B)
   - `ENABLE_ARTIFACTS` — Set to `true` to enable artifact generation tools (default: `false`)
   - `E2B_API_KEY` — E2B sandbox API key (required when artifacts enabled)
   - `GUEST_ARTIFACT_SECRET` — HMAC-SHA256 secret for signing guest artifact tokens (required when artifacts enabled)
   - `GUEST_ARTIFACT_TOKEN_TTL_MS` — Guest artifact token TTL in milliseconds (default: `1800000` / 30 minutes)
   ```
2. In `lib/agents/researcher.ts`, conditionally include artifact tools only when `process.env.ENABLE_ARTIFACTS === 'true'`
3. Run `bun typecheck` and `bun lint`
4. Run `bun run test` — no existing tests should break

**Compliance rules:**

- Do NOT change tool schemas, tool implementations, or tool behavior
- Do NOT add new tools
- Do NOT modify the researcher agent's step limits or mode logic
- The ONLY change to researcher.ts is conditional inclusion of the 4 existing artifact tools

---

### Agent 2: `template-expansion` (Backend)

**Skills:** `shadcn-ui`
**Scope:** Task 15 only

**Task 15: Template UI Component Expansion**

Files to create/modify:

- `lib/artifacts/templates/react-spa/src/components/ui/dialog.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/tabs.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/badge.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/separator.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/skeleton.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/textarea.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/label.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/select.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/switch.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/avatar.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/tooltip.tsx`
- `lib/artifacts/templates/react-spa/src/components/ui/dropdown-menu.tsx`
- `lib/artifacts/templates/react-spa/package.json` — add Radix dependencies for new components
- `lib/artifacts/template-manifest.ts` — add new component names to manifest

Steps:

1. Review existing template components (button, card, input) for style conventions
2. Create each component following the same pattern: Radix primitive + CVA + tailwind-merge
3. Each component must be self-contained with no external imports beyond Radix, React, and the existing `lib/utils`
4. Update `package.json` to include required Radix packages (e.g., `@radix-ui/react-dialog`, `@radix-ui/react-tabs`, etc.)
5. Update `template-manifest.ts` `PREINSTALLED_PACKAGES` array with new Radix packages
6. Run `bun typecheck` and `bun lint`

**Compliance rules:**

- Do NOT modify existing components (button, card, input)
- Do NOT add non-Radix dependencies
- Do NOT add application-level components (only primitives)
- Do NOT modify any files outside `lib/artifacts/templates/` and `lib/artifacts/template-manifest.ts`
- Every component must follow the exact same pattern as the existing button.tsx

---

### Agent 3: `code-viewer` (Frontend)

**Skills:** `vercel-react-best-practices`, `vercel-composition-patterns`
**Scope:** Task 14 only

**Task 14: Read-Only Code Viewer Tab**

Files to create:

- `components/artifact/artifact-code-viewer.tsx`

Files to modify:

- `components/artifact/artifact-workspace.tsx` — add Code tab
- `components/artifact/artifact-workspace-header.tsx` — add Code tab to tab switcher
- `components/artifact/artifact-context.tsx` — add `sourceFiles` to workspace state
- `lib/types/artifact.ts` — add `ArtifactSourceFile` type

Steps:

1. Add `ArtifactSourceFile` type: `{ path: string; content: string; language: string }`
2. Add `sourceFiles: ArtifactSourceFile[]` to `ArtifactWorkspaceState` in artifact-context.tsx
3. Add `updateSourceFiles` action to context reducer
4. Create `artifact-code-viewer.tsx`:
   - Tab list of source files (file name only, no tree)
   - Selected file content displayed with `<pre><code>` and basic syntax highlighting via CSS
   - No editing capability — read-only display
   - Use monospace font, line numbers, horizontal scroll
5. Add "Code" tab to workspace header tab switcher (after Preview, before Logs)
6. Render `ArtifactCodeViewer` when Code tab is active
7. Run `bun typecheck` and `bun lint`

**Compliance rules:**

- Do NOT add a code editor library (no Monaco, CodeMirror, etc.)
- Do NOT add syntax highlighting libraries (CSS-only styling is sufficient for MVP)
- Do NOT add file editing, file creation, or file deletion capabilities
- Do NOT modify the preview frame, logs panel, or inspector components
- Do NOT add new npm dependencies
- The code viewer is purely presentational — it reads from context state

---

### Agent 4: `observability` (Backend)

**Skills:** `next-best-practices`
**Scope:** Task 17 only

**Task 17: Artifact Lifecycle Observability**

Files to create:

- `lib/artifacts/observability.ts`

Files to modify:

- `lib/tools/create-webapp-artifact.ts` — add lifecycle logging
- `lib/tools/update-webapp-artifact.ts` — add lifecycle logging
- `lib/tools/get-artifact-status.ts` — add lifecycle logging
- `lib/tools/restart-artifact-preview.ts` — add lifecycle logging
- `lib/artifacts/runtime/cleanup.ts` — add cleanup metrics logging

Steps:

1. Create `lib/artifacts/observability.ts` with structured log helpers:
   ```ts
   export function logArtifactEvent(
     event: string,
     data: Record<string, unknown>
   ) {
     console.log(
       JSON.stringify({
         source: 'artifact',
         event,
         ...data,
         timestamp: Date.now()
       })
     )
   }
   ```
2. Add lifecycle events at tool boundaries:
   - `artifact.create.start` / `artifact.create.complete` / `artifact.create.error`
   - `artifact.update.start` / `artifact.update.complete` / `artifact.update.error`
   - `artifact.status.query`
   - `artifact.restart.start` / `artifact.restart.complete` / `artifact.restart.error`
   - `artifact.cleanup.run` with `{ destroyed, failed, skipped }` counts
3. Include timing data: `durationMs` on all `.complete` and `.error` events
4. Include identity data: `artifactId`, `chatId`, `isGuest` on all events
5. Run `bun typecheck` and `bun lint`
6. Run `bun run test` — no existing tests should break

**Compliance rules:**

- Do NOT add external logging libraries (no winston, pino, etc.)
- Do NOT add metrics collection services
- Do NOT modify tool schemas, return values, or behavior
- Do NOT add database tables or columns for metrics
- Logging is `console.log` with structured JSON only
- The ONLY changes to tool files are adding `logArtifactEvent()` calls at entry/exit points

---

### Agent 5: `error-recovery` (Full Stack)

**Skills:** `test-driven-development`, `vercel-react-best-practices`
**Scope:** Task 16 only
**Depends on:** Agent 4 (observability) must complete first

**Task 16: Error Recovery UX**

Files to create:

- `components/artifact/artifact-error-panel.tsx`

Files to modify:

- `components/artifact/artifact-workspace.tsx` — render error panel on failed status
- `components/artifact/artifact-workspace-header.tsx` — add "Ask AI to fix" button
- `components/artifact/artifact-context.tsx` — add `requestAiFix` callback

Steps:

1. Write failing test for error panel rendering when `status === 'failed'`
2. Create `artifact-error-panel.tsx`:
   - Shows error message from build logs
   - "Retry" button (calls existing restart action)
   - "Ask AI to fix" button (submits a chat message asking the model to diagnose and fix)
   - Displays last few log lines for context
3. Add `requestAiFix` to artifact context:
   - Constructs a user message like: "The artifact build failed. Please diagnose the error from the build logs and fix the source code."
   - This callback is passed down from `chat.tsx` via context — it calls the existing `append` from `useChat`
4. Render error panel in workspace body when `workspace.status === 'failed'`
5. Add "Ask AI to fix" icon button to workspace header (only visible when failed)
6. Run `bun typecheck`, `bun lint`, `bun run test`

**Compliance rules:**

- Do NOT modify the chat submission flow or useChat configuration
- Do NOT add automatic retry logic (user must click)
- Do NOT add new API routes
- Do NOT modify tool implementations
- The "Ask AI to fix" button ONLY appends a user message — the model's existing artifact tools handle the rest
- Do NOT add error tracking services or crash reporting

---

### Agent 6: `review-and-verify` (Quality Gate)

**Skills:** `verification-before-completion`, `requesting-code-review`, `simplify`
**Scope:** Review ALL changes from Agents 1-5
**Depends on:** ALL other agents must complete first

**Review Protocol:**

1. **Scope compliance audit** — For each file changed, verify it appears in the agent's approved file list. Flag any file not on the list.

2. **Behavioral drift check** — Run full test suite. Compare test count before vs after. No existing test should be removed or modified (only new tests added).

   ```bash
   bun run test
   bun typecheck
   bun lint
   bun format:check
   ```

3. **Import order verification** — Check all new/modified files follow the project's `simple-import-sort` convention.

4. **Out-of-scope detection** — Search for changes in files NOT listed in any agent's scope:

   ```bash
   git diff main --name-only
   ```

   Every file in this list must appear in exactly one agent's file list above. Any unlisted file is a compliance violation.

5. **Feature flag verification** — Confirm artifacts are disabled by default:
   - Without `ENABLE_ARTIFACTS=true`, artifact tools should not appear in the agent's tool list
   - All existing functionality must work identically with the flag unset

6. **No new dependencies** — Verify `package.json` and `bun.lock` at the project root are unchanged. Only the template's `package.json` may have new Radix dependencies.

7. **Code quality** — Use `/simplify` skill on all new files to check for unnecessary complexity.

8. **Report** — Produce a structured compliance report:

   ```
   ## Batch 4 Compliance Report

   ### Scope Compliance
   - [ ] All changed files are in approved scope
   - [ ] No out-of-scope modifications detected

   ### Quality Gates
   - [ ] `bun lint` — 0 errors, 0 warnings
   - [ ] `bun typecheck` — 0 errors
   - [ ] `bun format:check` — all files formatted
   - [ ] `bun run test` — all tests pass, no regressions

   ### Feature Flag
   - [ ] Artifacts disabled by default
   - [ ] Existing behavior unchanged without flag

   ### Dependencies
   - [ ] Root package.json unchanged
   - [ ] Root bun.lock unchanged

   ### Violations
   (list any violations found)
   ```

---

## Execution Order

```
Phase 1 (parallel):  Agent 1 (env-and-flag) + Agent 2 (template-expansion)
Phase 2 (parallel):  Agent 3 (code-viewer) + Agent 4 (observability)
Phase 3 (sequential): Agent 5 (error-recovery) — depends on Agent 4
Phase 4 (sequential): Agent 6 (review-and-verify) — depends on ALL
```

## Commit Strategy

Each agent creates exactly ONE commit with the format:

```
feat: <short description> (batch 4, task <N>)

<bullet list of changes>

Co-Authored-By: Claude Opus 4.6 (1M context) <noreply@anthropic.com>
```

After Agent 6 review passes, squash-merge to `main` via PR.

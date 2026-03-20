# Canvas Artifact Replacement Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current E2B-backed artifact system with a canvas-style frontend artifact system that supports live preview, in-browser code editing, AI-driven updates, version history, restore, and single-file HTML export.

**Architecture:** Remove the old E2B artifact system from the active repo first, leaving only a minimal but buildable canvas namespace, extracted chat shell, and deterministic legacy notice path so the branch stays buildable without carrying forward sandbox concepts. Then implement the new canvas system around one canonical server-side compile pipeline (`source -> persisted compiled HTML -> iframe.srcdoc preview/export`) with explicit contracts for persistence, guest access, streaming parts, chat identity, and preview/runtime diagnostics persistence.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Bun, Drizzle ORM, PostgreSQL, AI SDK 6, server-side `esbuild`, Tailwind CSS v4, CodeMirror 6

---

## Implementation Rules

- This plan is written for Claude Code. Do not invent file names, interfaces, route shapes, or status values beyond what is listed here.
- Follow [$test-driven-development](/Users/nick/.agents/skills/test-driven-development/SKILL.md) for every task.
- Use [$requesting-code-review](/Users/nick/.agents/skills/requesting-code-review/SKILL.md) after each chunk.
- Use [$verification-before-completion](/Users/nick/.agents/skills/verification-before-completion/SKILL.md) before claiming the branch is done.
- Keep internal naming on `canvas` / `canvasArtifact`. Do not reintroduce `runtime session`, `rebuild`, `restart preview`, `sandbox`, or `expired preview` vocabulary into new code.
- Canvas is always-on in v1 in this repo. Remove `ENABLE_ARTIFACTS` / `NEXT_PUBLIC_ENABLE_ARTIFACTS` gating instead of replacing it with a new canvas feature flag.
- Preserve the locked v1 decisions from the spec. If a task requires a new architectural decision, stop and update the spec first.

## File Structure

### Delete Entirely

| Action | Path                                                   | Responsibility                                                                                               |
| ------ | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| Delete | `lib/artifacts/`                                       | Entire E2B artifact runtime, validation, orchestration, templates, guest-token, rebuild, observability stack |
| Delete | `components/artifact/`                                 | Entire old artifact workspace UI and context                                                                 |
| Delete | `lib/tools/create-webapp-artifact.ts`                  | Old create-artifact tool                                                                                     |
| Delete | `lib/tools/update-webapp-artifact.ts`                  | Old update-artifact tool                                                                                     |
| Delete | `lib/tools/get-artifact-status.ts`                     | Old status tool                                                                                              |
| Delete | `lib/tools/restart-artifact-preview.ts`                | Old preview restart tool                                                                                     |
| Delete | `app/api/artifacts/[artifactId]/actions/route.ts`      | Old artifact actions API                                                                                     |
| Delete | `app/api/artifacts/[artifactId]/actions/route.test.ts` | Old artifact actions tests                                                                                   |
| Delete | `lib/actions/artifact.ts`                              | Old artifact server actions                                                                                  |
| Delete | `lib/actions/__tests__/artifact.test.ts`               | Old artifact action tests                                                                                    |
| Delete | `lib/rate-limit/artifact-limits.ts`                    | Old artifact-specific rate limits                                                                            |
| Delete | `lib/types/artifact.ts`                                | Old artifact data contracts                                                                                  |
| Delete | `components/tool-ui/artifact-card.tsx`                 | Old artifact tool card                                                                                       |
| Delete | `lib/streaming/helpers/write-artifact-data.ts`         | Old artifact stream emitter                                                                                  |
| Delete | `lib/streaming/helpers/write-artifact-data.test.ts`    | Old artifact stream emitter tests                                                                            |

### Create

| Action | Path                                                                      | Responsibility                                                                                                         |
| ------ | ------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Create | `lib/types/canvas.ts`                                                     | Canonical canvas types: source files, status enum, diagnostics, version rows, guest token payload, legacy notice shape |
| Create | `lib/canvas/constants.ts`                                                 | Locked v1 limits, allowed file names, status values, tool names, data part names                                       |
| Create | `lib/canvas/validation/validate-canvas-source.ts`                         | Enforce virtual file set, size limits, import restrictions, disallowed APIs, `meta.json` schema                        |
| Create | `lib/canvas/validation/validate-canvas-source.test.ts`                    | Validation unit tests                                                                                                  |
| Create | `lib/canvas/compiler/build-tailwind-css.ts`                               | Compile Tailwind v4 utilities plus authored `styles.css` into final CSS                                                |
| Create | `lib/canvas/compiler/assemble-canvas-html.ts`                             | Assemble minified JS/CSS/assets/bootstrap into final `artifact.html`                                                   |
| Create | `lib/canvas/compiler/compile-canvas-artifact.ts`                          | Canonical server-side compile pipeline using `esbuild`, Tailwind, and HTML assembly                                    |
| Create | `lib/canvas/compiler/compile-canvas-artifact.test.ts`                     | Compiler unit tests                                                                                                    |
| Create | `lib/canvas/guest-token.ts`                                               | Signed guest canvas token issue/verify helpers                                                                         |
| Create | `lib/canvas/legacy.ts`                                                    | Legacy artifact detection and legacy-notice helpers                                                                    |
| Create | `lib/canvas/service.ts`                                                   | Canvas create/update/compile/version/restore/export orchestration                                                      |
| Create | `lib/canvas/service.test.ts`                                              | Canvas service tests                                                                                                   |
| Create | `lib/canvas/tool-context.ts`                                              | Request-scoped canvas tool context and emitter types                                                                   |
| Create | `lib/tools/create-canvas-artifact.ts`                                     | AI tool for creating the current chat’s canvas artifact                                                                |
| Create | `lib/tools/update-canvas-artifact.ts`                                     | AI tool for updating the current chat’s canvas artifact                                                                |
| Create | `lib/tools/__tests__/canvas-tools.test.ts`                                | Tool contract tests                                                                                                    |
| Create | `lib/streaming/helpers/write-canvas-data.ts`                              | Writer-backed emitter for persisted and ephemeral canvas data parts                                                    |
| Create | `lib/streaming/helpers/write-canvas-data.test.ts`                         | Streaming helper tests                                                                                                 |
| Create | `app/api/canvas-artifacts/[artifactId]/route.ts`                          | Load current canvas artifact state                                                                                     |
| Create | `app/api/canvas-artifacts/[artifactId]/route.test.ts`                     | Route tests for load state                                                                                             |
| Create | `app/api/canvas-artifacts/[artifactId]/draft/route.ts`                    | Draft update + compile route                                                                                           |
| Create | `app/api/canvas-artifacts/[artifactId]/draft/route.test.ts`               | Draft route tests                                                                                                      |
| Create | `app/api/canvas-artifacts/[artifactId]/versions/route.ts`                 | Explicit save/version creation route                                                                                   |
| Create | `app/api/canvas-artifacts/[artifactId]/versions/route.test.ts`            | Versions route tests                                                                                                   |
| Create | `app/api/canvas-artifacts/[artifactId]/restore/route.ts`                  | Restore route                                                                                                          |
| Create | `app/api/canvas-artifacts/[artifactId]/restore/route.test.ts`             | Restore route tests                                                                                                    |
| Create | `app/api/canvas-artifacts/[artifactId]/export/route.ts`                   | HTML export route                                                                                                      |
| Create | `app/api/canvas-artifacts/[artifactId]/export/route.test.ts`              | Export route tests                                                                                                     |
| Create | `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts`      | Persist preview-originated runtime diagnostics onto the active draft                                                   |
| Create | `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts` | Runtime diagnostics route tests                                                                                        |
| Create | `components/canvas/canvas-root.tsx`                                       | Root provider and preserved host layout for canvas UI                                                                  |
| Create | `components/canvas/chat-canvas-shell.tsx`                                 | Generic chat shell preserving the existing split-pane inspector/activity layout through the Stage 1 cutover            |
| Create | `components/canvas/canvas-context.tsx`                                    | Canvas state, loading, open/focus, and route action hooks                                                              |
| Create | `components/canvas/canvas-workspace.tsx`                                  | Main workspace shell                                                                                                   |
| Create | `components/canvas/canvas-editor.tsx`                                     | CodeMirror editor with file tabs and read-only modes                                                                   |
| Create | `components/canvas/canvas-preview.tsx`                                    | `iframe.srcdoc` preview host and bridge validation                                                                     |
| Create | `components/canvas/canvas-diagnostics-panel.tsx`                          | Validation/compile/runtime diagnostics UI                                                                              |
| Create | `components/canvas/canvas-version-history.tsx`                            | Version list, restore confirmation, save action                                                                        |
| Create | `components/canvas/canvas-legacy-notice.tsx`                              | Deterministic legacy-unavailable UI                                                                                    |
| Create | `components/canvas/canvas-workspace.test.tsx`                             | Workspace component tests                                                                                              |
| Create | `components/canvas/canvas-preview.test.tsx`                               | Preview isolation/bridge tests                                                                                         |
| Create | `components/tool-ui/canvas-artifact-card.tsx`                             | New persisted canvas card for chat/tool UI                                                                             |
| Create | `lib/rate-limit/canvas-limits.ts`                                         | Rate limits for AI canvas writes, draft compiles, restore, and runtime-diagnostics routes                              |
| Create | `lib/rate-limit/__tests__/canvas-limits.test.ts`                          | Canvas rate-limit tests                                                                                                |
| Create | `drizzle/0013_canvas_artifacts.sql`                                       | Forward migration for new canvas tables and indexes                                                                    |
| Create | `drizzle/meta/0013_snapshot.json`                                         | Drizzle snapshot for the new canvas schema                                                                             |

### Modify

| Action | Path                                                     | Responsibility                                                                                         |
| ------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Modify | `package.json`                                           | Add `esbuild` and CodeMirror 6 dependencies                                                            |
| Modify | `lib/db/schema.ts`                                       | Add `canvasArtifacts` and `canvasArtifactVersions`; keep old artifact tables untouched                 |
| Modify | `lib/db/relations.ts`                                    | Add new relations for canvas tables                                                                    |
| Modify | `lib/db/actions.ts`                                      | Add CRUD/update/version/restore queries for canvas artifacts with optimistic concurrency               |
| Modify | `lib/types/ai.ts`                                        | Replace old artifact data parts with canvas data parts                                                 |
| Modify | `lib/types/agent.ts`                                     | Replace old artifact tool types with canvas tool types                                                 |
| Modify | `lib/agents/researcher.ts`                               | Remove old artifact tools; register new canvas tools                                                   |
| Modify | `lib/streaming/create-chat-stream-response.ts`           | Replace old artifact tool context/emitter with canvas context/emitter                                  |
| Modify | `lib/streaming/create-ephemeral-chat-stream-response.ts` | Add guest canvas token verification for guest create/update flows                                      |
| Modify | `lib/utils/message-mapping.ts`                           | Persist new canvas parts; stop persisting old artifact parts as active behavior                        |
| Modify | `lib/utils/message-utils.ts`                             | Add any canvas-part helpers used by chat/canvas wiring                                                 |
| Modify | `app/api/chat/route.ts`                                  | Remove `guestArtifactToken` request plumbing; replace it with `guestCanvasToken`                       |
| Modify | `components/chat.tsx`                                    | Replace artifact workspace behavior with canvas workspace behavior                                     |
| Modify | `components/chat-request.ts`                             | Pull latest guest canvas token from persisted canvas parts                                             |
| Modify | `components/chat-messages.tsx`                           | Support canvas open/focus behavior if needed by message rendering                                      |
| Modify | `components/render-message.tsx`                          | Render `data-canvasArtifact` cards and legacy notices                                                  |
| Modify | `components/tool-ui/registry.tsx`                        | Register the new canvas artifact card and remove old artifact card wiring                              |
| Modify | `app/layout.tsx`                                         | Swap old `ArtifactRoot` wiring for `CanvasRoot`                                                        |
| Modify | `lib/agents/prompts/search-mode-prompts.ts`              | Add explicit create/update/clarify guidance for one-artifact-per-chat behavior                         |
| Modify | `.env.local.example`                                     | Remove E2B vars; add `GUEST_CANVAS_SECRET`                                                             |
| Modify | `CLAUDE.md`                                              | Replace E2B artifact guidance with the canvas architecture and remove flag-gated artifact instructions |
| Modify | `docs/getting-started/ENVIRONMENT.md`                    | Remove E2B artifact env docs; document canvas env if added                                             |
| Modify | `docs/reference/API.md`                                  | Replace artifact endpoint docs with canvas endpoints                                                   |
| Modify | `docs/reference/FILE-INDEX.md`                           | Replace old artifact file index with canvas architecture                                               |

---

## Stage 1: Remove Old E2B Artifact System From This Repo

> Branch-local only. Do not release after Stage 1. The purpose is to remove the old active architecture from this repo while leaving a minimal buildable canvas namespace and deterministic legacy-notice behavior.

## Chunk 1: Stage 1 Extraction

### Task 1: Add migration-regression tests and a minimal canvas namespace plus preserved chat shell so Stage 1 can delete old code without breaking the app

**Files:**

- Create: `components/canvas/canvas-root.tsx`
- Create: `components/canvas/chat-canvas-shell.tsx`
- Create: `components/canvas/canvas-context.tsx`
- Create: `components/canvas/canvas-legacy-notice.tsx`
- Create: `lib/canvas/legacy.ts`
- Modify: `app/layout.tsx`
- Test: `components/chat.test.tsx`

- [ ] **Step 1: Write the failing tests**

Add tests proving the app can mount `CanvasRoot` with the preserved chat shell and that a legacy artifact part resolves to a deterministic legacy notice.

```tsx
it('mounts CanvasRoot with the preserved chat shell but without artifact runtime state', () => {
  render(
    <CanvasRoot>
      <div>chat</div>
    </CanvasRoot>
  )

  expect(screen.getByText('chat')).toBeInTheDocument()
})

it('maps legacy artifact references to legacy notice state', () => {
  expect(
    buildLegacyCanvasNotice({
      artifactId: 'legacy-artifact-1',
      source: 'chat-history'
    }).kind
  ).toBe('legacy-unavailable')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- components/chat.test.tsx`
Expected: FAIL with missing `CanvasRoot` / `buildLegacyCanvasNotice`

- [ ] **Step 3: Add the minimal canvas namespace**

Implement the smallest possible buildable placeholders while preserving the existing split-pane host shell:

```tsx
// components/canvas/canvas-root.tsx
'use client'

import { ActivityProvider } from '@/components/activity/activity-context'

import { ChatCanvasShell } from './chat-canvas-shell'
import { CanvasProvider } from './canvas-context'

export function CanvasRoot({ children }: { children: React.ReactNode }) {
  return (
    <CanvasProvider>
      <ActivityProvider>
        <ChatCanvasShell>{children}</ChatCanvasShell>
      </ActivityProvider>
    </CanvasProvider>
  )
}
```

Extract the current `ChatArtifactContainer` layout into `components/canvas/chat-canvas-shell.tsx`, but make it canvas/generic rather than artifact-specific:

- preserve the existing desktop resizable split-pane behavior
- preserve inspector/activity panel and drawer rendering
- keep the workspace slot as a no-op placeholder in Task 1 so Stage 1 remains buildable before the full canvas workspace exists
- do not import from `components/artifact/**` inside the new shell

```tsx
// components/canvas/canvas-context.tsx
'use client'

import { createContext, useContext } from 'react'

export type CanvasContextValue = {
  openLegacyCanvasNotice: (input: {
    artifactId: string
    source: 'chat-history' | 'public-link' | 'guest-token'
  }) => void
}

const CanvasContext = createContext<CanvasContextValue | null>(null)

export function CanvasProvider({ children }: { children: React.ReactNode }) {
  return (
    <CanvasContext.Provider
      value={{
        openLegacyCanvasNotice: () => {}
      }}
    >
      {children}
    </CanvasContext.Provider>
  )
}

export function useCanvas() {
  const value = useContext(CanvasContext)

  if (!value) {
    throw new Error('useCanvas must be used within CanvasProvider')
  }

  return value
}
```

```tsx
// components/canvas/canvas-legacy-notice.tsx
export function CanvasLegacyNotice({
  notice
}: {
  notice: {
    kind: 'legacy-unavailable'
    artifactId: string
    source: 'chat-history' | 'public-link' | 'guest-token'
  }
}) {
  return <div>Legacy artifact unavailable</div>
}
```

```tsx
// lib/canvas/legacy.ts
export function buildLegacyCanvasNotice(input: {
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
}) {
  return {
    kind: 'legacy-unavailable' as const,
    artifactId: input.artifactId,
    source: input.source
  }
}
```

- [ ] **Step 4: Swap the root layout to the new namespace**

Replace old `ArtifactRoot` imports/usages in `app/layout.tsx` with `CanvasRoot`. Do not import anything from `components/artifact/**` after this step.

- [ ] **Step 5: Re-run the targeted test**

Run: `bun run test -- components/chat.test.tsx`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/canvas lib/canvas
git commit -m "refactor: introduce minimal canvas namespace for artifact cutover"
```

---

### Task 2: Remove old active artifact runtime/tool wiring and replace it with legacy-notice-only behavior

**Files:**

- Delete: `lib/artifacts/`
- Delete: `components/artifact/`
- Delete: `lib/tools/create-webapp-artifact.ts`
- Delete: `lib/tools/update-webapp-artifact.ts`
- Delete: `lib/tools/get-artifact-status.ts`
- Delete: `lib/tools/restart-artifact-preview.ts`
- Delete: `app/api/artifacts/[artifactId]/actions/route.ts`
- Delete: `app/api/artifacts/[artifactId]/actions/route.test.ts`
- Delete: `lib/actions/artifact.ts`
- Delete: `lib/actions/__tests__/artifact.test.ts`
- Delete: `lib/tools/__tests__/artifact-tools.test.ts`
- Delete: `lib/rate-limit/artifact-limits.ts`
- Delete: `lib/types/artifact.ts`
- Delete: `components/tool-ui/artifact-card.tsx`
- Delete: `lib/streaming/helpers/write-artifact-data.ts`
- Delete: `lib/streaming/helpers/write-artifact-data.test.ts`
- Delete: old artifact-only tests and fixtures under deleted paths
- Modify: `app/api/chat/route.ts`
- Modify: `lib/agents/researcher.ts`
- Modify: `lib/types/agent.ts`
- Modify: `lib/types/ai.ts`
- Modify: `lib/utils/message-mapping.ts`
- Modify: `lib/utils/message-utils.ts`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/relations.ts`
- Modify: `lib/db/actions.ts`
- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Modify: `components/chat.tsx`
- Modify: `components/chat-messages.tsx`
- Modify: `components/chat-panel.tsx`
- Modify: `components/reasoning-section.tsx`
- Modify: `components/search-section.tsx`
- Modify: `components/inspector/inspector-panel.tsx`
- Modify: `components/inspector/inspector-drawer.tsx`
- Modify: `components/chat-request.ts`
- Modify: `components/render-message.tsx`
- Modify: `components/tool-ui/registry.tsx`
- Modify: `lib/canvas/legacy.ts`
- Create: `lib/canvas/legacy.test.ts`
- Test: `lib/agents/__tests__/researcher.test.ts`
- Test: `app/api/chat/__tests__/route.test.ts`
- Test: `components/chat.test.tsx`
- Test: `components/chat-request.test.ts`
- Test: `lib/utils/__tests__/message-mapping-display-tools.test.ts`
- Test: `lib/canvas/legacy.test.ts`

- [ ] **Step 1: Write the failing tests**

Add regression tests proving the old tool names are gone from the active agent and old artifact stream parts are no longer emitted as active behavior.

```ts
it('does not register E2B artifact tools in researcher', () => {
  const agent = createResearcher({ model: 'gateway:google/gemini-2.5-flash' })

  expect(Object.keys(agent.tools)).not.toContain('createWebappArtifact')
  expect(Object.keys(agent.tools)).not.toContain('updateWebappArtifact')
})

it('ignores legacy artifact stream parts except for legacy notice resolution', () => {
  const mapped = mapUIMessagePartsToDBParts(
    [{ type: 'data-artifact', data: { artifactId: 'legacy-1' } }] as any,
    'message-1'
  )

  expect(mapped).toEqual([])
})

it('resolves reopened legacy references before any canvas open attempt', () => {
  const notice = resolveLegacyCanvasReference({
    artifactId: 'legacy-artifact-1',
    source: 'chat-history'
  })

  expect(notice.kind).toBe('legacy-unavailable')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- lib/agents/__tests__/researcher.test.ts app/api/chat/__tests__/route.test.ts components/chat.test.tsx components/chat-request.test.ts lib/utils/__tests__/message-mapping-display-tools.test.ts lib/canvas/legacy.test.ts`
Expected: FAIL because old artifact tools and parts are still wired

- [ ] **Step 3: Remove all old artifact imports and tool registrations**

In `lib/agents/researcher.ts` and `lib/types/agent.ts`, delete every reference to:

```ts
'createWebappArtifact'
'updateWebappArtifact'
'getArtifactStatus'
'restartArtifactPreview'
```

Do not add the new canvas tools yet. Stage 1 should leave the agent with no artifact-generation tools at all.

- [ ] **Step 4: Remove old artifact part types from active AI/message contracts**

In `lib/types/ai.ts`, remove `artifact`, `artifactStatus`, `artifactLog`, and `artifactEvent` from `UIDataTypes`. Add a temporary `legacyCanvasNotice` data shape if needed for the Stage 1 notice path.

- [ ] **Step 5: Replace old chat/render wiring with legacy notice behavior**

Update `components/chat.tsx`, `components/chat-request.ts`, `components/render-message.tsx`, and the streaming helpers so:

- no code reads or writes `guestArtifactToken`
- no code dispatches `data-artifactLog` / `data-artifactEvent`
- legacy persisted parts are detected only to show the new read-only legacy notice
- `components/tool-ui/registry.tsx` no longer imports or registers `artifactCard`
- `components/chat.tsx`, `components/chat-messages.tsx`, `components/chat-panel.tsx`, `components/reasoning-section.tsx`, `components/search-section.tsx`, `components/inspector/inspector-panel.tsx`, and `components/inspector/inspector-drawer.tsx` no longer import from `components/artifact/**`
- `app/api/chat/route.ts`, `components/chat-request.ts`, `lib/db/schema.ts`, `lib/db/relations.ts`, and `lib/db/actions.ts` no longer expose old active artifact request fields, table exports, relations, or helper functions in the runtime code path
- `resolveLegacyCanvasReference()` is the only Stage 1 path for reopened chats, legacy public links, and legacy guest-token references
- implement `resolveLegacyCanvasReference(input)` in `lib/canvas/legacy.ts` with this exact signature and return shape:

```ts
export function resolveLegacyCanvasReference(input: {
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
}): {
  kind: 'legacy-unavailable'
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
} {
  return buildLegacyCanvasNotice(input)
}
```

- do not let Stage 1 code path create, hydrate, or guess a new canvas artifact from a legacy reference
- keep the old `artifacts`, `artifactRevisions`, and `artifactRuntimeSessions` table declarations in `lib/db/schema.ts` and `lib/db/relations.ts` during Stage 1 because Drizzle still uses those files as the schema source of truth
- remove old artifact imports/usages from active runtime routes, actions, and helpers in `lib/db/**`, but do not rewrite historical SQL migration files in Stage 1
- do not remove old schema exports from the Drizzle source-of-truth files until after the new canvas migration has been generated, reviewed, and explicitly confirmed to contain no `DROP TABLE` statements

- [ ] **Step 6: Delete the old directories/files**

Delete the exact files listed in this task. Do not leave dead code behind behind flags.

- [ ] **Step 7: Re-run targeted tests**

Run: `bun run test -- lib/agents/__tests__/researcher.test.ts app/api/chat/__tests__/route.test.ts components/chat.test.tsx components/chat-request.test.ts lib/utils/__tests__/message-mapping-display-tools.test.ts lib/canvas/legacy.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "refactor: remove active E2B artifact runtime and legacy tool wiring"
```

---

### Task 3: Remove old docs/env/prompt references and prove the old active surface is gone

**Files:**

- Modify: `.env.local.example`
- Modify: `docs/architecture/OVERVIEW.md`
- Modify: `docs/architecture/GENERATIVE-UI.md`
- Modify: `docs/getting-started/ENVIRONMENT.md`
- Modify: `docs/getting-started/CONFIGURATION.md`
- Modify: `docs/getting-started/QUICKSTART.md`
- Modify: `lib/agents/prompts/search-mode-prompts.ts`
- Modify: `docs/reference/API.md`
- Modify: `docs/reference/FILE-INDEX.md`
- Modify: `CLAUDE.md`
- Modify: `docs/plans/2026-03-13-e2b-artifact-mvp.md`
- Modify: `docs/plans/2026-03-13-e2b-artifact-mvp-design.md`
- Modify: `docs/plans/2026-03-14-e2b-artifact-rollout.md`
- Modify: `docs/plans/2026-03-14-e2b-artifact-batch-4.md`
- Modify: `docs/superpowers/plans/2026-03-15-artifact-rebuild-on-demand.md`

- [ ] **Step 1: Write the failing regression check**

Create a small checklist in the plan execution notes or an ad hoc shell step proving these strings still exist before cleanup:

```bash
rg -n "createWebappArtifact|updateWebappArtifact|getArtifactStatus|restartArtifactPreview|artifact_runtime_sessions|ENABLE_ARTIFACTS|NEXT_PUBLIC_ENABLE_ARTIFACTS|E2B_API_KEY|sandbox preview" app components lib docs/architecture docs/getting-started docs/reference CLAUDE.md .env.local.example
```

Expected before cleanup: MATCHES FOUND

- [ ] **Step 2: Remove old docs/env references**

Remove or archive the old artifact references so current docs no longer describe E2B artifacts as active behavior. Also strip old E2B artifact instructions from `lib/agents/prompts/search-mode-prompts.ts`; Task 11 will add the new canvas guidance later. Keep historical plan docs only if they are clearly archived/non-current.

Canvas-specific cleanup rule:

- document that canvas is the only active artifact model in this repo in v1
- remove `ENABLE_ARTIFACTS` and `NEXT_PUBLIC_ENABLE_ARTIFACTS` gating language from runtime docs and contributor guidance instead of replacing it with a new flag

- [ ] **Step 3: Re-run the regression grep**

Run: `rg -n "createWebappArtifact|updateWebappArtifact|getArtifactStatus|restartArtifactPreview|artifact_runtime_sessions|ENABLE_ARTIFACTS|NEXT_PUBLIC_ENABLE_ARTIFACTS|E2B_API_KEY|sandbox preview" app components lib docs/architecture docs/getting-started docs/reference CLAUDE.md .env.local.example`
Expected: no matches

- [ ] **Step 4: Run lint and typecheck**

Run: `bun lint`
Expected: PASS

Run: `bun typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add .env.local.example docs
git commit -m "docs: remove active E2B artifact references from repo surfaces"
```

---

## Stage 2: Add New Canvas Artifact System

## Chunk 2: Milestone A — Data Model, Compiler Core, and API Contracts

### Task 4: Add the canvas database schema, relations, DB actions, and optimistic concurrency

**Files:**

- Modify: `package.json`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/relations.ts`
- Modify: `lib/db/actions.ts`
- Create: `lib/types/canvas.ts`
- Create: `lib/canvas/constants.ts`
- Create: `drizzle/0013_canvas_artifacts.sql`
- Create: `drizzle/meta/0013_snapshot.json`
- Test: `lib/actions/__tests__/canvas-db.test.ts` (new)

- [ ] **Step 1: Write the failing database tests**

Create `lib/actions/__tests__/canvas-db.test.ts` with targeted coverage for:

- unique one-artifact-per-chat
- optimistic concurrency on `draftRevision`
- explicit version creation
- restore replacing the draft source
- authenticated owner can load/update their own canvas artifact through RLS-backed actions
- authenticated non-owner cannot load/update another user's canvas artifact through RLS-backed actions

```ts
it('rejects stale draft updates by revision', async () => {
  const created = await dbActions.createCanvasArtifact({
    chatId: 'chat-1',
    userId: 'user-1',
    title: 'Canvas',
    draftSource: { 'App.tsx': 'export default function App() { return null }' }
  })

  const stale = await dbActions.updateCanvasArtifactDraft({
    artifactId: created.id,
    expectedRevision: 999,
    status: 'compiling',
    draftSource: created.draftSource
  })

  expect(stale).toBeNull()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- lib/actions/__tests__/canvas-db.test.ts`
Expected: FAIL with missing canvas tables/actions

- [ ] **Step 3: Add dependencies**

In `package.json`, add:

```json
{
  "dependencies": {
    "esbuild": "^0.25.0",
    "@uiw/react-codemirror": "^4.24.0",
    "@codemirror/lang-javascript": "^6.2.2",
    "@codemirror/theme-one-dark": "^6.1.2"
  }
}
```

Run: `bun install`
Expected: lockfile updates successfully

- [ ] **Step 4: Add `canvasArtifacts` and `canvasArtifactVersions` to `lib/db/schema.ts`**

Use the locked spec shape exactly:

```ts
status: varchar('status', {
  length: VARCHAR_LENGTH,
  enum: ['generating', 'compiling', 'ready', 'compile_failed', 'restoring']
}).notNull().default('compiling'),
draftSource: jsonb('draft_source').$type<Record<string, string>>().notNull(),
draftCompiledHtml: text('draft_compiled_html'),
draftDiagnostics: jsonb('draft_diagnostics').$type<CanvasDiagnostics | null>(),
draftRevision: integer('draft_revision').notNull().default(0),
currentVersionId: varchar('current_version_id', { length: ID_LENGTH }),
lastCompiledAt: timestamp('last_compiled_at')
```

Add:

- unique index on `chatId`
- unique index on `(artifactId, versionNumber)`
- `userId, updatedAt` index for reopen/history
- `artifactId, createdAt` index for versions
- RLS policies on both new tables

Mirror the repo's existing schema style: define `pgPolicy(...)` blocks inside each `pgTable(...)` declaration and end both tables with `.enableRLS()`.

Required policy behavior:

- `canvasArtifacts`: authenticated users can `select/insert/update/delete` only rows where `user_id = current_setting('app.current_user_id', true)`
- `canvasArtifactVersions`: authenticated users can `select/insert/update/delete` only rows whose parent artifact row belongs to `current_setting('app.current_user_id', true)`
- guest routes must not rely on guest RLS access; they use application-layer HMAC verification and then server-owned DB calls after route/service verification

Do not drop old `artifacts`, `artifact_revisions`, or `artifact_runtime_sessions` tables in this migration.

Write the immutable version table explicitly too:

```ts
export const canvasArtifactVersions = pgTable(
  'canvas_artifact_versions',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    artifactId: varchar('artifact_id', { length: ID_LENGTH })
      .notNull()
      .references(() => canvasArtifacts.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    sourceSnapshot: jsonb('source_snapshot')
      .$type<Record<string, string>>()
      .notNull(),
    createdBy: varchar('created_by', {
      length: VARCHAR_LENGTH,
      enum: ['ai', 'user', 'restore']
    }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    uniqueIndex('canvas_artifact_versions_artifact_id_version_number_idx').on(
      table.artifactId,
      table.versionNumber
    ),
    index('canvas_artifact_versions_artifact_id_created_at_idx').on(
      table.artifactId,
      table.createdAt.desc()
    )
  ]
)
```

The snippet above shows the column/index shape only. The actual implementation must still append the required `pgPolicy(...)` entries for both tables and end both table declarations with `.enableRLS()`.

- [ ] **Step 5: Add the migration**

Run: `bunx drizzle-kit generate --name canvas_artifacts`
Expected: `drizzle/0013_canvas_artifacts.sql` and `drizzle/meta/0013_snapshot.json`

Run: `npx supabase start`
Expected: local Postgres is available

Run: `bun run migrate`
Expected: migration applies successfully

- [ ] **Step 6: Add DB actions with explicit function names**

Implement in `lib/db/actions.ts`:

- `createCanvasArtifact`
- `loadCanvasArtifactByChatId`
- `loadCanvasArtifactById`
- `updateCanvasArtifactDraft`
- `createCanvasArtifactVersion`
- `listCanvasArtifactVersions`
- `restoreCanvasArtifactVersion`

Critical update path:

```ts
await tx
  .update(canvasArtifacts)
  .set({
    draftSource: input.draftSource,
    draftCompiledHtml: input.draftCompiledHtml,
    draftDiagnostics: input.draftDiagnostics,
    status: input.status,
    draftRevision: sql`${canvasArtifacts.draftRevision} + 1`
  })
  .where(
    and(
      eq(canvasArtifacts.id, input.artifactId),
      eq(canvasArtifacts.draftRevision, input.expectedRevision)
    )
  )
```

Implementation rules:

- authenticated canvas DB actions must use the existing `withRLS(...)` / `withOptionalRLS(...)` helpers instead of bypassing row ownership
- add explicit tests in `lib/actions/__tests__/canvas-db.test.ts` proving a second authenticated user cannot read or update another user's artifact through these actions

- [ ] **Step 7: Re-run the DB test**

Run: `bun run test -- lib/actions/__tests__/canvas-db.test.ts`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add package.json bun.lock lib/db/schema.ts lib/db/relations.ts lib/db/actions.ts lib/types/canvas.ts lib/canvas/constants.ts drizzle
git commit -m "feat: add canvas artifact schema and optimistic draft persistence"
```

---

### Task 5: Implement source validation and the canonical server-side compile pipeline

**Files:**

- Create: `lib/canvas/validation/validate-canvas-source.ts`
- Create: `lib/canvas/validation/validate-canvas-source.test.ts`
- Create: `lib/canvas/compiler/build-tailwind-css.ts`
- Create: `lib/canvas/compiler/assemble-canvas-html.ts`
- Create: `lib/canvas/compiler/compile-canvas-artifact.ts`
- Create: `lib/canvas/compiler/compile-canvas-artifact.test.ts`

- [ ] **Step 1: Write the failing validation tests**

Cover the locked v1 rules:

- required `App.tsx`
- only `App.tsx`, `styles.css`, `components.tsx`, `meta.json`
- allowed imports only: relative, `react`, `react-dom/client`
- reject remote imports, Node APIs, arbitrary npm
- reject remote `<script>` tags and remote stylesheet injection
- reject server-only framework APIs such as `next/*`
- enforce file/total/output limits
- validate `meta.json` schema only
- enforce the 5 MB embedded asset cap across `meta.json.assets`
- surface `externalDependencies` from `meta.json` in the compile result

```ts
it('rejects remote ESM imports', () => {
  const result = validateCanvasSource({
    'App.tsx':
      "import x from 'https://esm.sh/react'; export default function App() { return null }"
  })

  expect(result.ok).toBe(false)
  expect(result.diagnostics[0]?.message).toContain(
    'remote ESM or CDN imports are not allowed'
  )
})
```

- [ ] **Step 2: Write the failing compiler tests**

Cover:

- compiled HTML includes bundled JS and CSS
- React/ReactDOM are bundled, not loaded remotely
- Tailwind utilities render into CSS
- `meta.json.assets` entries are inlined into the final HTML output
- assembled HTML contains the locked CSP meta tag
- preview bootstrap injects nonce-scoped message bridge and runtime diagnostics hooks
- unsupported non-static Tailwind class construction surfaces a compile diagnostic instead of silently missing styles
- compiled output is rejected when exceeding 2 MB

```ts
it('assembles one HTML document with inline JS and CSS', async () => {
  const result = await compileCanvasArtifact({
    source: {
      'App.tsx':
        'export default function App() { return <div className=\"p-4 text-red-500\">Hi</div> }'
    }
  })

  expect(result.ok).toBe(true)
  expect(result.html).toContain('<!DOCTYPE html>')
  expect(result.html).toContain('text-red-500')
  expect(result.html).toContain("default-src 'none'")
  expect(result.html).not.toContain('https://unpkg.com')
})
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `bun run test -- lib/canvas/validation/validate-canvas-source.test.ts lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: FAIL with missing validator/compiler

- [ ] **Step 4: Implement validation**

In `validate-canvas-source.ts`:

- parse the virtual file set
- enforce exact filenames
- validate `meta.json` via `zod`
- scan imports with a simple static parser or regex sufficient for TSX
- reject raw HTML strings or authored files that inject remote `<script src>` or remote stylesheet URLs
- return `{ ok, files, diagnostics }`

- [ ] **Step 5: Implement the canonical compiler**

In `compile-canvas-artifact.ts`:

1. call `validateCanvasSource`
2. bundle `App.tsx` + optional files with server-side `esbuild`
3. compile Tailwind CSS through one locked implementation path:
   - create a per-compile temp workspace containing only the validated virtual files
   - generate a synthetic CSS entry for the host-owned Tailwind pipeline
   - run PostCSS with `@tailwindcss/postcss` against that entry
   - let Tailwind scan only the temp workspace, never the repo at large
   - merge generated utilities with authored `styles.css`, with authored CSS last so explicit user rules win
   - treat non-statically-detectable class construction as unsupported in v1 and emit a compile diagnostic rather than silently omitting CSS
4. pass JS/CSS/assets/bootstrap into `assemble-canvas-html`
5. return `{ ok, html, diagnostics, externalDependencies }`

Implementation note:

- normalize `externalDependencies` into `draftDiagnostics.externalDependencies` before persistence so the UI and export flow can surface them without inventing a parallel client-only state shape
- make `build-tailwind-css.ts` responsible for deterministic CSS generation from the validated virtual file set plus authored `styles.css`
- inline `meta.json.assets` into the assembled HTML output and add explicit compiler coverage proving the exported HTML does not depend on repo-local asset files

The assembled preview bootstrap must:

- mount React to `#root`
- emit `preview-ready`
- report `error`, `unhandledrejection`, asset failures, and network failures through the locked `postMessage` envelope
- never expose a generic RPC surface
- inject the exact CSP from the spec into a `<meta http-equiv=\"Content-Security-Policy\">` tag

- [ ] **Step 6: Re-run the targeted tests**

Run: `bun run test -- lib/canvas/validation/validate-canvas-source.test.ts lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/canvas/validation lib/canvas/compiler
git commit -m "feat: add canvas source validation and server-side compile pipeline"
```

---

### Task 6: Implement the canvas service layer, guest token enforcement, and all canvas routes

**Files:**

- Create: `lib/canvas/guest-token.ts`
- Create: `lib/canvas/service.ts`
- Create: `lib/canvas/service.test.ts`
- Create: `lib/rate-limit/canvas-limits.ts`
- Create: `lib/rate-limit/__tests__/canvas-limits.test.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/route.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/route.test.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/draft/route.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/draft/route.test.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/versions/route.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/versions/route.test.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/restore/route.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/restore/route.test.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/export/route.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/export/route.test.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts`
- Create: `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts`

- [ ] **Step 1: Write the failing service and route tests**

Add tests for:

- authenticated create/update/load
- guest token binding to `chatId` and `artifactId`
- expired guest token rejection for normal routes
- guest token rotation on successful guest write and restore
- duplicate create in a chat with an existing artifact returns a structured conflict instead of a 500
- `status` transitions: `generating -> compiling -> ready` and `compile_failed`
- compile results persist `externalDependencies` inside `draftDiagnostics`
- preview-originated runtime diagnostics persist only when `artifactId` and `draftRevision` still match the active draft
- draft/update/restore/runtime-diagnostics routes are rate-limited
- export returns attachment with warning headers
- stale `draftRevision` returns conflict

```ts
it('rejects guest draft write when token artifactId does not match route', async () => {
  const token = await signGuestCanvasToken({
    chatId: 'chat-1',
    artifactId: 'artifact-a'
  })

  const response = await PATCH(
    makeDraftRequest({
      routeArtifactId: 'artifact-b',
      token,
      baseRevision: 0,
      draftSource: {
        'App.tsx': 'export default function App() { return null }'
      }
    })
  )

  expect(response.status).toBe(403)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- lib/canvas/service.test.ts lib/rate-limit/__tests__/canvas-limits.test.ts app/api/canvas-artifacts/[artifactId]/route.test.ts app/api/canvas-artifacts/[artifactId]/draft/route.test.ts app/api/canvas-artifacts/[artifactId]/versions/route.test.ts app/api/canvas-artifacts/[artifactId]/restore/route.test.ts app/api/canvas-artifacts/[artifactId]/export/route.test.ts app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement guest token helpers**

Copy only the HMAC pattern from the old guest token flow, but rename it to canvas terms and keep the rules from the spec:

- token payload: `chatId`, `artifactId`, `exp`
- 30 minute TTL
- rotate on every successful guest write
- rotate on successful restore as well
- reject expired tokens for normal read/write/restore/export
- read the signing secret from `GUEST_CANVAS_SECRET`

Use one exact transport contract:

- `GET /api/canvas-artifacts/[artifactId]?guestCanvasToken=...`
- `GET /api/canvas-artifacts/[artifactId]/export?guestCanvasToken=...`
- `PATCH` / `POST` canvas routes accept `guestCanvasToken` inside the JSON body

- [ ] **Step 4: Implement `lib/canvas/service.ts`**

Required service methods:

- `createCanvasArtifactFromSource`
- `updateCanvasArtifactDraftFromSource`
- `saveCanvasArtifactVersion`
- `restoreCanvasArtifactVersion`
- `recordCanvasRuntimeDiagnostics`
- `loadCanvasArtifactState`
- `exportCanvasArtifactHtml`

These methods own:

- validation
- compile pipeline
- DB writes
- status transitions
- immediate `generating` status transition at the start of AI create/update execution so the editor can lock before compile completion
- guest token rotation
- duplicate-create safety: preflight by `chatId` or catch the unique constraint and return a structured `artifact-already-exists` conflict result instead of throwing a generic 500
- automatic immutable version creation for AI create/update
- no immutable version creation for plain `PATCH /draft`
- restore transition: set status to `restoring`, replace draft source, compile, then set `ready` or `compile_failed`
- runtime diagnostics persistence on the active draft without creating an immutable version
- version retention cap: keep the latest 50 immutable versions, deleting older ones after insert

- [ ] **Step 5: Implement the routes with exact contracts**

Return payloads for artifact-state routes must always include:

```ts
{
  artifactId,
  chatId,
  title,
  status,
  draftRevision,
  draftSource,
  draftCompiledHtml,
  draftDiagnostics,
  currentVersionId,
  guestCanvasToken, // present only for guest-authenticated responses
  versions: [
    {
      id,
      versionNumber,
      createdBy,
      createdAt
    }
  ],
  updatedAt
}
```

Add one persisted runtime diagnostics contract:

- `POST /api/canvas-artifacts/[artifactId]/runtime-diagnostics`
  - request:
    - `draftRevision`
    - validated runtime diagnostics payload
    - `guestCanvasToken?`
  - behavior:
    - enforces the same guest/auth checks as the other canvas routes
    - rate-limits writes
    - persists runtime diagnostics only when `artifactId` and `draftRevision` still match the active draft
    - returns the refreshed artifact state payload so the client reloads from the persisted row instead of inventing client-only runtime state

Route implementation rules:

- enforce `canvas-limits` on `PATCH /draft`, `POST /versions`, `POST /restore`, and `POST /runtime-diagnostics`
- do not let create/update paths surface raw unique-constraint or compile worker errors directly to the model or client when a structured canvas conflict/error result is available

For `GET /export`, set:

```ts
headers.set('Content-Disposition', 'attachment; filename=\"<slug>.html\"')
headers.set('Content-Type', 'text/html; charset=utf-8')
headers.set('X-Canvas-Executes-JavaScript', 'true')
headers.set(
  'X-Canvas-External-Dependencies',
  externalDependencies.length ? 'present' : 'none'
)
```

- [ ] **Step 6: Re-run the route/service tests**

Run: `bun run test -- lib/canvas/service.test.ts lib/rate-limit/__tests__/canvas-limits.test.ts app/api/canvas-artifacts/[artifactId]/route.test.ts app/api/canvas-artifacts/[artifactId]/draft/route.test.ts app/api/canvas-artifacts/[artifactId]/versions/route.test.ts app/api/canvas-artifacts/[artifactId]/restore/route.test.ts app/api/canvas-artifacts/[artifactId]/export/route.test.ts app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts`
Expected: PASS

- [ ] **Step 7: Run lint and typecheck**

Run: `bun lint`
Expected: PASS

Run: `bun typecheck`
Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/canvas lib/rate-limit app/api/canvas-artifacts
git commit -m "feat: add canvas service layer and canvas artifact routes"
```

---

## Chunk 3: Milestone B — Canvas Editor UI

### Task 7: Build the canvas context, workspace shell, and legacy notice behavior

**Files:**

- Create: `components/canvas/chat-canvas-shell.tsx`
- Create: `components/canvas/canvas-context.tsx`
- Create: `components/canvas/canvas-workspace.tsx`
- Create: `components/canvas/canvas-legacy-notice.tsx`
- Create: `components/canvas/canvas-workspace.test.tsx`
- Modify: `components/canvas/canvas-root.tsx`

- [ ] **Step 1: Write the failing component tests**

Cover:

- one active artifact open/focus state
- loading current artifact state from route
- legacy notice state for old references
- read-only state while `status` is `generating` or `restoring`
- desktop split-pane layout
- mobile preview/code tab switching

```tsx
it('shows the legacy notice instead of a workspace for legacy references', async () => {
  render(<CanvasWorkspace state={makeLegacyCanvasState()} />)

  expect(screen.getByText(/legacy artifact unavailable/i)).toBeInTheDocument()
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- components/canvas/canvas-workspace.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement context and workspace shell**

`canvas-context.tsx` should own:

- current `artifactId`
- loaded artifact state
- `openCanvasArtifact`
- `focusCanvasArtifact`
- `openLegacyCanvasNotice`
- `requestCanvasAiUpdate`
- route-backed actions for draft update, reload latest draft, version save, restore, export

`chat-canvas-shell.tsx` should continue to own the host chat layout contract through the cutover:

- preserve the existing desktop resizable right-panel behavior
- preserve inspector/activity panel and drawer rendering
- swap the placeholder Stage 1 shell content for `CanvasWorkspace` without regressing the surrounding chat layout

`canvas-workspace.tsx` should switch between:

- loading
- legacy notice
- active workspace

- [ ] **Step 4: Re-run the component test**

Run: `bun run test -- components/canvas/canvas-workspace.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/canvas
git commit -m "feat: add canvas workspace shell and legacy notice state"
```

---

### Task 8: Add CodeMirror editor, diagnostics panel, and version history

**Files:**

- Create: `components/canvas/canvas-editor.tsx`
- Create: `components/canvas/canvas-diagnostics-panel.tsx`
- Create: `components/canvas/canvas-version-history.tsx`
- Modify: `components/canvas/canvas-workspace.tsx`
- Test: `components/canvas/canvas-workspace.test.tsx`

- [ ] **Step 1: Write the failing UI tests**

Cover:

- file tab switching across `App.tsx`, `styles.css`, `components.tsx`, `meta.json`
- editor read-only during `generating` / `restoring`
- manual editor changes debounce for exactly `500ms` before calling `PATCH /api/canvas-artifacts/[artifactId]/draft`
- successful draft save replaces local `draftSource`, `draftRevision`, `draftCompiledHtml`, and `draftDiagnostics` from the route response
- if the user keeps typing while a draft save is in flight, older `200` responses do not overwrite the newer local editor buffer
- diagnostics render source-level failures
- save action creates versions
- restore with unsaved draft changes forces an explicit confirmation with only:
  - `Discard draft and restore`
  - `Cancel restore`
- export/download action is visible
- export panel visibly lists remaining external dependencies from `draftDiagnostics.externalDependencies` before download
- "Ask AI to change it" action is visible and targets the current artifact
- stale `409` draft conflicts show a warning with exact recovery actions:
  - `Reload latest draft`
  - `Copy local changes`
  - `Ask AI to reapply changes`

```tsx
it('makes the editor read-only while AI generation is in progress', () => {
  render(<CanvasEditor artifact={makeArtifact({ status: 'generating' })} />)

  expect(screen.getByRole('textbox')).toHaveAttribute('aria-readonly', 'true')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- components/canvas/canvas-workspace.test.tsx`
Expected: FAIL

- [ ] **Step 3: Verify the editor dependency from Task 4 is present**

Confirm `package.json` and `bun.lock` already include:

- `@uiw/react-codemirror`
- `@codemirror/lang-javascript`
- `@codemirror/theme-one-dark`

If they are missing, go back to Task 4 instead of introducing a different editor.

- [ ] **Step 4: Implement the editor and diagnostics UI**

Use `@uiw/react-codemirror` with JS/TSX syntax support. Keep file tabs to the locked virtual file set only. Do not let the UI create arbitrary extra files.

Exact edit loop rules:

- keep a local editable draft in component/context state
- debounce outbound draft writes for exactly `500ms` of idle time
- allow at most one `PATCH /draft` request in flight at a time
- on debounce fire, `PATCH /api/canvas-artifacts/[artifactId]/draft` with `{ baseRevision, draftSource, guestCanvasToken? }`
- capture a monotonically increasing local `editSequence` when each request starts
- on `200`, replace local state from the route payload instead of merging ad hoc:
  - `draftSource`
  - `draftRevision`
  - `draftCompiledHtml`
  - `draftDiagnostics`
  - `status`
- if local edits occurred after the request started, do not replace the current editor buffer with the older response payload
- in that newer-local-edits case:
  - still update the stored server snapshot (`draftRevision`, `draftCompiledHtml`, `draftDiagnostics`, `status`) from the response
  - keep the newer local buffer dirty
  - schedule the next debounced save from the current local buffer after the in-flight request settles
- on `409`, do not silently overwrite or retry
- preserve the unsaved local editor buffer in memory and show the exact stale conflict actions listed above
- `Reload latest draft` must fetch current route state and replace the local buffer
- `Copy local changes` must copy the unsaved local virtual file set JSON to the clipboard for manual salvage
- `Ask AI to reapply changes` must call `requestCanvasAiUpdate(...)` from `canvas-context.tsx` with the current unsaved local source summarized as the requested change context

- [ ] **Step 5: Implement version history, export, and AI revision entry-point UI**

Add explicit actions only:

- `Save version`
- `Restore version`
- `Cancel restore`
- `Discard draft and restore`
- `Export HTML`
- `Ask AI to change it`

Do not implement automatic merge or auto-save versions.

Exact restore rule:

- if the current local draft is dirty when the user chooses `Restore version`, open a confirmation state with only `Discard draft and restore` and `Cancel restore`
- do not attempt three-way merge of the local draft against the restored snapshot
- in `components/canvas/canvas-version-history.tsx`, render an `External dependencies` section directly above `Export HTML` whenever `draftDiagnostics.externalDependencies.length > 0`
- each row in that section must show `type`, `label ?? url`, and the raw `url`
- keep `Export HTML` enabled, but do not allow the dependency disclosure UI to be hidden behind a collapsed diagnostic pane

- [ ] **Step 6: Re-run the UI test**

Run: `bun run test -- components/canvas/canvas-workspace.test.tsx`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add components/canvas
git commit -m "feat: add canvas editor diagnostics and version history"
```

---

### Task 9: Add the isolated preview host and runtime diagnostics bridge

**Files:**

- Create: `components/canvas/canvas-preview.tsx`
- Create: `components/canvas/canvas-preview.test.tsx`
- Modify: `components/canvas/canvas-workspace.tsx`

- [ ] **Step 1: Write the failing preview tests**

Cover:

- `iframe.srcdoc` is used
- sandbox is exactly `allow-scripts`
- `init` message uses the locked envelope fields:
  - `channel`
  - `type`
  - `artifactId`
  - `revisionId`
  - `nonce`
  - optional `requestId`
  - optional `payload`
- host -> preview messages are limited to `init`
- preview -> host messages are limited to:
  - `preview-ready`
  - `runtime-error`
  - `unhandled-rejection`
  - `asset-error`
  - `external-request-error`
- `height-change`
- runtime messages are ignored when nonce/revision mismatch
- accepted preview-originated runtime diagnostics are POSTed to the runtime-diagnostics route and persisted on the active draft
- compile failures preserve the last successful preview HTML

```tsx
it('renders preview through iframe srcdoc with sandbox allow-scripts only', () => {
  render(<CanvasPreview artifact={makeArtifact()} />)

  const frame = screen.getByTitle(/canvas preview/i)
  expect(frame).toHaveAttribute('sandbox', 'allow-scripts')
  expect(frame).toHaveAttribute('srcdoc')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- components/canvas/canvas-preview.test.tsx`
Expected: FAIL

- [ ] **Step 3: Implement `CanvasPreview`**

Requirements:

- use `srcDoc={artifact.draftCompiledHtml ?? ''}`
- set `sandbox="allow-scripts"`
- send only the `init` message on load
- use a versioned nonce-scoped envelope with exact keys `channel`, `type`, `artifactId`, `revisionId`, `nonce`, optional `requestId`, and optional `payload`
- validate `event.source`, `artifactId`, `revisionId`, and `nonce` on incoming messages
- POST accepted runtime failures to `/api/canvas-artifacts/[artifactId]/runtime-diagnostics` with `{ draftRevision, diagnostics, guestCanvasToken? }`
- reload local artifact state from the persisted route response instead of inventing client-only runtime diagnostic state

Do not invent a client-only `lastSuccessfulHtml` cache. The server-owned `draftCompiledHtml` must remain the last successful preview when the artifact status is `compile_failed`.

- [ ] **Step 4: Re-run the preview test**

Run: `bun run test -- components/canvas/canvas-preview.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/canvas/canvas-preview.tsx components/canvas/canvas-preview.test.tsx components/canvas/canvas-workspace.tsx
git commit -m "feat: add isolated canvas preview with runtime diagnostics bridge"
```

---

## Chunk 4: Milestone C — Chat Integration

### Task 10: Add canvas stream emitters, canvas data parts, and AI tools

**Files:**

- Create: `lib/canvas/tool-context.ts`
- Create: `lib/tools/create-canvas-artifact.ts`
- Create: `lib/tools/update-canvas-artifact.ts`
- Create: `lib/tools/__tests__/canvas-tools.test.ts`
- Create: `lib/streaming/helpers/write-canvas-data.ts`
- Create: `lib/streaming/helpers/write-canvas-data.test.ts`
- Modify: `lib/types/ai.ts`
- Modify: `lib/types/agent.ts`

- [ ] **Step 1: Write the failing tool and stream tests**

Cover:

- `createCanvasArtifact` and `updateCanvasArtifact` exact input/output contract
- persisted parts: `data-canvasArtifact`, `data-canvasArtifactStatus`
- ephemeral parts: `data-canvasArtifactEvent`, `data-canvasDiagnostics`
- `createCanvasArtifact` emits an immediate `data-canvasArtifactStatus` with `status: 'generating'` before the final persisted artifact/update result
- `createCanvasArtifact` returns a structured conflict when the chat already has an artifact
- `data-canvasArtifactStatus` persists the latest rotated `guestCanvasToken` when a guest-authenticated write succeeds

```ts
it('emits persisted canvas artifact state and ephemeral diagnostics', () => {
  const writer = { write: vi.fn() } as any
  const emitter = createCanvasEmitter(writer)

  emitter.emitCanvasArtifact({
    artifactId: 'artifact-1',
    status: 'ready'
  } as any)
  emitter.emitCanvasDiagnostics({ severity: 'error', message: 'boom' } as any)

  expect(writer.write.mock.calls[0][0].type).toBe('data-canvasArtifact')
  expect(writer.write.mock.calls[1][0].type).toBe('data-canvasDiagnostics')
  expect(writer.write.mock.calls[1][0].transient).toBe(true)
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- lib/tools/__tests__/canvas-tools.test.ts lib/streaming/helpers/write-canvas-data.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the new AI/stream contracts**

In `lib/types/ai.ts`, add only:

- `data-canvasArtifact`
- `data-canvasArtifactStatus`
- `data-canvasArtifactEvent`
- `data-canvasDiagnostics`

Remove any remaining active old artifact part types.

Lock the persisted status payload shape so Claude Code does not invent it:

```ts
type CanvasArtifactStatusPart = {
  artifactId: string
  chatId: string
  status: 'generating' | 'compiling' | 'ready' | 'compile_failed' | 'restoring'
  draftRevision: number
  currentVersionId: string | null
  updatedAt: string
  guestCanvasToken?: string
}
```

- [ ] **Step 4: Implement the tool files**

Tool behavior rules:

- input is full virtual file set payload, never file diffs
- update tool requires `artifactId` and `baseRevision`
- tool writes are atomic on completion
- no partial live-file streaming while the model is still generating
- `createCanvasArtifact` must not blindly insert on `chatId`; it must return a structured conflict payload that tells the model to update or clarify when the chat already has an artifact
- emit `data-canvasArtifactStatus` with `status: 'generating'` immediately when AI create/update execution starts so the editor can lock before compile completion
- `updateCanvasArtifact` must load the latest persisted `draftSource` and `draftRevision` before attempting the write, and must fail with an explicit conflict result instead of guessing a merge if the model supplied a stale `baseRevision`
- `write-canvas-data.ts` must persist refreshed `guestCanvasToken` values into `data-canvasArtifactStatus`, not into transient event parts

- [ ] **Step 5: Re-run the targeted tests**

Run: `bun run test -- lib/tools/__tests__/canvas-tools.test.ts lib/streaming/helpers/write-canvas-data.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/types/ai.ts lib/types/agent.ts lib/canvas/tool-context.ts lib/tools/create-canvas-artifact.ts lib/tools/update-canvas-artifact.ts lib/tools/__tests__/canvas-tools.test.ts lib/streaming/helpers/write-canvas-data.ts lib/streaming/helpers/write-canvas-data.test.ts
git commit -m "feat: add canvas tool and stream contracts"
```

---

### Task 11: Wire the researcher, chat stream responses, and chat API to the new canvas contract

**Files:**

- Modify: `lib/agents/researcher.ts`
- Modify: `lib/agents/prompts/search-mode-prompts.ts`
- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Modify: `app/api/chat/route.ts`
- Test: `lib/agents/__tests__/researcher.test.ts`
- Test: `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

- [ ] **Step 1: Write the failing integration tests**

Cover:

- researcher registers only `createCanvasArtifact` and `updateCanvasArtifact`
- authenticated and guest streams construct a `canvasToolContext`
- guest request body no longer accepts `guestArtifactToken`; it accepts `guestCanvasToken`
- stream/orchestration code loads the current artifact's `draftSource` and `draftRevision` before an AI update turn and exposes them to the model-visible update context
- prompts tell the model to clarify instead of silently replacing the current artifact when the user asks for a fundamentally different artifact in the same chat

```ts
it('registers only canvas tools for artifact generation', () => {
  const agent = createResearcher({ model: 'gateway:google/gemini-2.5-flash' })
  expect(Object.keys(agent.tools)).toContain('createCanvasArtifact')
  expect(Object.keys(agent.tools)).toContain('updateCanvasArtifact')
  expect(Object.keys(agent.tools)).not.toContain('createWebappArtifact')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- lib/agents/__tests__/researcher.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`
Expected: FAIL

- [ ] **Step 3: Update the researcher and streams**

Required changes:

- `lib/agents/researcher.ts`: replace old artifact tool imports and active tool names
- `lib/agents/prompts/search-mode-prompts.ts`: add explicit create/update/clarify guidance for one-artifact-per-chat behavior
- `create-chat-stream-response.ts`: replace `ArtifactToolContext` and `createArtifactEmitter` with canvas equivalents
- `create-ephemeral-chat-stream-response.ts`: verify `guestCanvasToken` and bind it to `chatId`/`artifactId`
- `app/api/chat/route.ts`: rename the request field to `guestCanvasToken` and remove all old artifact-specific inline error paths
- when a chat already has a canvas artifact, `create-chat-stream-response.ts` and `create-ephemeral-chat-stream-response.ts` must load the latest persisted `draftSource` and `draftRevision` before the model issues `updateCanvasArtifact`
- include that latest draft state in a prepared per-request update context so the AI is working from the same source snapshot the route will enforce
- keep `lib/agents/researcher.ts` synchronous; do not make the researcher factory perform DB reads itself
- `updateCanvasArtifact` still reloads the latest persisted draft at tool execution time and treats the model-visible snapshot as advisory rather than authoritative

- [ ] **Step 4: Re-run the tests**

Run: `bun run test -- lib/agents/__tests__/researcher.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/agents/researcher.ts lib/agents/prompts/search-mode-prompts.ts lib/streaming/create-chat-stream-response.ts lib/streaming/create-ephemeral-chat-stream-response.ts app/api/chat/route.ts
git commit -m "feat: wire chat streams and researcher to canvas tools"
```

---

### Task 12: Replace chat/message rendering with canvas cards, open/focus behavior, and deterministic legacy handling

**Files:**

- Modify: `components/chat.tsx`
- Modify: `components/chat-request.ts`
- Modify: `components/chat-messages.tsx`
- Modify: `components/render-message.tsx`
- Create: `components/tool-ui/canvas-artifact-card.tsx`
- Modify: `components/tool-ui/registry.tsx`
- Modify: `lib/utils/message-mapping.ts`
- Test: `components/chat.test.tsx`
- Test: `lib/utils/__tests__/message-mapping-display-tools.test.ts`

- [ ] **Step 1: Write the failing UI/integration tests**

Cover:

- chat opens/focuses the same canvas artifact for repeated persisted parts
- guest canvas token is taken from the latest persisted `data-canvasArtifactStatus`
- legacy parts show the legacy notice, not a new canvas artifact

```tsx
it('opens the same canvas artifact instead of creating a new one when a later update arrives', () => {
  render(<Chat savedMessages={makeCanvasMessages('artifact-1')} />)

  expect(openCanvasArtifact).toHaveBeenCalledWith(
    expect.objectContaining({ artifactId: 'artifact-1' })
  )
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- components/chat.test.tsx lib/utils/__tests__/message-mapping-display-tools.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement the chat/canvas wiring**

Required behavior:

- persisted `data-canvasArtifact` / `data-canvasArtifactStatus` parts are enough to reopen the artifact later
- ephemeral `data-canvasArtifactEvent` / `data-canvasDiagnostics` stay transient only
- `Chat` stores the latest `guestCanvasToken` in a ref/state under the new canvas part names
- `render-message.tsx` renders `CanvasArtifactCard`
- `components/tool-ui/registry.tsx` registers `canvasArtifactCard` and removes the old artifact card
- legacy artifact references call `openLegacyCanvasNotice(...)`

- [ ] **Step 4: Re-run the tests**

Run: `bun run test -- components/chat.test.tsx lib/utils/__tests__/message-mapping-display-tools.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/chat.tsx components/chat-request.ts components/chat-messages.tsx components/render-message.tsx components/tool-ui/canvas-artifact-card.tsx components/tool-ui/registry.tsx lib/utils/message-mapping.ts
git commit -m "feat: connect chat rendering and transport to canvas artifacts"
```

---

## Chunk 5: Milestone D — Cleanup, Docs, and Final Verification

### Task 13: Finish docs/reference cleanup for the new canvas architecture only

**Files:**

- Modify: `CLAUDE.md`
- Modify: `docs/getting-started/ENVIRONMENT.md`
- Modify: `docs/reference/API.md`
- Modify: `docs/reference/FILE-INDEX.md`
- Modify: `docs/superpowers/specs/2026-03-18-canvas-artifact-replacement-design.md` only if implementation forced a minor wording correction

- [ ] **Step 1: Write the failing regression check**

Run:

```bash
rg -n "createWebappArtifact|updateWebappArtifact|getArtifactStatus|restartArtifactPreview|E2B|sandbox preview|artifact_runtime_sessions|ENABLE_ARTIFACTS|NEXT_PUBLIC_ENABLE_ARTIFACTS" docs app components lib CLAUDE.md
```

Expected before doc cleanup: remaining matches in docs/reference or comments

- [ ] **Step 2: Update docs to the new canvas model only**

Make sure current docs mention:

- canvas endpoints
- server-side compile pipeline
- guest canvas token
- one-artifact-per-chat
- legacy notice behavior
- canvas is always-on in this repo in v1
- no contributor guidance still describes artifact behavior as flag-gated

- [ ] **Step 3: Re-run the regression grep**

Run:

```bash
rg -n "createWebappArtifact|updateWebappArtifact|getArtifactStatus|restartArtifactPreview|E2B|artifact_runtime_sessions|ENABLE_ARTIFACTS|NEXT_PUBLIC_ENABLE_ARTIFACTS" app components lib docs/reference docs/getting-started CLAUDE.md
```

Expected: no matches in active runtime code or current docs

- [ ] **Step 4: Commit**

```bash
git add docs CLAUDE.md
git commit -m "docs: document canvas artifact system as the only active model"
```

---

### Task 14: Run the final regression gates and only then mark the branch ready

**Files:**

- Test: entire repo

- [ ] **Step 1: Run targeted migration regression checks**

Run:

```bash
rg -n "createWebappArtifact|updateWebappArtifact|getArtifactStatus|restartArtifactPreview|data-artifact(Status|Log|Event)?|artifact_runtime_sessions|ENABLE_ARTIFACTS|NEXT_PUBLIC_ENABLE_ARTIFACTS|E2B_API_KEY|sandboxId|previewUrl" app components lib
```

Expected: no matches in active runtime code

- [ ] **Step 2: Run the full test suite**

Run: `bun run test`
Expected: PASS

- [ ] **Step 3: Run lint, typecheck, and build**

Run: `bun lint`
Expected: PASS

Run: `bun typecheck`
Expected: PASS

Run: `bun run build`
Expected: PASS

- [ ] **Step 4: Sanity-check milestone acceptance criteria**

Verify manually from the finished branch:

- one chat maps to one active canvas artifact
- live preview renders from `iframe.srcdoc`
- editor updates draft source and recompiles
- AI updates mutate the same artifact
- version save/restore works
- export downloads one `.html` file
- legacy references fail closed into the legacy notice
- old E2B artifact runtime is gone from active code/docs/prompts
- no runtime or config surface still gates canvas behavior behind `ENABLE_ARTIFACTS` or `NEXT_PUBLIC_ENABLE_ARTIFACTS`

- [ ] **Step 5: Request code review**

Use [$requesting-code-review](/Users/nick/.agents/skills/requesting-code-review/SKILL.md) for the finished branch.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat: replace E2B artifacts with canvas artifact system"
```

---

## Milestone Acceptance Summary

### Stage 1

- no active old-artifact runtime imports remain
- no active docs describe E2B artifacts as current behavior
- the app still builds with a minimal canvas namespace and deterministic legacy notice path

### Milestone A

- source compiles deterministically into one HTML artifact
- draft/version persistence is explicit and conflict-safe
- preview isolation is enforced by `iframe.srcdoc`, `sandbox="allow-scripts"`, nonce checks, and locked CSP

### Milestone B

- users can edit the constrained virtual files in-browser
- compile/runtime diagnostics are visible without replacing the last successful preview
- explicit version save/restore works

### Milestone C

- one chat consistently maps to one active canvas artifact
- AI and manual edits converge on the same `draftRevision`-guarded draft
- guest token handling and legacy notice handling are deterministic

### Milestone D

- no active E2B artifact references remain in runtime code, prompts, or current docs
- full test, lint, typecheck, and build gates pass

---

Plan complete and saved to `docs/superpowers/plans/2026-03-18-canvas-artifact-replacement-implementation.md`. Ready to execute?

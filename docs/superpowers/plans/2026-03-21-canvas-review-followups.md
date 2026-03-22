# Canvas Review Followups Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the validated PR review issues in the new canvas artifact pipeline without reintroducing the removed E2B system concepts.

**Architecture:** Fix the confirmed issues in three slices: compiler HTML assembly hardening, service/route correctness, and cleanup of stale canvas/artifact terminology and duplicated tool validation. Each slice adds or updates tests first, then applies the minimal code changes needed to satisfy them.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Zod, Drizzle, Bun

---

### Task 1: Compiler hardening

**Files:**

- Modify: `lib/canvas/compiler/assemble-canvas-html.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.ts`
- Test: `lib/canvas/compiler/compile-canvas-artifact.test.ts`

- [ ] Add failing compiler tests for escaped viewport content, sanitized `</style>` sequences, and rejected unresolved `../` imports.
- [ ] Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
- [ ] Update HTML assembly to escape `meta.viewport` and neutralize closing `</style>` sequences before string interpolation.
- [ ] Tighten the virtual resolver so unresolved relative imports from the virtual namespace return an explicit virtual-file error instead of falling through to esbuild.
- [ ] Re-run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`

### Task 2: Service and route correctness

**Files:**

- Modify: `lib/canvas/service.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts`
- Test: `lib/canvas/service.test.ts`
- Test: `app/api/canvas-artifacts/[artifactId]/route.test.ts`
- Test: `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts`

- [ ] Add failing tests covering stale second draft updates, restore compile failure metadata, single guest-token verification reuse, and invalid runtime-diagnostics payload shapes.
- [ ] Run: `bun run test -- lib/canvas/service.test.ts 'app/api/canvas-artifacts/[artifactId]/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts'`
- [ ] Update service methods to handle `updateCanvasArtifactDraft()` returning `null` on the second write path and return structured errors for restore compile failures.
- [ ] Reuse the already-verified guest token payload in the GET route instead of verifying twice.
- [ ] Add Zod-backed request validation for runtime diagnostics, including `draftRevision` type checks and per-diagnostic object validation.
- [ ] Re-run: `bun run test -- lib/canvas/service.test.ts 'app/api/canvas-artifacts/[artifactId]/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts'`

### Task 3: Cleanup, naming, and low-risk UI correctness

**Files:**

- Modify: `lib/actions/chat.ts`
- Modify: `components/action-buttons.tsx`
- Modify: `components/chat-panel.tsx`
- Modify: `components/video-result-grid.tsx`
- Modify: `components/video-search-results.tsx`
- Modify: `lib/types/message-persistence.ts`
- Modify: `lib/tools/create-canvas-artifact.ts`
- Modify: `lib/tools/update-canvas-artifact.ts`
- Create: `lib/tools/canvas-file-schema.ts`
- Modify: `components/canvas/canvas-context.tsx`
- Modify: `components/canvas/canvas-editor.tsx`
- Modify: `components/canvas/canvas-workspace.tsx`
- Test: existing component/tool tests as needed

- [ ] Remove the stale `artifact` cache tag invalidations from chat actions.
- [ ] Rename remaining `artifactsEnabled` and `'artifact'` display-mode leftovers to canvas/workspace terminology.
- [ ] Remove stale `'artifact'` from `DynamicToolType`.
- [ ] Extract the shared canvas file normalization/schema into a single module and remove the unused `changeSummary` input.
- [ ] Fix the low-risk React correctness issues validated during review: memoize `CanvasContext` provider value, switch editor updates to functional state composition, and extract code-tab content rendering to a stable component boundary.
- [ ] Run targeted tests for touched canvas components and tools.

### Final verification

**Files:**

- Modify only if verification exposes issues

- [ ] Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts lib/canvas/service.test.ts 'app/api/canvas-artifacts/[artifactId]/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.test.ts' components/canvas/canvas-context.test.tsx components/canvas/canvas-workspace.test.tsx`
- [ ] Run: `bun lint`
- [ ] Run: `bun typecheck`
- [ ] Summarize which review claims were validated, which were outdated or overstated, and what remains intentionally unfixed.

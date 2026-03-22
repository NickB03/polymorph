# Canvas Artifact Runtime Recovery Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore end-to-end canvas artifact generation and rendering by fixing the request-time React resolution failure, then harden the canvas workspace handoff and close the remaining sign-off gaps.

**Architecture:** Keep the new canvas pipeline in place. First, make the compiler’s bare-specifier resolution observable and resilient under the Next.js + Bun request runtime. Second, harden the streamed tool output to workspace-open handoff, especially for guest token timing. Third, add the regression coverage and live verification that the current status update still lacks.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Bun, esbuild, Vitest, Tailwind CSS v4, Drizzle, Supabase

---

## Chunk 1: Compiler Runtime Root Cause

### Task 1: Make bare-specifier resolution observable and reproducible

**Owner:** Agent A (`compiler-runtime`)

**Files:**

- Modify: `lib/canvas/compiler/compile-canvas-artifact.ts`
- Test: `lib/canvas/compiler/compile-canvas-artifact.test.ts`

- [ ] **Step 1: Write the failing resolver fallback test**

Add a focused test in `lib/canvas/compiler/compile-canvas-artifact.test.ts` that exercises a new resolver helper. The test should prove this case:

```ts
it('falls back when cwd-based resolution fails but module-relative resolution succeeds', async () => {
  // Arrange: first resolver path fails, fallback path succeeds
  // Assert: compile still succeeds and React is bundled
})
```

Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: FAIL because only the cwd-based `require.resolve(..., { paths: [process.cwd()] })` path exists today.

- [ ] **Step 2: Extract a single resolver helper with explicit fallback order**

In `lib/canvas/compiler/compile-canvas-artifact.ts`, replace the silent inline resolver at lines 71-79 with a helper that tries, in order:

```ts
resolveBareSpecifier(specifier) {
  // 1. require.resolve(specifier, { paths: [process.cwd()] })
  // 2. require.resolve(specifier)
  // 3. createRequire(import.meta.url).resolve(specifier)
}
```

Return both the resolved path and the method used so the compiler can log which branch worked.

- [ ] **Step 3: Stop swallowing resolver errors**

When all resolver attempts fail, emit a structured compiler diagnostic that includes:

- specifier
- `process.cwd()`
- which resolver methods were attempted
- the first thrown error message

This replaces the current generic esbuild-level `"Could not resolve \"react\""` failure with evidence that points to the real root cause.

- [ ] **Step 4: Add env-gated runtime diagnostics**

Gate request-time logging behind `DEBUG_CANVAS_COMPILER=1`. Log:

- `artifactId`
- `revisionId`
- `process.cwd()`
- `process.versions.node`
- `process.versions.bun`
- `typeof require`
- resolver attempts/results for `react`, `react-dom/client`, and `react/jsx-runtime`

Do not leave unconditional noisy logs in the final implementation.

- [ ] **Step 5: Re-run the focused compiler suite**

Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: PASS, including the new resolver fallback coverage.

- [ ] **Step 6: Reproduce once under the real request runtime**

Run: `DEBUG_CANVAS_COMPILER=1 bun dev`
Expected: dev server starts on `http://localhost:43100`

Then trigger a minimal canvas artifact creation from the app UI and capture one server log sample showing which resolver branch succeeded or failed under the request runtime.

- [ ] **Step 7: Commit**

```bash
git add lib/canvas/compiler/compile-canvas-artifact.ts lib/canvas/compiler/compile-canvas-artifact.test.ts
git commit -m "fix: harden canvas compiler module resolution"
```

### Task 2: Surface compile failure context at the service boundary

**Owner:** Agent A (`compiler-runtime`)

**Files:**

- Modify: `lib/canvas/service.ts`
- Create: `lib/canvas/service.integration.test.ts`
- Test: `lib/canvas/service.integration.test.ts`

- [ ] **Step 1: Write the failing service integration test**

Create `lib/canvas/service.integration.test.ts` that keeps DB actions mocked but uses the real compiler. Cover:

- `createCanvasArtifactFromSource()`
- `updateCanvasArtifactDraftFromSource()`
- `restoreCanvasArtifactVersion()`

Each case should assert that compile failure diagnostics are preserved on the resulting artifact state instead of being reduced to a generic failure.

Run: `bun run test -- lib/canvas/service.integration.test.ts`
Expected: FAIL because the request-time context and first diagnostic are not surfaced clearly enough today.

- [ ] **Step 2: Add operation-aware failure logging**

In `lib/canvas/service.ts`, at the compile call sites currently around lines 225, 304, and 411, log:

- operation name (`create`, `update`, `restore`)
- `artifactId`
- `draftRevision`
- first compile diagnostic

Keep this logging concise and stable so it remains usable in dev server traces.

- [ ] **Step 3: Preserve structured diagnostics through draft updates**

Verify that the service keeps the compiler’s structured diagnostics intact in `draftDiagnostics.compile` for all three operations and does not overwrite them with less specific errors.

- [ ] **Step 4: Run the service integration tests**

Run: `bun run test -- lib/canvas/service.integration.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/canvas/service.ts lib/canvas/service.integration.test.ts
git commit -m "test: cover canvas service compile integration"
```

## Chunk 2: Workspace Handoff And Preview Contract

### Task 3: Fix the guest-token workspace-open race

**Owner:** Agent B (`workspace-handoff`)

**Files:**

- Modify: `components/chat.tsx`
- Modify: `components/canvas/canvas-context.tsx`
- Create: `components/canvas/canvas-context.test.tsx`
- Modify: `components/chat.test.tsx`

- [ ] **Step 1: Write the failing guest handoff test**

Add a component test that streams these parts in order:

- `data-canvasArtifactStatus` with `guestCanvasToken`
- `data-canvasArtifact` with `artifactId`

Assert that the first `openCanvasArtifact()` fetch includes the guest token and does not 401.

Run: `bun run test -- components/chat.test.tsx components/canvas/canvas-context.test.tsx`
Expected: FAIL because `components/chat.tsx` stores the token and `components/canvas/canvas-context.tsx` reads the stateful token later, leaving a race on first open.

- [ ] **Step 2: Change the API so first-open uses the fresh token**

Pick one of these approaches and keep it consistent:

- pass the token explicitly from `components/chat.tsx` into `openCanvasArtifact(artifactId, guestToken)`
- or change `CanvasProvider` to read from a synchronous ref rather than waiting for React state

Do not rely on state timing for the first guest fetch.

- [ ] **Step 3: Cover authenticated and guest flows**

The new tests must prove:

- authenticated open works without a token
- guest open includes the token on first fetch
- repeated opens focus the existing artifact without unnecessary re-fetches

- [ ] **Step 4: Re-run the handoff tests**

Run: `bun run test -- components/chat.test.tsx components/canvas/canvas-context.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/chat.tsx components/chat.test.tsx components/canvas/canvas-context.tsx components/canvas/canvas-context.test.tsx
git commit -m "fix: remove guest canvas workspace open race"
```

### Task 4: Make preview host and bootstrap follow one contract

**Owner:** Agent B (`workspace-handoff`)

**Files:**

- Modify: `components/canvas/canvas-preview.tsx`
- Modify: `lib/canvas/compiler/assemble-canvas-html.ts`
- Modify: `components/canvas/canvas-preview.test.tsx`

- [ ] **Step 1: Write the failing preview contract test**

Add a test that uses compiled HTML output, not a synthetic message, to verify the preview bootstrap sends the messages that the host actually expects.

Minimum cases:

- `preview-ready`
- no runtime diagnostics on the happy path
- `height-change` support is either implemented end-to-end or removed from the host contract

Run: `bun run test -- components/canvas/canvas-preview.test.tsx lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: FAIL because the host listens for `height-change` but the bootstrap in `lib/canvas/compiler/assemble-canvas-html.ts` never emits it.

- [ ] **Step 2: Pick one protocol and implement it fully**

Choose one:

- emit `height-change` from the bootstrap after mount and on size changes
- or remove host-side `height-change` handling if fixed-height preview is the intended contract

Do not leave host and iframe behavior out of sync.

- [ ] **Step 3: Verify runtime diagnostic posting still works**

Preserve the current runtime reporting behavior for:

- `runtime-error`
- `unhandled-rejection`
- `asset-error`
- `external-request-error`

- [ ] **Step 4: Re-run preview and compiler tests**

Run: `bun run test -- components/canvas/canvas-preview.test.tsx lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add components/canvas/canvas-preview.tsx components/canvas/canvas-preview.test.tsx lib/canvas/compiler/assemble-canvas-html.ts lib/canvas/compiler/compile-canvas-artifact.test.ts
git commit -m "fix: align canvas preview host and bootstrap protocol"
```

## Chunk 3: Regression Coverage And Sign-Off

### Task 5: Add regression tests for the completed canvas persistence/rendering fixes

**Owner:** Agent C (`signoff-coverage`)

**Files:**

- Modify: `lib/utils/__tests__/message-mapping-display-tools.test.ts`
- Create: `components/tool-ui/registry.test.tsx`
- Test: `lib/utils/__tests__/message-mapping-display-tools.test.ts`
- Test: `components/tool-ui/registry.test.tsx`

- [ ] **Step 1: Write the failing message-mapping regression tests**

Add test cases proving that:

- `tool-createCanvasArtifact`
- `tool-updateCanvasArtifact`

persist through `mapUIMessagePartsToDBParts()` as `tool-dynamic` with preserved `toolCallId`, input, output, and provider metadata, and round-trip back through `mapDBPartToUIMessagePart()`.

Run: `bun run test -- lib/utils/__tests__/message-mapping-display-tools.test.ts`
Expected: FAIL if the new canvas cases are not explicitly covered.

- [ ] **Step 2: Write the failing registry coverage test**

Create `components/tool-ui/registry.test.tsx` that proves:

- `createCanvasArtifact` renders through `tryRenderCanvasArtifactCard()`
- `updateCanvasArtifact` renders through `tryRenderCanvasArtifactCard()`
- unrelated tool names still fall back correctly

Run: `bun run test -- components/tool-ui/registry.test.tsx`
Expected: FAIL because there is no direct registry test yet.

- [ ] **Step 3: Implement or adjust the tests until they reflect the current fixes**

The code changes in `lib/utils/message-mapping.ts` and `components/tool-ui/registry.tsx` should remain minimal. This task is mainly about locking in the already-completed behavior.

- [ ] **Step 4: Re-run the focused regression suite**

Run: `bun run test -- lib/utils/__tests__/message-mapping-display-tools.test.ts components/tool-ui/registry.test.tsx`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/__tests__/message-mapping-display-tools.test.ts components/tool-ui/registry.test.tsx
git commit -m "test: lock canvas tool persistence and registry coverage"
```

### Task 6: Finish sign-off verification for docs, DB, and end-to-end behavior

**Owner:** Agent C (`signoff-coverage`)

**Files:**

- Modify: `README.md`
- Modify: `SECURITY.md`
- Modify: `CHANGELOG.md`
- Modify if needed: `docs/architecture/OVERVIEW.md`
- Modify if needed: `docs/reference/API.md`

- [ ] **Step 1: Remove stale “current E2B artifact” wording from active docs**

Search and update the remaining active references that still present E2B artifact tooling as current behavior.

Run: `rg -n "E2B|createWebappArtifact|updateWebappArtifact|getArtifactStatus|restartArtifactPreview" README.md SECURITY.md CHANGELOG.md docs`
Expected: only historical references remain after the edit, not current-state guidance.

- [ ] **Step 2: Verify the live DB state, not just migration files**

Run:

```bash
bun run migrate
psql "$DATABASE_URL" -c "\dt canvas_*"
psql "$DATABASE_URL" -c "select schemaname, tablename, policyname from pg_policies where tablename in ('canvas_artifacts','canvas_artifact_versions');"
```

Expected:

- both `canvas_artifacts` and `canvas_artifact_versions` exist
- RLS policies are present for both tables

- [ ] **Step 3: Run the end-to-end manual recovery checklist**

Use the app with one authenticated session and one guest session. Verify:

- a minimal artifact compiles to `ready`
- `GET /api/canvas-artifacts/:id` returns 200 on first open
- the workspace shell appears
- the preview iframe gets non-empty `srcDoc`
- the iframe posts `preview-ready`
- editing `App.tsx` increments `draftRevision`
- save version, restore version, and export all succeed

- [ ] **Step 4: Run the full repo quality gates**

Run:

```bash
bun lint
bun typecheck
bun run test
```

Expected:

- lint clean
- typecheck clean
- full Vitest suite green

- [ ] **Step 5: Commit**

```bash
git add README.md SECURITY.md CHANGELOG.md docs
git commit -m "docs: finish canvas rollout signoff"
```

## Execution Order

1. Agent A completes Chunk 1 before any other agent changes compiler behavior.
2. Agent B can start Task 3 in parallel once Agent A has enough evidence to avoid changing the wrong boundary.
3. Agent C can start Task 5 immediately because it locks in already-landed fixes.
4. Task 6 happens last because it depends on the compile path and workspace handoff both being healthy.

## Review Notes

- Supported by code already:
  - canvas tool persistence fix in `lib/utils/message-mapping.ts`
  - canvas artifact card registration in `components/tool-ui/registry.tsx`
  - targeted docs fixes in `docs/architecture/RESEARCH-AGENT.md` and `GEMINI.md`
  - migration files in `drizzle/0013_canvas_artifacts.sql` and `lib/db/schema.ts`
- Not fully signed off yet:
  - real request-runtime compiler resolution
  - guest workspace-open token race
  - preview host/bootstrap contract mismatch
  - targeted regression coverage for canvas tool persistence and registry
  - live DB table/RLS verification
  - remaining active docs that still describe E2B as current

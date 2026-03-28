# Canvas Artifact Quality Uplift Execution Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the reviewed canvas uplift on top of the clean branch: conservative source repair, a safe image proxy/runtime helper, and shared prompt guidance that improves artifact quality without breaking the existing Tool UI intake flow.

**Architecture:** The current branch has the baseline canvas compiler, service, prompt, and artifact routes, but none of the uplift work. The implementation should start by adding a pure source pre-processor pipeline before validation/bundling, then layer in the two bounded repairs (`fixMissingDefaultExport`, `fixHallucinatedImports`), then add the rate-limited image proxy and runtime helper, and only then refactor the duplicated prompt text into a shared canvas section. Existing service and Tool UI behavior stays intact; the main routing change is a narrow search-first exception for factual/current-data artifact requests.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, esbuild, Vitest, Brave search provider, Upstash Redis rate limiting

---

## Locked scope

- This is a **scoped canvas reliability + prompt-quality uplift**, not parity with the Google system or paper.
- Keep the existing `displayQuestionWizard` intake flow for broad/open artifact requests.
- Normal build requests still skip search.
- Exception: when the requested artifact depends on specific entities, freshness, dates, statistics, or other current facts, the agent should search first and then build.
- `fixHallucinatedImports` is conservative: strip only unused unsupported single-line static imports from `.tsx` files.
- `fixMissingDefaultExport` only repairs supported `App.tsx` declaration patterns.
- `window.__CANVAS_IMAGE_BASE__` is a stable internal runtime helper for generated artifact code.
- `/api/canvas-assets/image-proxy` stays public-read but is IP-rate-limited, `https`-only, no-CORS, and browser-private-cache only.

## File map

### Create

- `docs/superpowers/plans/2026-03-28-canvas-artifact-quality-uplift-execution.md`
- `lib/canvas/pre-processors/run-pre-processors.ts`
- `lib/canvas/pre-processors/run-pre-processors.test.ts`
- `lib/canvas/pre-processors/fix-missing-default-export.ts`
- `lib/canvas/pre-processors/fix-missing-default-export.test.ts`
- `lib/canvas/pre-processors/fix-hallucinated-imports.ts`
- `lib/canvas/pre-processors/fix-hallucinated-imports.test.ts`
- `app/api/canvas-assets/image-proxy/route.ts`
- `app/api/canvas-assets/image-proxy/route.test.ts`

### Modify

- `lib/canvas/compiler/compile-canvas-artifact.ts`
- `lib/canvas/compiler/compile-canvas-artifact.test.ts`
- `lib/canvas/compiler/assemble-canvas-html.ts`
- `lib/canvas/service.integration.test.ts`
- `lib/rate-limit/canvas-limits.ts`
- `lib/rate-limit/__tests__/canvas-limits.test.ts`
- `lib/agents/prompts/search-mode-prompts.ts`
- `lib/agents/prompts/search-mode-prompts.test.ts`

### Reference while implementing

- `lib/canvas/validation/validate-canvas-source.ts`
- `lib/canvas/service.ts`
- `lib/tools/create-canvas-artifact.ts`
- `lib/tools/update-canvas-artifact.ts`
- `lib/tools/search/providers/brave.ts`
- `.impeccable.md`

---

## Task 1: Add the pre-processor pipeline seam

**Files:**

- Create: `lib/canvas/pre-processors/run-pre-processors.ts`
- Create: `lib/canvas/pre-processors/run-pre-processors.test.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.test.ts`

- [ ] **Step 1: Write the failing pipeline unit tests**

Add tests for:

- unchanged source returns equal content
- input object is not mutated
- non-TSX files are passed through unchanged
- pre-processors run before validation/bundling when wired into the compiler

- [ ] **Step 2: Run the new test file and verify it fails**

Run: `bun run test -- lib/canvas/pre-processors/run-pre-processors.test.ts`
Expected: FAIL because the pipeline file does not exist yet.

- [ ] **Step 3: Implement `runPreProcessors(source)`**

Behavior:

- accept `CanvasSourceFiles`
- clone the source object
- run all future source transforms in order
- return a new `CanvasSourceFiles` object
- do not fabricate files or runtime stubs

- [ ] **Step 4: Wire the pipeline into the compiler**

In `compile-canvas-artifact.ts`:

- call `runPreProcessors(source)` before `validateCanvasSource(...)`
- use `processedSource` for validation, meta parsing, CSS building, and esbuild input
- leave the compiler result shape unchanged

- [ ] **Step 5: Run the targeted compiler tests**

Run:

- `bun run test -- lib/canvas/pre-processors/run-pre-processors.test.ts`
- `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
  Expected: PASS for the new pipeline seam coverage.

- [ ] **Step 6: Commit**

```bash
git add lib/canvas/pre-processors/run-pre-processors.ts lib/canvas/pre-processors/run-pre-processors.test.ts lib/canvas/compiler/compile-canvas-artifact.ts lib/canvas/compiler/compile-canvas-artifact.test.ts
git commit -m "feat(canvas): add source pre-processor pipeline"
```

---

## Task 2: Implement missing default export repair

**Files:**

- Create: `lib/canvas/pre-processors/fix-missing-default-export.ts`
- Create: `lib/canvas/pre-processors/fix-missing-default-export.test.ts`
- Modify: `lib/canvas/pre-processors/run-pre-processors.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.test.ts`
- Modify: `lib/canvas/service.integration.test.ts`

- [ ] **Step 1: Write failing repair tests**

Add test cases for:

- `function App() {}`
- `export function App() {}`
- `const App = () => {}`
- `export const App = () => {}`
- existing default export is left untouched
- unsupported patterns are left untouched
- files other than `App.tsx` are untouched

- [ ] **Step 2: Run the repair test file and verify it fails**

Run: `bun run test -- lib/canvas/pre-processors/fix-missing-default-export.test.ts`
Expected: FAIL because the repair file does not exist yet.

- [ ] **Step 3: Implement the supported repair logic**

Rules:

- only inspect `App.tsx`
- if `App.tsx` already has a default export, return unchanged
- if exactly one supported `App` declaration exists, append `export default App`
- leave unsupported shapes unchanged

- [ ] **Step 4: Register the repair in the pipeline**

Update `run-pre-processors.ts` so `fixMissingDefaultExport` runs before validation.

- [ ] **Step 5: Add compiler and service-path regression tests**

Add:

- one compiler test showing source with a supported `App` declaration now compiles
- one service integration test showing `createCanvasArtifactFromSource(...)` succeeds when the only issue was a missing default export
- one service integration test showing `updateCanvasArtifactDraftFromSource(...)` succeeds on the same kind of repaired source

- [ ] **Step 6: Run the targeted tests**

Run:

- `bun run test -- lib/canvas/pre-processors/fix-missing-default-export.test.ts`
- `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
- `bun run test -- lib/canvas/service.integration.test.ts`
  Expected: PASS for supported repairs and no-op unsupported cases.

- [ ] **Step 7: Commit**

```bash
git add lib/canvas/pre-processors/fix-missing-default-export.ts lib/canvas/pre-processors/fix-missing-default-export.test.ts lib/canvas/pre-processors/run-pre-processors.ts lib/canvas/compiler/compile-canvas-artifact.test.ts lib/canvas/service.integration.test.ts
git commit -m "feat(canvas): repair missing App default export"
```

---

## Task 3: Implement conservative hallucinated import repair

**Files:**

- Create: `lib/canvas/pre-processors/fix-hallucinated-imports.ts`
- Create: `lib/canvas/pre-processors/fix-hallucinated-imports.test.ts`
- Modify: `lib/canvas/pre-processors/run-pre-processors.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.test.ts`
- Modify: `lib/canvas/service.integration.test.ts`

- [ ] **Step 1: Write failing import-repair tests**

Cover:

- strips unused unsupported default imports
- strips unused unsupported named imports
- strips unused unsupported namespace or mixed imports
- strips unused remote ESM imports
- preserves allowed package imports
- preserves relative imports
- preserves disallowed imports when any imported binding is still referenced
- ignores CSS and non-TSX files
- does not mutate the original source

- [ ] **Step 2: Run the repair test file and verify it fails**

Run: `bun run test -- lib/canvas/pre-processors/fix-hallucinated-imports.test.ts`
Expected: FAIL because the repair file does not exist yet.

- [ ] **Step 3: Implement unused-only stripping**

Rules:

- only inspect `.tsx` files
- only rewrite single-line static `import ... from 'x'`
- preserve side-effect imports, multiline imports, `require`, `import()`, and re-exports
- only remove the import when every imported local binding is unused in the rest of the file
- if any binding remains referenced, leave the import unchanged so the current validator/compiler path fails clearly

- [ ] **Step 4: Register the repair in the pipeline**

Order:

- run `fixMissingDefaultExport`
- then run `fixHallucinatedImports`

- [ ] **Step 5: Add compiler and service negative-path coverage**

Add tests that prove:

- unused hallucinated imports no longer block compile
- referenced unsupported imports still surface diagnostics through compile/service flows
- create/update continue returning actionable structured errors when the import stays referenced

- [ ] **Step 6: Run the targeted tests**

Run:

- `bun run test -- lib/canvas/pre-processors/fix-hallucinated-imports.test.ts`
- `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
- `bun run test -- lib/canvas/service.integration.test.ts`
  Expected: PASS, with referenced unsupported imports still failing clearly.

- [ ] **Step 7: Commit**

```bash
git add lib/canvas/pre-processors/fix-hallucinated-imports.ts lib/canvas/pre-processors/fix-hallucinated-imports.test.ts lib/canvas/pre-processors/run-pre-processors.ts lib/canvas/compiler/compile-canvas-artifact.test.ts lib/canvas/service.integration.test.ts
git commit -m "feat(canvas): strip only unused hallucinated imports"
```

---

## Task 4: Add the safe image proxy route

**Files:**

- Create: `app/api/canvas-assets/image-proxy/route.ts`
- Create: `app/api/canvas-assets/image-proxy/route.test.ts`
- Modify: `lib/rate-limit/canvas-limits.ts`
- Modify: `lib/rate-limit/__tests__/canvas-limits.test.ts`

- [ ] **Step 1: Write failing route and rate-limit tests**

Route coverage:

- missing query -> `400`
- blank query -> `400`
- overlong query -> `400`
- Brave returns no image thumbnails -> `404`
- unsafe redirect target -> `404`
- provider failure -> `502`
- successful thumbnail redirect -> `302`
- no `Access-Control-Allow-Origin` header
- `Cache-Control` is private

Rate-limit coverage:

- `image-proxy` kind is recognized
- limit-exceeded result returns `429`

- [ ] **Step 2: Run the route and rate-limit tests and verify they fail**

Run:

- `bun run test -- app/api/canvas-assets/image-proxy/route.test.ts`
- `bun run test -- lib/rate-limit/__tests__/canvas-limits.test.ts`
  Expected: FAIL because the route and limit kind do not exist yet.

- [ ] **Step 3: Extend canvas rate limiting**

In `lib/rate-limit/canvas-limits.ts`:

- add the `image-proxy` kind
- set a concrete per-minute limit
- keep existing response shape and headers

- [ ] **Step 4: Implement the route**

Requirements:

- parse the client IP from `x-forwarded-for`, fallback to `'local-dev'`
- trim `q`
- reject empty queries
- reject length over 200
- call the Brave provider through the existing abstraction with `type: 'general'` and `content_types: ['image']`
- use the first `thumbnailUrl` only
- allow only `https:` URLs
- reject localhost, loopback, and private-literal IP redirect targets
- return `404` when no safe thumbnail exists
- return `502` on provider failures
- do not emit CORS headers
- set `Cache-Control: private, max-age=3600, stale-while-revalidate=86400`

- [ ] **Step 5: Run the targeted tests**

Run:

- `bun run test -- app/api/canvas-assets/image-proxy/route.test.ts`
- `bun run test -- lib/rate-limit/__tests__/canvas-limits.test.ts`
  Expected: PASS for query validation, redirect validation, rate limiting, and cache policy.

- [ ] **Step 6: Commit**

```bash
git add app/api/canvas-assets/image-proxy/route.ts app/api/canvas-assets/image-proxy/route.test.ts lib/rate-limit/canvas-limits.ts lib/rate-limit/__tests__/canvas-limits.test.ts
git commit -m "feat(canvas): add safe image proxy route"
```

---

## Task 5: Expose the stable runtime image helper

**Files:**

- Modify: `lib/canvas/compiler/assemble-canvas-html.ts`
- Modify: `lib/canvas/compiler/compile-canvas-artifact.test.ts`

- [ ] **Step 1: Write failing bootstrap tests**

Cover:

- compiled HTML contains `window.__CANVAS_IMAGE_BASE__`
- helper initializes from `window.location.origin`
- helper recomputes when host `init` provides `parentOrigin`
- existing preview bridge and diagnostics hooks remain intact

- [ ] **Step 2: Run the compiler test file and verify the new assertions fail**

Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: FAIL on the missing image helper assertions.

- [ ] **Step 3: Implement the helper in the bootstrap**

Behavior:

- initialize from `window.location.origin + '/api/canvas-assets/image-proxy'`
- keep `parentOrigin` handling for postMessage targeting
- when the `init` message provides `parentOrigin`, recompute `window.__CANVAS_IMAGE_BASE__`
- do not change CSP or preview diagnostics behavior
- keep `file://` exports as degraded mode by design, not by workaround

- [ ] **Step 4: Run the targeted test**

Run: `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
Expected: PASS for helper presence and bootstrap behavior.

- [ ] **Step 5: Commit**

```bash
git add lib/canvas/compiler/assemble-canvas-html.ts lib/canvas/compiler/compile-canvas-artifact.test.ts
git commit -m "feat(canvas): expose image proxy runtime helper"
```

---

## Task 6: Refactor and strengthen the canvas prompt

**Files:**

- Modify: `lib/agents/prompts/search-mode-prompts.ts`
- Modify: `lib/agents/prompts/search-mode-prompts.test.ts`
- Reference: `.impeccable.md`

- [ ] **Step 1: Write failing prompt tests**

Add direct assertions for both chat and research prompts:

- shared canvas prompt section exists in both
- planning guidance exists in both
- do/don't examples exist in both
- style guidance from repo defaults exists in both
- factual-grounding rule exists in both
- no-placeholder rule exists in both
- `window.__CANVAS_IMAGE_BASE__` usage guidance exists in both
- one-artifact-per-chat rule remains intact
- allowed file/import constraints remain intact
- chat mode keeps the displayPlan-only guidance
- research mode still excludes the chat-only displayPlan guidance

- [ ] **Step 2: Run the prompt test file and verify it fails**

Run: `bun run test -- lib/agents/prompts/search-mode-prompts.test.ts`
Expected: FAIL because the shared prompt and new assertions do not exist yet.

- [ ] **Step 3: Extract a shared canvas prompt builder**

In `search-mode-prompts.ts`:

- extract `getCanvasArtifactsPrompt()`
- replace the duplicated canvas sections in both prompt builders
- keep the existing Tool UI intake protocol intact

- [ ] **Step 4: Update top-level routing text**

Rules to encode in both prompt builders:

- normal build/create requests skip search
- modify/update requests still skip search
- research-then-build still researches first
- factual/current-data artifact requests perform a short search phase first, then build

- [ ] **Step 5: Add the missing quality rules**

Prompt additions:

- mandatory internal planning before writing artifact code
- do/don't examples focused on interactive-first artifacts
- repo-default style guidance derived from `.impeccable.md`
- explicit factual-grounding for entity/current-data artifacts
- explicit no-placeholder guidance
- image helper docs for thumbnail-grade results
- scoped wording that this is an uplift inspired by the paper, not reproduction of the full system

- [ ] **Step 6: Run the prompt tests**

Run: `bun run test -- lib/agents/prompts/search-mode-prompts.test.ts`
Expected: PASS with both prompts sharing the same canvas guidance and preserving the existing Tool UI behavior.

- [ ] **Step 7: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts lib/agents/prompts/search-mode-prompts.test.ts
git commit -m "feat(canvas): strengthen and share artifact prompts"
```

---

## Task 7: Final verification and manual smoke checks

**Files:** none

- [ ] **Step 1: Run the targeted suites**

Run:

- `bun run test -- lib/canvas/pre-processors/run-pre-processors.test.ts`
- `bun run test -- lib/canvas/pre-processors/fix-missing-default-export.test.ts`
- `bun run test -- lib/canvas/pre-processors/fix-hallucinated-imports.test.ts`
- `bun run test -- lib/canvas/compiler/compile-canvas-artifact.test.ts`
- `bun run test -- lib/canvas/service.integration.test.ts`
- `bun run test -- app/api/canvas-assets/image-proxy/route.test.ts`
- `bun run test -- lib/agents/prompts/search-mode-prompts.test.ts`
- `bun run test -- lib/rate-limit/__tests__/canvas-limits.test.ts`

- [ ] **Step 2: Run the broader project checks**

Run:

- `bun run test`
- `bun lint`
- `bun typecheck`

- [ ] **Step 3: Run one manual smoke scenario for positive behavior**

Use a source bundle with:

- `App.tsx` missing a default export but using a supported `App` declaration
- one unused unsupported import that should be removed
- one `<img>` whose `src` is built from `window.__CANVAS_IMAGE_BASE__`

Verify:

- compile succeeds
- preview renders
- image URL points at `/api/canvas-assets/image-proxy`

- [ ] **Step 4: Run one manual smoke scenario for negative behavior**

Use a source bundle with:

- a referenced unsupported import that should remain in place

Verify:

- compile fails
- diagnostics remain actionable through the current service path

- [ ] **Step 5: Final acceptance check**

Confirm all of these are true:

- referenced unsupported imports still fail clearly
- missing default export repairs work only for supported patterns
- image proxy is rate-limited and redirect-safe
- runtime helper is stable across normal preview boot and host init
- prompt rules are shared and directly tested
- Tool UI artifact intake flow remains intact

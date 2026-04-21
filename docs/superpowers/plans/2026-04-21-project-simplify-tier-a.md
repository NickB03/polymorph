# Project-Level Simplify: Tier A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply six surgical, high-confidence simplifications identified by a project-level simplify audit: extract two error-handling utilities to eliminate 20+ duplicates, move a render-path regex to module scope, collapse four redundant `message.parts` scans per render into a single memoized pass, memoize `extractToolUIFromText`, and parallelize independent work in the chat API route.

**Architecture:** Pure refactors — no behavioral changes, no new features. New utilities in `lib/utils/` and `lib/tools/search/providers/`. Render-path changes localized to `components/render-message.tsx`. Chat-route change is a single `Promise.all`. Each task is independently revertible and committed separately.

**Tech Stack:** TypeScript (strict), Next.js 16 App Router, React 19, Vitest, Bun.

---

## Context for the Engineer

The Polymorph codebase (`/Users/nick/Projects/vana-v2`) is an AI chat app with streaming responses. Key facts:

- **Streaming matters.** `components/render-message.tsx` is the main message renderer; it re-runs on every new streamed token. Work done inline in this component runs thousands of times per user message. Hoisting work into `useMemo([message.parts])` caches it across token updates.
- **No React.memo on RenderMessage.** Parent re-renders always re-execute the body. `useMemo` inside the component is the right tool.
- **Hooks-safety:** `RenderMessage` has an early return for user messages (`components/render-message.tsx:385`). Any `useMemo` must be placed **before** that early return to satisfy the rules of hooks.
- **Prettier config:** no semicolons, single quotes, no trailing commas, 2-space indent, avoid arrow parens, LF line endings.
- **Path alias:** `@/*` → project root.
- **Import order (ESLint `simple-import-sort`):** `react`/`next` → third-party → `@/types` → `@/config` → `@/lib` → `@/hooks` → `@/components/ui` → `@/components` → `@/registry` → `@/styles` → `@/app` → side effects → parents → relatives → styles.
- **Verification bar:** `bun lint` + `bun typecheck` + `bun run test` must pass before any commit.
- **Commit style (seen in recent history):** Conventional commits, lowercase subject. E.g. `fix(geo-map): …`, `feat(prompts): …`. Use `refactor(scope): …` or `perf(scope): …` where they fit.

---

## File Structure

### New files

- `lib/utils/error.ts` — `getErrorMessage(error: unknown): string` utility
- `lib/utils/__tests__/error.test.ts` — unit tests for `getErrorMessage`
- `lib/tools/search/providers/error-utils.ts` — `extractHttpErrorInfo(error: unknown)` utility
- `lib/tools/search/providers/__tests__/error-utils.test.ts` — unit tests for `extractHttpErrorInfo`

### Modified files

- `components/render-message.tsx` — move regex to module scope; consolidate 4 scans into one memoized pass; memoize `extractToolUIFromText` usage
- `app/api/chat/route.ts` — parallelize `cookies()` and `getCurrentUserId()`
- Error-utility callers (migrate to `getErrorMessage`): `lib/agents/generate-trending-suggestions.ts`, `lib/db/with-rls.ts`, `lib/tools/search.ts`, `lib/tools/search/advanced-search.ts`, `app/api/advanced-search/route.ts`, `lib/streaming/create-chat-stream-response.ts`, `lib/streaming/create-ephemeral-chat-stream-response.ts`, `lib/tools/search/providers/tavily.ts`, `lib/tools/search/providers/brave.ts`, `lib/tools/search/providers/exa.ts`, `lib/tools/search/providers/searxng.ts`, `lib/tools/search/providers/firecrawl.ts`, `lib/supabase/storage.ts`, `lib/canvas/service.ts`, `lib/utils/retry.ts`, `services/evals/src/golden/validate.ts`
- HTTP-error-utility callers (migrate to `extractHttpErrorInfo`): `lib/tools/search/providers/exa.ts`, `lib/tools/search/providers/firecrawl.ts`

---

## Task 1: Create `getErrorMessage` utility with TDD

**Why this first:** New pure function, zero risk to existing behavior. Establishes a stable target for the migration tasks that follow.

**Files:**

- Create: `lib/utils/error.ts`
- Create: `lib/utils/__tests__/error.test.ts`

- [ ] **Step 1.1: Write the failing tests**

Create `lib/utils/__tests__/error.test.ts` with:

```ts
import { describe, expect, it } from 'vitest'

import { getErrorMessage } from '../error'

describe('getErrorMessage', () => {
  it('returns the message for Error instances', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
  })

  it('returns the message for custom Error subclasses', () => {
    class MyError extends Error {}
    expect(getErrorMessage(new MyError('nested'))).toBe('nested')
  })

  it('stringifies non-Error values', () => {
    expect(getErrorMessage('plain string')).toBe('plain string')
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(null)).toBe('null')
    expect(getErrorMessage(undefined)).toBe('undefined')
  })

  it('stringifies objects without a message field', () => {
    expect(getErrorMessage({ foo: 'bar' })).toBe('[object Object]')
  })
})
```

- [ ] **Step 1.2: Run the tests and confirm they fail**

Run: `bun run test -- lib/utils/__tests__/error.test.ts`
Expected: FAIL — module `../error` cannot be resolved.

- [ ] **Step 1.3: Create the minimal implementation**

Create `lib/utils/error.ts`:

```ts
/**
 * Coerce an unknown value (typically a caught error) to a string message.
 * Mirrors the `error instanceof Error ? error.message : String(error)` pattern
 * duplicated across the codebase.
 */
export function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

- [ ] **Step 1.4: Run the tests and confirm they pass**

Run: `bun run test -- lib/utils/__tests__/error.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 1.5: Lint + typecheck**

Run: `bun lint && bun typecheck`
Expected: both pass with no new warnings.

- [ ] **Step 1.6: Commit**

```bash
git add lib/utils/error.ts lib/utils/__tests__/error.test.ts
git commit -m "refactor(utils): add getErrorMessage helper for unknown-error stringification"
```

---

## Task 2: Migrate callers to `getErrorMessage`

**Why:** Remove ~20 inline duplicates. Keeps behavior identical.

**Files (modify, one `.ts`/`.tsx` per subtask for clean reviewable diffs — batching all into one commit is fine since the change is mechanical):**

- `lib/agents/generate-trending-suggestions.ts:155`
- `lib/db/with-rls.ts:57`
- `lib/tools/search.ts:25`
- `lib/tools/search/advanced-search.ts:503`
- `app/api/advanced-search/route.ts:51`
- `lib/streaming/create-chat-stream-response.ts:332`
- `lib/streaming/create-ephemeral-chat-stream-response.ts:207`
- `lib/tools/search/providers/tavily.ts:72`
- `lib/tools/search/providers/brave.ts:156, 182, 221`
- `lib/tools/search/providers/exa.ts:62` (also appears at line 52 inside `new SearchProviderError(...)`)
- `lib/tools/search/providers/searxng.ts:78`
- `lib/tools/search/providers/firecrawl.ts:80` (and line 69)
- `lib/supabase/storage.ts:43`
- `lib/canvas/service.ts:154`
- `lib/utils/retry.ts:90`
- `services/evals/src/golden/validate.ts:128, 174`

- [ ] **Step 2.1: Grep for every occurrence of the pattern**

Run: `rg -n 'error instanceof Error \? error\.message : String\(error\)' --glob '!node_modules' --glob '!docs' --glob '!**/*.md'`
Expected: list of ~20 lines matching the callers above. Confirm the list matches before proceeding.

- [ ] **Step 2.2: For each file, replace the inline pattern with `getErrorMessage(error)`**

Example before/after for `lib/db/with-rls.ts:57`:

```ts
// Before
const errorMessage = error instanceof Error ? error.message : String(error)
```

```ts
// After
import { getErrorMessage } from '@/lib/utils/error'

// …later in function body
const errorMessage = getErrorMessage(error)
```

Apply equivalent transforms to every file listed above. For multi-occurrence files (`brave.ts`, `validate.ts`), replace each occurrence. Keep every other line — including surrounding log strings and interpolation — unchanged.

For `services/evals/src/golden/validate.ts`: this file lives in a separate service. Use the same `@/lib/utils/error` import if and only if path mapping is configured; otherwise use a relative import. Check `services/evals/tsconfig.json` — if `paths` does not include `@/*`, use a relative path like `../../../../lib/utils/error` **or** duplicate the utility inside `services/evals/src/utils/error.ts` (choose relative import — it's simpler and services/evals already does this for sibling utilities).

- [ ] **Step 2.3: Re-run the grep to confirm zero matches remain**

Run: `rg -n 'error instanceof Error \? error\.message : String\(error\)' --glob '!node_modules' --glob '!docs' --glob '!**/*.md'`
Expected: no matches. (If any matches remain, migrate them or note why they intentionally differ — e.g. they embed additional conditionals.)

- [ ] **Step 2.4: Lint + typecheck + test**

Run: `bun lint && bun typecheck && bun run test`
Expected: all pass. No existing test should change behavior.

- [ ] **Step 2.5: Commit**

```bash
git add -A
git commit -m "refactor: replace inline error-stringification with getErrorMessage"
```

---

## Task 3: Create `extractHttpErrorInfo` utility with TDD

**Why:** Search providers `exa.ts` and `firecrawl.ts` each do `(error as any)?.status` / `.statusText` / `.headers?.get?.('retry-after')`. Firecrawl uses `statusCode ?? status`. Consolidate into one typed helper so the `as any` lives in exactly one place.

**Files:**

- Create: `lib/tools/search/providers/error-utils.ts`
- Create: `lib/tools/search/providers/__tests__/error-utils.test.ts`

- [ ] **Step 3.1: Write the failing tests**

Create `lib/tools/search/providers/__tests__/error-utils.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { extractHttpErrorInfo } from '../error-utils'

describe('extractHttpErrorInfo', () => {
  it('extracts status from error.status', () => {
    const err = Object.assign(new Error('bad'), { status: 429 })
    expect(extractHttpErrorInfo(err).status).toBe(429)
  })

  it('prefers statusCode over status when both are present', () => {
    const err = Object.assign(new Error('bad'), {
      status: 500,
      statusCode: 429
    })
    expect(extractHttpErrorInfo(err).status).toBe(429)
  })

  it('extracts statusText', () => {
    const err = Object.assign(new Error('bad'), {
      statusText: 'Too Many Requests'
    })
    expect(extractHttpErrorInfo(err).statusText).toBe('Too Many Requests')
  })

  it('extracts retry-after from Headers-like object', () => {
    const err = Object.assign(new Error('bad'), {
      headers: { get: (name: string) => (name === 'retry-after' ? '30' : null) }
    })
    expect(extractHttpErrorInfo(err).retryAfter).toBe('30')
  })

  it('returns undefined fields when nothing is present', () => {
    expect(extractHttpErrorInfo(new Error('bare'))).toEqual({
      status: undefined,
      statusText: undefined,
      retryAfter: undefined
    })
  })

  it('is safe for non-Error values', () => {
    expect(extractHttpErrorInfo(null)).toEqual({
      status: undefined,
      statusText: undefined,
      retryAfter: undefined
    })
    expect(extractHttpErrorInfo('oops')).toEqual({
      status: undefined,
      statusText: undefined,
      retryAfter: undefined
    })
  })
})
```

- [ ] **Step 3.2: Run the tests and confirm they fail**

Run: `bun run test -- lib/tools/search/providers/__tests__/error-utils.test.ts`
Expected: FAIL — module `../error-utils` cannot be resolved.

- [ ] **Step 3.3: Create the implementation**

Create `lib/tools/search/providers/error-utils.ts`:

```ts
export interface HttpErrorInfo {
  status: number | undefined
  statusText: string | undefined
  retryAfter: string | undefined
}

/**
 * Extract HTTP-shaped fields (status, statusText, retry-after header) from an
 * unknown error. Search providers throw errors with different shapes —
 * Exa uses `status`, Firecrawl uses `statusCode`, both may expose a
 * Headers-like `headers.get(name)`. This helper centralizes the `any` coercion.
 */
export function extractHttpErrorInfo(error: unknown): HttpErrorInfo {
  if (typeof error !== 'object' || error === null) {
    return { status: undefined, statusText: undefined, retryAfter: undefined }
  }
  const err = error as {
    status?: unknown
    statusCode?: unknown
    statusText?: unknown
    headers?: { get?: (name: string) => string | null | undefined }
  }

  const rawStatus = err.statusCode ?? err.status
  const status = typeof rawStatus === 'number' ? rawStatus : undefined
  const statusText =
    typeof err.statusText === 'string' ? err.statusText : undefined
  const retryAfterHeader = err.headers?.get?.('retry-after')
  const retryAfter =
    typeof retryAfterHeader === 'string' ? retryAfterHeader : undefined

  return { status, statusText, retryAfter }
}
```

- [ ] **Step 3.4: Run the tests and confirm they pass**

Run: `bun run test -- lib/tools/search/providers/__tests__/error-utils.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 3.5: Lint + typecheck**

Run: `bun lint && bun typecheck`
Expected: both pass.

- [ ] **Step 3.6: Commit**

```bash
git add lib/tools/search/providers/error-utils.ts lib/tools/search/providers/__tests__/error-utils.test.ts
git commit -m "refactor(search): add extractHttpErrorInfo helper for provider error shapes"
```

---

## Task 4: Migrate `exa.ts` and `firecrawl.ts` to `extractHttpErrorInfo`

**Files:**

- Modify: `lib/tools/search/providers/exa.ts:40-48`
- Modify: `lib/tools/search/providers/firecrawl.ts:56-64`

- [ ] **Step 4.1: Update `exa.ts`**

Before (current state at `lib/tools/search/providers/exa.ts:36-57`):

```ts
} catch (error) {
  if (error instanceof SearchProviderError) {
    throw error
  }
  const status = (error as any)?.status
  if (typeof status === 'number') {
    throw createHttpSearchError(
      'exa',
      status,
      (error as any)?.statusText ?? String(error),
      (error as any)?.headers?.get?.('retry-after'),
      error
    )
  }
  throw new SearchProviderError({
    provider: 'exa',
    message:
      error instanceof Error ? error.message : 'Exa search failed',
    retryable: true,
    cause: error
  })
}
```

After (replace the `const status = …` block and pass shared fields to `createHttpSearchError`):

```ts
} catch (error) {
  if (error instanceof SearchProviderError) {
    throw error
  }
  const { status, statusText, retryAfter } = extractHttpErrorInfo(error)
  if (typeof status === 'number') {
    throw createHttpSearchError(
      'exa',
      status,
      statusText ?? String(error),
      retryAfter,
      error
    )
  }
  throw new SearchProviderError({
    provider: 'exa',
    message:
      error instanceof Error ? error.message : 'Exa search failed',
    retryable: true,
    cause: error
  })
}
```

Then add the import at the top of the file alongside existing imports:

```ts
import { extractHttpErrorInfo } from './error-utils'
```

Note: the `error instanceof Error ? error.message : 'Exa search failed'` line is deliberately _not_ migrated to `getErrorMessage` because it uses a custom fallback (`'Exa search failed'`), not `String(error)`. Leave it as-is.

- [ ] **Step 4.2: Update `firecrawl.ts`**

Before (current state at `lib/tools/search/providers/firecrawl.ts:52-65`):

```ts
} catch (error) {
  if (error instanceof SearchProviderError) {
    throw error
  }
  const status = (error as any)?.statusCode ?? (error as any)?.status
  if (typeof status === 'number') {
    throw createHttpSearchError(
      'firecrawl',
      status,
      (error as any)?.statusText ?? String(error),
      undefined,
      error
    )
  }
```

After:

```ts
} catch (error) {
  if (error instanceof SearchProviderError) {
    throw error
  }
  const { status, statusText, retryAfter } = extractHttpErrorInfo(error)
  if (typeof status === 'number') {
    throw createHttpSearchError(
      'firecrawl',
      status,
      statusText ?? String(error),
      retryAfter,
      error
    )
  }
```

Note: the original firecrawl call passed `undefined` for `retryAfter`. This is a deliberate improvement — firecrawl errors _may_ include a retry-after header via `err.headers.get('retry-after')`; previously we ignored it. If the reviewer flags this as a behavior change they don't want, revert to `undefined` for the fourth arg and add a comment: `// Firecrawl does not surface retry-after; callers rely on library retry`.

Add the import at the top:

```ts
import { extractHttpErrorInfo } from './error-utils'
```

- [ ] **Step 4.3: Confirm no other provider uses `(error as any)?.status`**

Run: `rg -n '\(error as any\)\?\.' lib/tools/search/providers`
Expected: zero matches after the above edits. If there are additional matches (e.g. in `tavily.ts`, `brave.ts`, `searxng.ts`), migrate them too using the same pattern.

- [ ] **Step 4.4: Lint + typecheck + test**

Run: `bun lint && bun typecheck && bun run test -- lib/tools/search`
Expected: all pass.

- [ ] **Step 4.5: Commit**

```bash
git add lib/tools/search/providers
git commit -m "refactor(search): use extractHttpErrorInfo in exa and firecrawl providers"
```

---

## Task 5: Move `stripDuplicateImageMarkdown` regex to module scope

**Why:** The regex literal `/!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)\n?/g` is recompiled on every call. Hoisting to module scope eliminates the allocation and guarantees a single compiled instance.

**Files:**

- Modify: `components/render-message.tsx:240-249`

- [ ] **Step 5.1: Hoist the regex**

Before (`components/render-message.tsx:239-249`):

```tsx
/** Remove markdown image syntax that references already-rendered generated images */
function stripDuplicateImageMarkdown(
  text: string,
  generatedImageUrls: Set<string>
): string {
  if (generatedImageUrls.size === 0) return text
  return text.replace(
    /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)\n?/g,
    (match, url) => (generatedImageUrls.has(url) ? '' : match)
  )
}
```

After:

```tsx
const MARKDOWN_IMAGE_REGEX = /!\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)\n?/g

/** Remove markdown image syntax that references already-rendered generated images */
function stripDuplicateImageMarkdown(
  text: string,
  generatedImageUrls: Set<string>
): string {
  if (generatedImageUrls.size === 0) return text
  return text.replace(MARKDOWN_IMAGE_REGEX, (match, url) =>
    generatedImageUrls.has(url) ? '' : match
  )
}
```

Place `MARKDOWN_IMAGE_REGEX` immediately above the function. `g`-flag regexes retain `lastIndex` state across `.exec()` calls, but `.replace()` resets it internally, so the module-scoped version is safe.

- [ ] **Step 5.2: Lint + typecheck + test**

Run: `bun lint && bun typecheck && bun run test -- components/render-message.test.tsx`
Expected: all pass (the existing render-message tests should continue to pass — this is a pure hoist).

- [ ] **Step 5.3: Commit**

```bash
git add components/render-message.tsx
git commit -m "perf(render-message): hoist markdown image regex to module scope"
```

---

## Task 6: Consolidate four `message.parts` scans into one memoized pass

**Why:** `components/render-message.tsx:421-430` calls `normalizeRenderableParts`, `getLatestPersistedCanvasArtifactPartIndexes`, `getLatestCanvasArtifactStatuses`, `collectGeneratedImageUrls`, and `collectCompletedDisplayToolResults` — five separate traversals of `message.parts` on every render. During streaming, `RenderMessage` re-runs per token. This combines them into a single `useMemo` keyed on `message.parts`.

**Files:**

- Modify: `components/render-message.tsx`

- [ ] **Step 6.1: Add `useMemo` import**

At `components/render-message.tsx:1`:

Before:

```tsx
import { Fragment, type ReactNode } from 'react'
```

After:

```tsx
import { Fragment, type ReactNode, useMemo } from 'react'
```

- [ ] **Step 6.2: Replace inline scans with a single memoized call**

At `components/render-message.tsx:418-430` (right after the user-message early-return block that ends at line 416), the existing code is:

```tsx
// Pre-scan: identify todoWrite parts for the Research Plan component.
// Single pass collects the first index, latest resolved output, and state flags.
const todoScan = scanTodoWriteParts(message.parts)
const renderParts = normalizeRenderableParts(message.parts)
const latestPersistedCanvasArtifactPartIndexes =
  getLatestPersistedCanvasArtifactPartIndexes(renderParts)
const latestCanvasArtifactStatuses = getLatestCanvasArtifactStatuses(
  message.parts
)
const generatedImageUrls = collectGeneratedImageUrls(message.parts)
const completedDisplayToolResults = collectCompletedDisplayToolResults(
  message.parts
)
```

Replace with a single memoized derivation:

```tsx
const {
  todoScan,
  renderParts,
  latestPersistedCanvasArtifactPartIndexes,
  latestCanvasArtifactStatuses,
  generatedImageUrls,
  completedDisplayToolResults
} = useMemo(() => {
  const todoScan = scanTodoWriteParts(message.parts)
  const renderParts = normalizeRenderableParts(message.parts)
  return {
    todoScan,
    renderParts,
    latestPersistedCanvasArtifactPartIndexes:
      getLatestPersistedCanvasArtifactPartIndexes(renderParts),
    latestCanvasArtifactStatuses: getLatestCanvasArtifactStatuses(
      message.parts
    ),
    generatedImageUrls: collectGeneratedImageUrls(message.parts),
    completedDisplayToolResults: collectCompletedDisplayToolResults(
      message.parts
    )
  }
}, [message.parts])
```

**Rules-of-hooks check:** this `useMemo` sits after the user-message `if (message.role === 'user') return (…)` early return at `components/render-message.tsx:385-416`. Hooks must not be called conditionally. **Move the `useMemo` above the early return** so it runs on every render. Revised structure:

```tsx
export function RenderMessage({ … }: RenderMessageProps) {
  const metadata = message.metadata as UIMessageMetadata | undefined

  const {
    todoScan,
    renderParts,
    latestPersistedCanvasArtifactPartIndexes,
    latestCanvasArtifactStatuses,
    generatedImageUrls,
    completedDisplayToolResults
  } = useMemo(() => {
    // …same body as above…
  }, [message.parts])

  // Use provided citation maps (from all messages)
  if (message.role === 'user') {
    return (
      <>
        {/* unchanged */}
      </>
    )
  }

  // (the old inline `const todoScan = …` block is now gone)
  // …rest of function unchanged…
```

The user-message branch doesn't read these values, so running `useMemo` for user messages is a negligible overhead (one function call that the memoizer will cache after the first render).

- [ ] **Step 6.3: Lint + typecheck + test**

Run: `bun lint && bun typecheck && bun run test -- components/render-message.test.tsx`
Expected: all pass. If any test fails, read the failure — it most likely indicates the hook ordering broke for a test that stubs a user message; in that case verify the `useMemo` sits above the early return and the memo body is unchanged from the previous inline calls.

- [ ] **Step 6.4: Commit**

```bash
git add components/render-message.tsx
git commit -m "perf(render-message): memoize message.parts scans into single pass"
```

---

## Task 7: Memoize `extractToolUIFromText` call sites

**Why:** `extractToolUIFromText` (defined at `components/render-message.tsx:112`) runs `JSON.parse` on every fenced code block on every render. During streaming, each text part rerenders multiple times as tokens accumulate. Memoizing by `(messageId, text)` reuses prior parses when a text hasn't changed.

**Approach:** Because `extractToolUIFromText` is called inside `RenderMessage`'s render loop over `renderParts` (not at the top), the natural memoization strategy is a **per-render map** keyed by text content, computed via `useMemo` alongside the scans added in Task 6. Returned segments are inert (ReactNodes), so caching them across renders is safe.

**Files:**

- Modify: `components/render-message.tsx`

- [ ] **Step 7.1: Grep to locate each `extractToolUIFromText(` invocation**

Run: `rg -n 'extractToolUIFromText\(' components/render-message.tsx`
Expected: at least one match inside the render body. Record the line numbers.

- [ ] **Step 7.2: Inspect each call site and the surrounding `text` binding**

Read: `components/render-message.tsx:<line>` with ~10 lines of context for each match. Each call looks like `extractToolUIFromText(textContent, messageId)` where `textContent` is a string derived from a `part`.

- [ ] **Step 7.3: Extend the Task-6 `useMemo` to precompute text-segment results**

Augment the Task-6 memo body: before returning, iterate `renderParts`, identify every part whose renderer calls `extractToolUIFromText`, and precompute a `Map<string, Segment[]>` keyed by the text value. Then inside the render loop, replace each `extractToolUIFromText(textContent, messageId)` with `toolUISegmentsByText.get(textContent) ?? [{ type: 'text', content: textContent }]`.

Concrete edit — expand the memoized return from Task 6:

```tsx
const {
  todoScan,
  renderParts,
  latestPersistedCanvasArtifactPartIndexes,
  latestCanvasArtifactStatuses,
  generatedImageUrls,
  completedDisplayToolResults,
  toolUISegmentsByText
} = useMemo(() => {
  const todoScan = scanTodoWriteParts(message.parts)
  const renderParts = normalizeRenderableParts(message.parts)

  const toolUISegmentsByText = new Map<string, Segment[]>()
  for (const part of renderParts) {
    if (
      part.type === 'text' &&
      typeof (part as { text?: string }).text === 'string'
    ) {
      const text = (part as { text: string }).text
      if (!toolUISegmentsByText.has(text)) {
        toolUISegmentsByText.set(text, extractToolUIFromText(text, messageId))
      }
    }
  }

  return {
    todoScan,
    renderParts,
    latestPersistedCanvasArtifactPartIndexes:
      getLatestPersistedCanvasArtifactPartIndexes(renderParts),
    latestCanvasArtifactStatuses: getLatestCanvasArtifactStatuses(
      message.parts
    ),
    generatedImageUrls: collectGeneratedImageUrls(message.parts),
    completedDisplayToolResults: collectCompletedDisplayToolResults(
      message.parts
    ),
    toolUISegmentsByText
  }
}, [message.parts, messageId])
```

Then, at each call site inside the render body, replace:

```tsx
const segments = extractToolUIFromText(textContent, messageId)
```

with:

```tsx
const segments = toolUISegmentsByText.get(textContent) ?? [
  { type: 'text', content: textContent }
]
```

**Edge case:** if the code path computes `textContent` via any transform before passing to `extractToolUIFromText` (e.g. applies `stripDuplicateImageMarkdown` first), the memo must do the same transform before storing. Trace the call site carefully — a mismatch between "the text we stored" and "the text we look up" would silently fall back to the `{ type: 'text', content: textContent }` branch and lose tool-UI extraction. If the transform differs per-part, abandon the map-lookup approach and instead just wrap `extractToolUIFromText` in a locally-scoped memo:

```tsx
const extractCache = useRef(new Map<string, Segment[]>())
// Reset cache when message.parts identity changes:
useEffect(() => {
  extractCache.current = new Map()
}, [message.parts])

// At call site:
const cacheKey = textContent
let segments = extractCache.current.get(cacheKey)
if (!segments) {
  segments = extractToolUIFromText(textContent, messageId)
  extractCache.current.set(cacheKey, segments)
}
```

Pick whichever is simpler given the actual call-site transforms found in Step 7.2. **Default to the `useMemo` map approach** (simpler, no stale-cache concerns). Fall back to the ref-cache only if there's a transform that differs from what the memo body can precompute.

- [ ] **Step 7.4: Lint + typecheck + test**

Run: `bun lint && bun typecheck && bun run test -- components/render-message.test.tsx`
Expected: all pass. The tests exercise multiple tool-UI extraction scenarios (see `components/render-message.test.tsx:667+`); these must continue to pass.

- [ ] **Step 7.5: Commit**

```bash
git add components/render-message.tsx
git commit -m "perf(render-message): memoize extractToolUIFromText results by text"
```

---

## Task 8: Parallelize `cookies()` + `getCurrentUserId()` in chat route

**Why:** `app/api/chat/route.ts:100` awaits `getCurrentUserId()`; `app/api/chat/route.ts:130` awaits `cookies()`. The cookie store is not needed until line 135 and doesn't depend on `userId`, so these two async ops can run in parallel. Savings per request ≈ one async round-trip (low tens of ms, but on the chat hot path).

**Important scope note:** Agent 3 originally suggested parallelizing `getCurrentUserId()` with `checkAndEnforceOverallChatLimit(userId)`. That fix is **wrong** — the rate limit reads `userId`, so it must await auth. The correct parallelization is `cookies()` + `getCurrentUserId()`.

**Files:**

- Modify: `app/api/chat/route.ts`

- [ ] **Step 8.1: Read current structure (lines 96-135)**

Confirm the current layout matches:

```ts
const referer = req.headers.get('referer')
const isSharePage = referer?.includes('/share/')

const authStart = performance.now()
const userId = await getCurrentUserId()
perfTime('Auth completed', authStart)

if (isSharePage) {
  /* early return */
}

const guestChatEnabled = process.env.ENABLE_GUEST_CHAT === 'true'
const isGuest = !userId
if (isGuest && !guestChatEnabled) {
  /* early return */
}

if (isGuest) {
  // guest rate limit (depends on isGuest, which depends on userId)
}

const cookieStore = await cookies()

const rawSearchMode = cookieStore.get('searchMode')?.value
// …etc
```

- [ ] **Step 8.2: Parallelize the two awaits**

Replace the sequential awaits with a single `Promise.all`. Move `cookies()` up to run concurrently with `getCurrentUserId()`. The first place the cookie store is read is line 135 (`cookieStore.get('searchMode')?.value`), which is far below the `getCurrentUserId()` call — plenty of room to hoist.

Before:

```ts
const authStart = performance.now()
const userId = await getCurrentUserId()
perfTime('Auth completed', authStart)
// …rest…
const cookieStore = await cookies()
```

After:

```ts
const authStart = performance.now()
const [userId, cookieStore] = await Promise.all([getCurrentUserId(), cookies()])
perfTime('Auth completed', authStart)
// …rest…
// (delete the later `const cookieStore = await cookies()` line at its original position)
```

- [ ] **Step 8.3: Verify no references to `cookieStore` precede the new definition**

Run: `rg -n 'cookieStore' app/api/chat/route.ts`
Expected: every hit is after the new `Promise.all` line. If any hit precedes it, the refactor was positioned incorrectly — move the `Promise.all` higher.

- [ ] **Step 8.4: Lint + typecheck + test**

Run: `bun lint && bun typecheck && bun run test`
Expected: all pass. Run the full suite because the chat route has integration tests in other files that may indirectly exercise this.

- [ ] **Step 8.5: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "perf(chat-route): parallelize auth and cookie store loads"
```

---

## Final verification

- [ ] **Step 9.1: Run the full quality gate**

Run: `bun lint && bun typecheck && bun run test`
Expected: all pass with zero new warnings or errors.

- [ ] **Step 9.2: Confirm all duplicates are gone**

Run:

```bash
rg -n 'error instanceof Error \? error\.message : String\(error\)' --glob '!node_modules' --glob '!docs' --glob '!**/*.md'
rg -n '\(error as any\)\?\.status' lib/tools/search/providers
```

Expected: the first produces zero matches; the second produces zero matches.

- [ ] **Step 9.3: Confirm commits are clean**

Run: `git log --oneline -n 8`
Expected: eight (or fewer, if some steps collapsed) conventional-commit lines, each scoped to one file or one coherent migration.

- [ ] **Step 9.4: Open a PR**

Use `gh pr create` with a body summarizing Tier A changes. Reference the project-simplify audit session and list the six fixes applied. Explicitly note the Tier B/C findings that were _not_ addressed and why (scope / separate discussion).

---

## What this plan does NOT do

For reviewer transparency, these items were identified by the audit but deliberately scoped out of this plan:

- **API-route auth/rate-limit wrapper** (Tier B): needs a design choice (HOF vs. middleware). Deserves its own brainstorming session.
- **`createResearcher` options-object refactor** (Tier B): touches many call sites and test mocks; not surgical.
- **Citation-cache eviction policy** (Tier B): only meaningful for 500+ message chats, and the behavior is currently keyed by `chatId` so it resets on chat switch. Not urgent.
- **Retry-logic consolidation** (Tier B): `lib/utils/retry.ts` and `lib/tools/fetch-with-retry.ts` have different semantics; merging them requires verifying every caller's expectations.
- **All `$type<any>()` DB columns → Zod-validated types** (Tier C): multi-day refactor; no evidence of active bugs from the current untyped state.
- **`console.log` → structured logger** (Tier C): cross-cutting; Phoenix tracing already handles observability for instrumented paths.
- **Delete `researcher` legacy export** (Tier C): **verified to still be imported** by three streaming files. Not dead.

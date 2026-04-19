# Suggestions Refresh RLS Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix PR 147's P1 by moving `/api/suggestions/refresh` writes off the restricted app-runtime DB client and onto a narrow privileged server-only writer, without reintroducing any table write policy.

**Architecture:** Keep the read path exactly as-is: `GET /api/suggestions` continues reading `trending_suggestions_cache` through the shared restricted `db` client under RLS. Introduce one new server-only DB helper that always connects with owner credentials (`DATABASE_URL` or `POSTGRES_URL`) and use it only from the cron refresh route. Route tests must fail if the shared `db` insert path is used, so the regression is caught in unit coverage rather than masked by mocks.

**Tech Stack:** Next.js 16 App Router route handlers, TypeScript (strict), Drizzle ORM, postgres-js, Vitest, Bun.

**Scope guard:** This plan fixes only the blocked writer. It does **not** add a new RLS write policy, change the cache freshness cutoff, redesign cron scheduling, or broaden env validation in the same patch.

---

## File Structure

**New files:**

- `lib/db/admin.ts` — server-only privileged Drizzle client for trusted maintenance/admin writes that must bypass `DATABASE_RESTRICTED_URL`.

**Modified files:**

- `app/api/suggestions/refresh/route.ts` — swap the cache upsert from the shared `db` client to the privileged helper.
- `app/api/suggestions/refresh/__tests__/route.test.ts` — stop mocking the happy path through `@/lib/db`; instead assert the route acquires and uses the privileged helper and never touches the shared client.

**Intentionally unchanged:**

- `lib/db/index.ts` — remains the normal restricted app-runtime client.
- `lib/db/schema.ts` — keeps the current read-only policy shape for `trending_suggestions_cache`.
- `drizzle/0017_add_trending_suggestions_cache.sql` and `drizzle/0018_drop_trending_suggestions_public_write_policy.sql` — no migration or policy changes in this fix.
- `app/api/suggestions/route.ts` — read path stays on the shared client.

---

## Task 1: Make the regression visible in the refresh route test

**Why this task:** The current route test fully mocks `@/lib/db`, so it cannot distinguish “uses the restricted shared client” from “uses a dedicated privileged writer.” This task turns the P1 into a failing unit test before any production code changes.

**Files:**

- Modify: `app/api/suggestions/refresh/__tests__/route.test.ts`
- Test: `app/api/suggestions/refresh/__tests__/route.test.ts`

### Steps

- [ ] **Step 1: Replace the shared-db mock with separate shared and privileged mocks**

Update the top of `app/api/suggestions/refresh/__tests__/route.test.ts` so the shared DB path fails loudly and the privileged path is the only successful writer:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGenerateTrendingSuggestions = vi.fn()
const mockSharedInsert = vi.fn(() => {
  throw new Error('shared db must not be used for suggestions refresh')
})
const mockPrivilegedOnConflictDoUpdate = vi.fn()
const mockGetPrivilegedDb = vi.fn(() => ({
  insert: () => ({
    values: () => ({
      onConflictDoUpdate: (...args: unknown[]) =>
        mockPrivilegedOnConflictDoUpdate(...args)
    })
  })
}))

vi.mock('@/lib/agents/generate-trending-suggestions', () => ({
  generateTrendingSuggestions: (...args: unknown[]) =>
    mockGenerateTrendingSuggestions(...args)
}))

vi.mock('@/lib/db', () => ({
  db: {
    insert: (...args: unknown[]) => mockSharedInsert(...args)
  }
}))

vi.mock('@/lib/db/admin', () => ({
  getPrivilegedDb: () => mockGetPrivilegedDb()
}))

vi.mock('@/lib/utils/telemetry', () => ({
  flushTraces: vi.fn()
}))
```

- [ ] **Step 2: Tighten the success-path assertion so it proves the privileged helper is used**

Replace the existing `"upserts suggestions on success"` expectations with:

```ts
it('upserts suggestions through the privileged DB helper on success', async () => {
  mockGenerateTrendingSuggestions.mockResolvedValue({
    suggestions: SAMPLE_SUGGESTIONS
  })
  mockPrivilegedOnConflictDoUpdate.mockResolvedValue({ rowCount: 1 })

  const response = await GET(makeRequest('Bearer test-secret'))
  const json = await response.json()

  expect(response.status).toBe(200)
  expect(json.ok).toBe(true)
  expect(mockGenerateTrendingSuggestions).toHaveBeenCalledTimes(1)
  expect(mockGetPrivilegedDb).toHaveBeenCalledTimes(1)
  expect(mockPrivilegedOnConflictDoUpdate).toHaveBeenCalledTimes(1)
  expect(mockSharedInsert).not.toHaveBeenCalled()
})
```

- [ ] **Step 3: Keep the write-failure coverage, but make it fail through the privileged path**

Replace the existing DB failure test with:

```ts
it('returns 500 if the privileged DB upsert fails', async () => {
  mockGenerateTrendingSuggestions.mockResolvedValue({
    suggestions: SAMPLE_SUGGESTIONS
  })
  mockPrivilegedOnConflictDoUpdate.mockRejectedValueOnce(
    new Error('privileged pg dead')
  )

  const response = await GET(makeRequest('Bearer test-secret'))
  const json = await response.json()

  expect(response.status).toBe(500)
  expect(json.ok).toBe(false)
  expect(json.error).toContain('privileged pg dead')
  expect(mockSharedInsert).not.toHaveBeenCalled()
})
```

- [ ] **Step 4: Run the targeted route test and confirm it fails before implementation**

Run:

```bash
bun run test -- app/api/suggestions/refresh/__tests__/route.test.ts
```

Expected: FAIL. The route still imports `@/lib/db`, so either the test will fail because `mockGetPrivilegedDb` was never called or because the shared DB mock throws `shared db must not be used for suggestions refresh`.

- [ ] **Step 5: Commit the failing test change**

```bash
git add app/api/suggestions/refresh/__tests__/route.test.ts
git commit -m "test(suggestions): expose restricted-db refresh regression"
```

---

## Task 2: Add the privileged DB helper and swap the refresh route to it

**Why this task:** The runtime fix is to separate trusted maintenance writes from the shared restricted app client. The cron route is server-authenticated already via `CRON_SECRET`; it should use a server-only owner-credential connection for the singleton cache upsert.

**Files:**

- Create: `lib/db/admin.ts`
- Modify: `app/api/suggestions/refresh/route.ts`
- Test: `app/api/suggestions/refresh/__tests__/route.test.ts`

### Steps

- [ ] **Step 1: Create `lib/db/admin.ts`**

Create `lib/db/admin.ts` with this exact implementation:

```ts
import 'server-only'

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as relations from './relations'
import * as schema from './schema'

const sslConfig =
  process.env.DATABASE_SSL_DISABLED === 'true'
    ? false
    : { rejectUnauthorized: false }

let _privilegedDb: ReturnType<typeof drizzle> | null = null

export function getPrivilegedDb() {
  if (_privilegedDb) {
    return _privilegedDb
  }

  const connectionString =
    process.env.DATABASE_URL ??
    process.env.POSTGRES_URL ??
    'postgres://placeholder:placeholder@localhost:5432/placeholder'

  if (
    !process.env.DATABASE_URL &&
    !process.env.POSTGRES_URL &&
    process.env.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'DATABASE_URL or POSTGRES_URL is required for privileged database writes'
    )
  }

  const client = postgres(connectionString, {
    ssl: sslConfig,
    prepare: false,
    max: 5
  })

  _privilegedDb = drizzle(client, {
    schema: { ...schema, ...relations }
  })

  return _privilegedDb
}
```

This helper must not read `DATABASE_RESTRICTED_URL`. Its entire purpose is to bypass the restricted runtime connection for trusted server-side maintenance writes.

- [ ] **Step 2: Swap the refresh route to the privileged helper**

Update `app/api/suggestions/refresh/route.ts` to import and use `getPrivilegedDb()`:

```ts
import { NextResponse } from 'next/server'

import { generateTrendingSuggestions } from '@/lib/agents/generate-trending-suggestions'
import { getPrivilegedDb } from '@/lib/db/admin'
import { trendingSuggestionsCache } from '@/lib/db/schema'
import { flushTraces } from '@/lib/utils/telemetry'

export const maxDuration = 60

export async function GET(request: Request) {
  const expected = process.env.CRON_SECRET
  if (!expected) {
    console.error('[Suggestions refresh] CRON_SECRET is not configured')
    return NextResponse.json(
      { ok: false, error: 'not-configured' },
      { status: 500 }
    )
  }

  const auth = request.headers.get('authorization')
  if (auth !== `Bearer ${expected}`) {
    return NextResponse.json(
      { ok: false, error: 'unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { suggestions } = await generateTrendingSuggestions()
    const privilegedDb = getPrivilegedDb()

    await privilegedDb
      .insert(trendingSuggestionsCache)
      .values({ id: 1, suggestions, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: trendingSuggestionsCache.id,
        set: { suggestions, updatedAt: new Date() }
      })

    return NextResponse.json({
      ok: true,
      categories: Object.keys(suggestions)
    })
  } catch (error) {
    console.error('[Suggestions refresh] Failed:', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'unknown'
      },
      { status: 500 }
    )
  } finally {
    await flushTraces()
  }
}
```

- [ ] **Step 3: Re-run the targeted route test and confirm it passes**

Run:

```bash
bun run test -- app/api/suggestions/refresh/__tests__/route.test.ts
```

Expected: PASS. The success test proves `getPrivilegedDb()` is called once, the privileged writer receives the upsert, and the shared `db.insert` path is never touched.

- [ ] **Step 4: Typecheck the new helper and route**

Run:

```bash
bun run typecheck
```

Expected: PASS with zero TypeScript errors.

- [ ] **Step 5: Lint the touched files**

Run:

```bash
bun run lint -- lib/db/admin.ts app/api/suggestions/refresh/route.ts app/api/suggestions/refresh/__tests__/route.test.ts
```

Expected: PASS with no new lint violations.

- [ ] **Step 6: Commit the production fix**

```bash
git add lib/db/admin.ts app/api/suggestions/refresh/route.ts app/api/suggestions/refresh/__tests__/route.test.ts
git commit -m "fix(suggestions): use privileged db for refresh cron"
```

---

## Task 3: Run the full verification slice for PR 147's suggestions cache

**Why this task:** The narrow fix should prove three things: the refresh route still works, the read path still works, and the “no public write policy” guard remains intact.

**Files:**

- Test: `app/api/suggestions/refresh/__tests__/route.test.ts`
- Test: `app/api/suggestions/__tests__/route.test.ts`
- Test: `lib/db/__tests__/trending-suggestions-cache-policy.test.ts`

### Steps

- [ ] **Step 1: Run the targeted suite for the refresh route, read route, and policy guard**

Run:

```bash
bun run test -- app/api/suggestions/refresh/__tests__/route.test.ts app/api/suggestions/__tests__/route.test.ts lib/db/__tests__/trending-suggestions-cache-policy.test.ts
```

Expected: PASS. This confirms:

- the refresh route now uses the privileged writer,
- the read route still serves the dynamic/static fallback behavior,
- the schema/migration guard still enforces “no public write policy.”

- [ ] **Step 2: If local secrets are present, manually exercise the route handler**

Run the dev server in one terminal:

```bash
bun run dev
```

Then, in a second terminal, invoke the protected refresh route:

```bash
curl -i -H "Authorization: Bearer $CRON_SECRET" http://localhost:43100/api/suggestions/refresh
```

Expected: `HTTP/1.1 200 OK` and a JSON body shaped like:

```json
{
  "ok": true,
  "categories": ["research", "compare", "latest", "summarize", "explain"]
}
```

If local search/provider secrets are intentionally absent, skip this step locally and perform it in the preview environment after deploy.

- [ ] **Step 3: Verify the read route still reports dynamic data after a successful refresh**

Run:

```bash
curl -i http://localhost:43100/api/suggestions
```

Expected: response header `x-suggestions-source: dynamic-blend` after a successful refresh, or `static-rotation` if Step 2 was intentionally skipped because local provider secrets are absent.

- [ ] **Step 4: Commit the verification checkpoint**

```bash
git add -A
git commit -m "test(suggestions): verify refresh writer and read path"
```

---

## Notes For Review

- The fix is intentionally code-only. Do not edit `lib/db/schema.ts` or add a new migration.
- Do not route this write through `withOptionalRLS(null)`. That helper still uses the shared `db` client and does not create a privileged context.
- Do not change `lib/db/index.ts` connection precedence. The whole point is to keep the normal app runtime restricted and carve out one explicit privileged path for trusted server writes.

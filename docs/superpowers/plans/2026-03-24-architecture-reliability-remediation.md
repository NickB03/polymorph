# Architecture Reliability Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate the current top architecture failure modes in chat and canvas flows by reducing synchronous dependency risk, making persistence durable, removing stale-read paths, serializing canvas mutations, and hardening guest access plus rate limiting.

**Architecture:** Keep the existing Next.js request model, but move the system from best-effort inline durability to explicit reliability boundaries. The core changes are: standardize and extend existing request-time budgets for external calls, reserve assistant message state before stream completion, use direct DB reads for hot mutable chat state, serialize canvas mutations with a gated async compile design, and consolidate guest canvas authorization/rate limiting across both routes and guest streaming.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript, Bun, Vercel AI SDK, Drizzle ORM, Supabase/PostgreSQL, Upstash Redis

---

## File Map

- `app/api/chat/route.ts`
  Main synchronous chat request entrypoint. Keep auth and request validation here.
- `lib/streaming/create-chat-stream-response.ts`
  Authenticated SSE orchestration. Will become the source of truth for durable assistant message lifecycle.
- `lib/streaming/create-ephemeral-chat-stream-response.ts`
  Guest SSE orchestration. Needs the same request-budget and degraded-mode handling as the authenticated path and must share guest canvas authorization rules with the route layer.
- `lib/streaming/helpers/persist-stream-results.ts`
  Finalization path for assistant persistence. Will change from “best effort insert after stream” to “finalize already-reserved assistant state.”
- `lib/streaming/helpers/prepare-messages.ts`
  Live chat submit/regenerate path. Must stop depending on cached reads for mutable correctness.
- `lib/streaming/helpers/prepare-tool-result-messages.ts`
  Tool-result continuation path. Already contains direct-read mitigations; this plan will make that the default correctness path instead of a special-case workaround.
- `lib/streaming/helpers/stream-related-questions.ts`
  Non-critical post-answer generation path. Include it in the request-budget/degraded-mode scope.
- `lib/actions/chat.ts`
  Current cached chat loader. Will be split into cached read paths and direct mutable-path reads.
- `lib/db/actions.ts`
  Core chat, message, canvas, and artifact persistence. Will add direct uncached active-chat helpers, message finalization helpers, queue/job persistence, and shared rate-limit persistence.
- `lib/tools/search.ts`
  Search provider fan-out. Add request budgets, structured timeout handling, and degraded results.
- `lib/tools/fetch.ts`
  Remote fetch/extraction fan-out. Add request budgets and consistent failure classification.
- `lib/agents/title-generator.ts`
  Non-critical model call. Move under strict timeout and explicit “optional” behavior.
- `lib/canvas/service.ts`
  Current canvas mutation orchestration. Will gain serialized execution and async compile enqueue/finalize behavior.
- `app/api/canvas-artifacts/[artifactId]/*.ts`
  Canvas guest/auth/mutation routes. Consolidate auth and rate-limit logic here behind shared helpers.
- `components/canvas/canvas-context.tsx`
  Client canvas state manager. If compile becomes async, this layer must tolerate `compiling` responses, stale previews, and explicit reload/poll behavior.
- `lib/canvas/guest-token.ts`
  Signed token verification. Keep the cryptography, but remove route-by-route auth duplication around it.
- `lib/rate-limit/*.ts`
  Current Redis-first + memory fallback limiters. Replace cloud in-memory fallback with durable shared fallback.
- `lib/db/schema.ts`
  Add any schema required for assistant pending-state finalization, canvas compile jobs, and DB-backed rate limiting.
- `drizzle/*.sql`
  Append-only migrations for new tables/indexes/enum values. Do not edit previously applied migration files.
- `docs/getting-started/ENVIRONMENT.md`
  Update required runtime env for worker/queue behavior and any new fallback semantics.
- `docs/operations/DEPLOYMENT.md`
  Document where any compile worker runs in production and how it is supervised.
- `package.json`
  Add worker script entrypoints only after the production runtime model is decided.

## Scope Notes

- This plan intentionally treats the five identified failure modes as one remediation program because they touch the same request path and persistence model.
- Tasks 1, 2, and 3 are executable immediately.
- Task 5 is only partially executable until guest-canvas authorization is defined across both route handlers and the guest streaming path.
- Task 4 is gated on deployment and privilege decisions. If queue infrastructure is politically or operationally blocked, complete Tasks 1, 2, 3, and the non-worker portion of Task 5 first. Task 4 can then fall back to DB advisory locking plus inline compile as an interim step, but the preferred end state is async compile.

## Required Decisions Before Task 4

- **Worker runtime:** decide where the compile worker runs in production. This repository currently documents a Next.js app deployment, not a long-lived queue consumer.
- **DB privilege model:** decide whether compile workers and DB-backed fallback limiters run with service-role access, a separate queue policy, or another explicit RLS bypass contract.
- **Client contract:** decide how the canvas client handles `compiling` states, stale previews, retries, and reload/poll behavior before changing draft/restore semantics from synchronous compile to async queue.
- **Rate-limit storage:** decide table shape, retention, cleanup, and whether Postgres fallback is only for Redis outage scenarios or participates on every cloud request.
- **Migration policy:** use append-only Drizzle migrations after the latest migration. Do not modify historical migration files such as `0013_canvas_artifacts.sql`.

### Task 1: Bound External Dependencies and Add Degraded Mode

**Files:**

- Create: `lib/utils/request-budget.ts`
- Modify: `lib/tools/search.ts`
- Modify: `lib/tools/fetch.ts`
- Modify: `lib/agents/title-generator.ts`
- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Modify: `lib/streaming/helpers/stream-related-questions.ts`
- Test: `lib/tools/__tests__/fetch.test.ts`
- Test: `lib/tools/__tests__/search-provider-routing.test.ts`
- Create or modify: `lib/streaming/__tests__/create-chat-stream-response.test.ts`
- Modify: `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

- [ ] **Step 1: Write failing tests for timeout and degraded-mode behavior**

Add tests that prove:

```ts
expect(result.state).toBe('complete')
expect(result.results).toEqual([])
expect(result.error).toContain('timeout')
expect(result.degraded).toBe(true)
```

and:

```ts
expect(title).toBe('fallback title')
```

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `bun run test -- lib/tools/__tests__/fetch.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

Expected: at least one failure because the current implementation does not classify all non-critical dependency failures into consistent degraded results and does not budget related-question generation uniformly across auth and guest paths.

- [ ] **Step 3: Implement request-budget helper**

Add a helper with a shape like:

```ts
export async function withRequestBudget<T>(
  label: string,
  timeoutMs: number,
  fn: (signal: AbortSignal) => Promise<T>
): Promise<T>
```

It should:

- merge abort signals
- enforce timeout
- classify timeout vs upstream failure
- emit consistent logs/metadata

- [ ] **Step 4: Apply budgets to every non-critical dependency**

Apply strict budgets to:

- search provider attempts
- fetch/extraction providers
- title generation
- related-questions generation

Non-critical work must fail open with explicit degraded metadata. Critical work must fail fast and surface a classified error instead of waiting for the outer 300s function timeout. Keep existing good behavior where it already exists, such as fetch timeouts and title fallback, but standardize the helper, logging, and metadata format.

- [ ] **Step 5: Add request metadata for observability**

Ensure the stream metadata and logs can answer:

- which provider timed out
- which fallback provider ran
- whether the response was degraded
- total dependency time spent before first token

- [ ] **Step 6: Re-run targeted tests**

Run: `bun run test -- lib/tools/__tests__/fetch.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/utils/request-budget.ts lib/tools/search.ts lib/tools/fetch.ts lib/agents/title-generator.ts lib/streaming/create-chat-stream-response.ts lib/streaming/create-ephemeral-chat-stream-response.ts lib/streaming/helpers/stream-related-questions.ts lib/tools/__tests__/fetch.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts
git commit -m "fix: bound external dependency latency"
```

### Task 2: Make Assistant Persistence Durable Before Stream Completion

**Files:**

- Create: `lib/streaming/helpers/ensure-pending-assistant-message.ts`
- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/helpers/persist-stream-results.ts`
- Modify: `lib/actions/chat.ts`
- Modify: `lib/db/actions.ts`
- Test: `lib/actions/__tests__/chat.test.ts`
- Test: `lib/streaming/__tests__/create-chat-stream-response.test.ts`
- Modify: `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`
- Modify: `lib/streaming/helpers/__tests__/prepare-messages.test.ts`

- [ ] **Step 1: Write failing durability tests**

Add tests that prove:

```ts
expect(savedAssistantMessage.metadata?.status).toBe('pending')
```

before model completion, and:

```ts
expect(finalizedAssistantMessage.parts).toEqual(response.parts)
expect(finalizedAssistantMessage.metadata?.status).toBe('completed')
```

after completion.

Also add one test where `onFinish` throws and verify the reserved assistant row still exists for reconciliation instead of losing the turn entirely.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `bun run test -- lib/actions/__tests__/chat.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts`

Expected: FAIL because assistant persistence currently happens after streaming in `onFinish`.

- [ ] **Step 3: Reserve assistant message state before streaming**

Implement a helper that:

- creates or upserts an assistant message row with the final message id
- stores `metadata.status = 'pending'`
- leaves parts empty until completion

Use the reserved message id as the stream message id so UI and DB stay aligned.

- [ ] **Step 4: Finalize instead of insert-after-the-fact**

Change `persistStreamResults` so it updates the reserved assistant message and its parts instead of treating completion as a brand-new write.

Keep retry logic, but make retries idempotent against the same reserved message id.

- [ ] **Step 5: Add an explicit recovery path**

If finalization fails after retries:

- keep the pending message row
- store failure metadata
- make continuations and reloads capable of recognizing “pending-finalization” assistant rows

- [ ] **Step 6: Re-run targeted tests**

Run: `bun run test -- lib/actions/__tests__/chat.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/streaming/helpers/ensure-pending-assistant-message.ts lib/streaming/create-chat-stream-response.ts lib/streaming/helpers/persist-stream-results.ts lib/actions/chat.ts lib/db/actions.ts lib/actions/__tests__/chat.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts
git commit -m "fix: make streamed assistant persistence durable"
```

### Task 3: Remove Stale Cached Reads From Mutable Chat Paths

**Files:**

- Modify: `lib/actions/chat.ts`
- Modify: `lib/db/actions.ts`
- Modify: `lib/streaming/helpers/prepare-messages.ts`
- Modify: `lib/streaming/helpers/prepare-tool-result-messages.ts`
- Test: `lib/actions/__tests__/chat.test.ts`
- Test: `lib/actions/__tests__/canvas-chat-ownership-race.test.ts`
- Test: `lib/streaming/helpers/__tests__/prepare-messages.test.ts`
- Test: `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`

- [ ] **Step 1: Write failing consistency tests**

Cover two cases:

```ts
expect(await loadActiveChat(chatId, userId)).toMatchObject(latestDbState)
```

and:

```ts
expect(await prepareToolResultMessages(...)).not.toDuplicateAssistantMessage()
```

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test -- lib/actions/__tests__/chat.test.ts lib/actions/__tests__/canvas-chat-ownership-race.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`

Expected: at least one failure or a test that demonstrates the current cache-bypass special case is still required.

- [ ] **Step 3: Split cached and direct loaders**

Refactor `lib/actions/chat.ts` into:

- cached read for sidebar/history use
- direct DB read for active chat mutation/continuation paths

Document that the tool-result path already contains a direct-read workaround today and replace that special case with a first-class `loadActiveChat` or equivalent direct loader.

Do not use `unstable_cache` for:

- active chat loads during submit
- tool-result continuations
- any path that immediately follows a write

- [ ] **Step 4: Update continuation and message-preparation code**

`prepareMessages` and `prepareToolResultMessages` must use the direct loader, not the cached loader.

Keep revalidation only for UI list/history refresh, not as correctness machinery for the live conversation path.

- [ ] **Step 5: Re-run targeted tests**

Run: `bun run test -- lib/actions/__tests__/chat.test.ts lib/actions/__tests__/canvas-chat-ownership-race.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`

Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add lib/actions/chat.ts lib/db/actions.ts lib/streaming/helpers/prepare-messages.ts lib/streaming/helpers/prepare-tool-result-messages.ts lib/actions/__tests__/chat.test.ts lib/actions/__tests__/canvas-chat-ownership-race.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts
git commit -m "fix: remove stale cache from mutable chat paths"
```

### Task 4: Serialize Canvas Mutations and Move Compile Off the Request Path

**Files:**

- Create: `lib/canvas/compile-queue.ts`
- Create: `lib/canvas/compile-worker.ts`
- Create: `scripts/run-canvas-compile-worker.ts`
- Create: `lib/canvas/compile-queue.test.ts`
- Create: `lib/canvas/compile-worker.test.ts`
- Modify: `lib/db/schema.ts`
- Modify: add a new Drizzle migration after the latest migration
- Modify: `lib/db/actions.ts`
- Modify: `lib/canvas/service.ts`
- Modify: `components/canvas/canvas-context.tsx`
- Modify: `components/canvas/canvas-context.test.tsx`
- Modify: `package.json`
- Modify: `docs/operations/DEPLOYMENT.md`
- Modify: `app/api/canvas-artifacts/[artifactId]/draft/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/restore/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/versions/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts`
- Test: `lib/canvas/service.test.ts`
- Test: `lib/canvas/service.integration.test.ts`
- Test: `app/api/canvas-artifacts/[artifactId]/draft/route.test.ts`
- Test: `app/api/canvas-artifacts/[artifactId]/restore/route.test.ts`

- [ ] **Gate: confirm worker runtime, privilege model, and client contract**

Do not begin Task 4 implementation until all three are written down in the plan or a linked decision doc:

- where the worker runs in production
- how it accesses user-owned rows safely
- how the client behaves while artifact status is `compiling`

- [ ] **Step 1: Write failing concurrency tests**

Add tests that prove:

```ts
expect(result.errorCode).toBe('mutation-in-progress')
```

for overlapping writes, and:

```ts
expect(artifact.status).toBe('compiling')
expect(job.status).toBe('queued')
```

immediately after a draft update, plus worker tests that prove a claimed job is idempotent on retry/restart and client tests that prove `compiling` state is surfaced without assuming compiled HTML already exists.

- [ ] **Step 2: Run tests to verify failure**

Run: `bun run test -- lib/canvas/service.test.ts lib/canvas/service.integration.test.ts lib/canvas/compile-queue.test.ts lib/canvas/compile-worker.test.ts components/canvas/canvas-context.test.tsx 'app/api/canvas-artifacts/[artifactId]/draft/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/restore/route.test.ts'`

Expected: FAIL because compilation is currently inline and concurrent mutations rely on optimistic revision checks alone.

- [ ] **Step 3: Add durable compile job persistence**

Introduce a new DB-backed queue table for canvas compile jobs with:

- `artifactId`
- `draftRevision`
- `status`
- `attemptCount`
- `availableAt`
- `lastError`

Add indexes for `(status, availableAt)` and `(artifactId, draftRevision)`.

- [ ] **Step 4: Serialize per-artifact mutation entry**

Before enqueueing compile work, acquire a DB-level single-flight guard per artifact. Preferred implementation:

```ts
await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${artifactId}))`)
```

Use a shared mutation guard for create, draft, restore, and version writes. Keep runtime-diagnostics as a distinct non-revision-bumping path, but ensure it coexists correctly with queued compile state and does not reintroduce stale writes.

- [ ] **Step 5: Change draft updates to enqueue compile**

Draft/restore operations should:

- validate source
- update draft source and revision
- set status to `compiling`
- enqueue a compile job
- return immediately

The worker should:

- claim queued job
- run `compileCanvasArtifact`
- persist compiled HTML and diagnostics
- finalize artifact status to `ready` or `compile_failed`

- [ ] **Step 6: Add worker execution path**

Implement a Bun worker entrypoint and document how it runs locally and in production. The worker must be idempotent and safe to restart.

- [ ] **Step 7: Re-run targeted tests**

Run: `bun run test -- lib/canvas/service.test.ts lib/canvas/service.integration.test.ts lib/canvas/compile-queue.test.ts lib/canvas/compile-worker.test.ts components/canvas/canvas-context.test.tsx 'app/api/canvas-artifacts/[artifactId]/draft/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/restore/route.test.ts'`

Expected: PASS

- [ ] **Step 8: Commit**

```bash
git add lib/canvas/compile-queue.ts lib/canvas/compile-worker.ts scripts/run-canvas-compile-worker.ts lib/canvas/compile-queue.test.ts lib/canvas/compile-worker.test.ts lib/db/schema.ts drizzle lib/db/actions.ts lib/canvas/service.ts components/canvas/canvas-context.tsx components/canvas/canvas-context.test.tsx package.json docs/operations/DEPLOYMENT.md app/api/canvas-artifacts/[artifactId]/draft/route.ts app/api/canvas-artifacts/[artifactId]/restore/route.ts app/api/canvas-artifacts/[artifactId]/versions/route.ts app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts lib/canvas/service.test.ts lib/canvas/service.integration.test.ts app/api/canvas-artifacts/[artifactId]/draft/route.test.ts app/api/canvas-artifacts/[artifactId]/restore/route.test.ts
git commit -m "fix: serialize canvas mutations and async compile drafts"
```

### Task 5: Centralize Guest Authorization and Replace In-Memory Cloud Fallback Rate Limiting

**Files:**

- Create: `lib/canvas/authorize-canvas-request.ts`
- Create: `lib/rate-limit/shared-rate-limit.ts`
- Create: `lib/canvas/authorize-canvas-request.test.ts`
- Create: `lib/rate-limit/shared-rate-limit.test.ts`
- Modify: `lib/rate-limit/guest-limit.ts`
- Modify: `lib/rate-limit/chat-limits.ts`
- Modify: `lib/rate-limit/canvas-limits.ts`
- Modify: `lib/rate-limit/redis.ts`
- Modify: `lib/db/schema.ts`
- Modify: add a new Drizzle migration after the latest migration
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/draft/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/versions/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/restore/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/export/route.ts`
- Modify: `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts`
- Test: `lib/rate-limit/__tests__/guest-limit.test.ts`
- Test: `lib/rate-limit/__tests__/canvas-limits.test.ts`
- Test: `lib/rate-limit/__tests__/rate-limit-fallback.test.ts`
- Test: `app/api/canvas-artifacts/[artifactId]/route.test.ts`
- Test: `app/api/canvas-artifacts/[artifactId]/draft/route.test.ts`
- Modify: `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

- [ ] **Step 1: Write failing auth and limiter tests**

Add tests that prove:

```ts
expect(auth.userId).toBeNull()
expect(auth.guest.artifactId).toBe(artifactId)
```

from one shared helper, and:

```ts
expect(response.status).toBe(503)
```

or a DB-backed allowed/denied result when Redis is unavailable in cloud mode. The system must not silently switch to per-instance in-memory enforcement in production.

- [ ] **Step 2: Run targeted tests to verify failure**

Run: `bun run test -- lib/canvas/authorize-canvas-request.test.ts lib/rate-limit/shared-rate-limit.test.ts lib/rate-limit/__tests__/guest-limit.test.ts lib/rate-limit/__tests__/canvas-limits.test.ts lib/rate-limit/__tests__/rate-limit-fallback.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts 'app/api/canvas-artifacts/[artifactId]/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/draft/route.test.ts'`

Expected: FAIL because auth is duplicated per route and cloud fallback currently uses memory.

- [ ] **Step 3: Implement one shared canvas authorization helper**

Create a helper that:

- loads the current user
- verifies guest token when needed
- checks artifactId/chatId match
- returns one typed result used by every canvas route and the guest streaming path

No route or guest stream should call `verifyGuestCanvasToken` directly after this refactor.

- [ ] **Step 4: Add durable shared fallback rate limiting**

Preferred implementation:

- Redis remains primary
- Postgres-backed counters become fallback in cloud mode
- instance-local memory fallback remains local-dev only

The fallback must preserve shared enforcement across instances. Define bucket shape, expiration, cleanup, and whether fallback activates only on Redis outage or on any missing/failed Redis path in cloud mode.

- [ ] **Step 5: Refactor all rate limiters onto the shared helper**

Move guest chat, authenticated chat, and canvas route limits onto one helper that accepts:

```ts
{
  ;(key, windowMs, limit, allowDevMemoryFallback)
}
```

- [ ] **Step 6: Re-run targeted tests**

Run: `bun run test -- lib/canvas/authorize-canvas-request.test.ts lib/rate-limit/shared-rate-limit.test.ts lib/rate-limit/__tests__/guest-limit.test.ts lib/rate-limit/__tests__/canvas-limits.test.ts lib/rate-limit/__tests__/rate-limit-fallback.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts 'app/api/canvas-artifacts/[artifactId]/route.test.ts' 'app/api/canvas-artifacts/[artifactId]/draft/route.test.ts'`

Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add lib/canvas/authorize-canvas-request.ts lib/canvas/authorize-canvas-request.test.ts lib/rate-limit/shared-rate-limit.ts lib/rate-limit/shared-rate-limit.test.ts lib/rate-limit/guest-limit.ts lib/rate-limit/chat-limits.ts lib/rate-limit/canvas-limits.ts lib/rate-limit/redis.ts lib/db/schema.ts drizzle lib/streaming/create-ephemeral-chat-stream-response.ts app/api/canvas-artifacts/[artifactId]/route.ts app/api/canvas-artifacts/[artifactId]/draft/route.ts app/api/canvas-artifacts/[artifactId]/versions/route.ts app/api/canvas-artifacts/[artifactId]/restore/route.ts app/api/canvas-artifacts/[artifactId]/export/route.ts app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts lib/rate-limit/__tests__/guest-limit.test.ts lib/rate-limit/__tests__/canvas-limits.test.ts lib/rate-limit/__tests__/rate-limit-fallback.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts app/api/canvas-artifacts/[artifactId]/route.test.ts app/api/canvas-artifacts/[artifactId]/draft/route.test.ts
git commit -m "fix: centralize guest auth and durable rate limiting"
```

### Task 6: Update Architecture Docs and Run Full Verification

**Files:**

- Create: `docs/architecture/chat-canvas-reliability.md`
- Modify: `docs/getting-started/ENVIRONMENT.md`
- Modify: `AGENTS.md`

- [ ] **Step 1: Document the confirmed architecture**

Write down:

- current synchronous chat path
- assistant pending/finalized lifecycle
- direct-vs-cached chat read rules
- canvas compile queue and worker
- guest auth contract
- rate-limit fallback order

- [ ] **Step 2: Remove stale architectural claims**

Update AGENTS/docs where they still imply the live artifact runtime is the legacy E2B artifact path rather than the current canvas-first path. Treat stale E2B/runtime claims as incorrect unless a code search proves those paths are still active.

- [ ] **Step 3: Run focused migration and test verification**

Run:

```bash
bun run test -- lib/tools/__tests__/fetch.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/actions/__tests__/chat.test.ts lib/actions/__tests__/canvas-chat-ownership-race.test.ts lib/canvas/service.test.ts lib/canvas/service.integration.test.ts lib/canvas/compile-queue.test.ts lib/canvas/compile-worker.test.ts components/canvas/canvas-context.test.tsx lib/canvas/authorize-canvas-request.test.ts lib/rate-limit/shared-rate-limit.test.ts lib/rate-limit/__tests__/guest-limit.test.ts lib/rate-limit/__tests__/canvas-limits.test.ts lib/rate-limit/__tests__/rate-limit-fallback.test.ts
```

Expected: PASS

- [ ] **Step 4: Run repo-wide required checks**

Run:

```bash
bun lint
bun typecheck
bun run test
```

Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add docs/architecture/chat-canvas-reliability.md docs/getting-started/ENVIRONMENT.md AGENTS.md
git commit -m "docs: update architecture reliability guidance"
```

## Risks and Decision Gates

- **Queue/worker rollout:** If running a dedicated compile worker is not acceptable in your deployment model, stop after Task 3 and make a product decision before implementing Task 4.
- **Privilege model:** Do not merge worker or DB-fallback code until service-role/RLS behavior is explicit for queue claims, compile finalization, and shared rate-limit writes.
- **Client compatibility:** Do not switch canvas draft/restore to async compile until the client can represent `compiling`, missing compiled HTML, and explicit refresh/retry behavior.
- **Schema churn:** Tasks 4 and 5 both add persistence. Batch related migrations carefully to avoid migration conflicts.
- **Migration safety:** Always append a new Drizzle migration after the latest migration. Never rewrite an existing migration that may already have been applied.
- **Backward compatibility:** Pending assistant message rows and queued canvas jobs change state semantics. Verify UI code tolerates intermediate states before merging.
- **Operational readiness:** Add dashboards/alerts before enabling stricter rate-limit fallback or compile queue enforcement in production.

## Suggested Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 5
5. Task 4
6. Task 6

Task 5 is intentionally scheduled before Task 4 so guest auth and durable limiting are stable before introducing a background worker that can amplify request volume or artifact mutations.

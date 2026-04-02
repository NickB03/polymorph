# Phoenix Observability Hardening Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the Arize Phoenix observability integration so it is production-safe on Vercel serverless + Railway, with proper error handling, span flushing, timeout protection, and operational resilience.

**Architecture:** The app runs on Vercel (Next.js 16 serverless). OpenTelemetry traces export via OTLP/HTTPS to a self-hosted Phoenix instance on Railway. A separate Railway cron service (`services/evals/`) samples chats from Supabase and pushes eval results to Phoenix. The hardening targets three layers: instrumentation resilience (Tasks 1-2), operational correctness (Tasks 3-5), and documentation accuracy (Task 6).

**Tech Stack:** Next.js 16, `@vercel/otel`, `@arizeai/openinference-vercel`, `@opentelemetry/exporter-trace-otlp-proto`, Bun, Railway, Vitest

---

## File Structure

| File                                                     | Action | Responsibility                                                       |
| -------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| `instrumentation.ts`                                     | Modify | Add try/catch, exporter timeout, export timeout, HTTPS enforcement   |
| `lib/utils/telemetry.ts`                                 | Modify | Add `flushTraces()` helper for serverless span flushing              |
| `lib/streaming/create-chat-stream-response.ts`           | Modify | Call `flushTraces()` in `onFinish` callback                          |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Modify | Add `onFinish` callback with `flushTraces()` for guest session spans |
| `app/api/health/route.ts`                                | Modify | Add optional Phoenix connectivity check                              |
| `package.json`                                           | Modify | Fix start script to respect `PORT` env var with 43100 default        |
| `Dockerfile`                                             | Modify | Remove redundant `-H 0.0.0.0` from CMD (now in start script)         |
| `docker-compose.yaml`                                    | Modify | Remove redundant `-H 0.0.0.0` from command (now in start script)     |
| `services/evals/src/index.ts`                            | Modify | Add retry wrapper for Phoenix experiment push                        |
| `services/evals/src/retry.ts`                            | Create | Retry utility with exponential backoff                               |
| `lib/utils/telemetry.test.ts`                            | Create | Tests for telemetry utilities                                        |
| `services/evals/src/retry.test.ts`                       | Create | Tests for retry utility                                              |
| `services/evals/vitest.config.ts`                        | Create | Vitest configuration for evals service                               |
| `services/evals/package.json`                            | Modify | Add vitest dev dependency and test script                            |
| `docs/operations/DEPLOYMENT.md`                          | Modify | Add HTTPS requirement, migration pre-deploy note                     |
| `docs/getting-started/ENVIRONMENT.md`                    | Modify | Add HTTPS enforcement note                                           |
| `docs/reference/API.md`                                  | Modify | Update health endpoint response schema and query params              |

---

### Task 1: Harden OTel Initialization

**Files:**

- Modify: `instrumentation.ts:3-36`
- Create: `lib/utils/telemetry.test.ts`
- Modify: `lib/utils/telemetry.ts`

**Why:** If `registerOTel()` throws (malformed endpoint URL, missing dependency, network error during init), the entire Vercel deployment fails to start. Tracing is optional infrastructure — it must never crash the app. Additionally, the OTLP exporter has no timeout, so a hung Phoenix endpoint can block function shutdown.

- [ ] **Step 1: Write failing test for `isTracingEnabled`**

Create `lib/utils/telemetry.test.ts`:

```typescript
import { describe, expect, it, vi, afterEach } from 'vitest'

import { isTracingEnabled } from './telemetry'

describe('isTracingEnabled', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('returns false when ENABLE_TRACING is not set', () => {
    vi.stubEnv('ENABLE_TRACING', '')
    expect(isTracingEnabled()).toBe(false)
  })

  it('returns false when ENABLE_TRACING is "false"', () => {
    vi.stubEnv('ENABLE_TRACING', 'false')
    expect(isTracingEnabled()).toBe(false)
  })

  it('returns true when ENABLE_TRACING is "true"', () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    expect(isTracingEnabled()).toBe(true)
  })
})
```

- [ ] **Step 2: Run test to verify it passes**

Run: `bun run test -- lib/utils/telemetry.test.ts`
Expected: PASS (3 tests pass — we're testing existing code)

- [ ] **Step 3: Write failing test for `flushTraces`**

Add to `lib/utils/telemetry.test.ts`:

```typescript
import { isTracingEnabled, flushTraces } from './telemetry'

describe('flushTraces', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('resolves without error when tracing is disabled', async () => {
    vi.stubEnv('ENABLE_TRACING', 'false')
    await expect(flushTraces()).resolves.toBeUndefined()
  })

  it('resolves without error when tracing is enabled but no provider registered', async () => {
    vi.stubEnv('ENABLE_TRACING', 'true')
    // The default ProxyTracerProvider's delegate (NoopTracerProvider) has no
    // forceFlush, so the duck-type check returns early. This is safe.
    await expect(flushTraces()).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `bun run test -- lib/utils/telemetry.test.ts`
Expected: FAIL — `flushTraces` is not exported from `./telemetry`

- [ ] **Step 5: Implement `flushTraces` in telemetry.ts**

Replace the entire contents of `lib/utils/telemetry.ts` with:

```typescript
import { trace } from '@opentelemetry/api'

/**
 * Check if tracing is enabled
 * Default: false
 */
export function isTracingEnabled(): boolean {
  return process.env.ENABLE_TRACING === 'true'
}

/**
 * Flush pending trace spans to the collector.
 *
 * In Vercel serverless, the batch span processor queues spans and exports
 * them on a timer. If the function terminates before the batch flushes,
 * those spans are lost. Call this in onFinish callbacks of streaming routes
 * to ensure spans are exported before the function shuts down.
 *
 * Implementation notes:
 * - trace.getTracerProvider() returns a ProxyTracerProvider which does NOT
 *   have forceFlush(). We unwrap it via getDelegate() to reach the
 *   underlying BasicTracerProvider that does.
 * - forceFlush() accepts no arguments (timeout is configured at the
 *   TracerProvider level). We enforce our own timeout via Promise.race
 *   to prevent blocking serverless function shutdown.
 * - Safe to call when tracing is disabled — returns immediately.
 */
export async function flushTraces(timeoutMs = 5000): Promise<void> {
  if (!isTracingEnabled()) return

  try {
    const proxy = trace.getTracerProvider()
    const provider =
      'getDelegate' in proxy &&
      typeof (proxy as { getDelegate: () => unknown }).getDelegate ===
        'function'
        ? (proxy as { getDelegate: () => unknown }).getDelegate()
        : proxy

    if (
      provider &&
      'forceFlush' in (provider as object) &&
      typeof (provider as Record<string, unknown>).forceFlush === 'function'
    ) {
      await Promise.race([
        (provider as { forceFlush: () => Promise<void> }).forceFlush(),
        new Promise<void>(resolve => setTimeout(resolve, timeoutMs))
      ])
    }
  } catch (err) {
    // Tracing flush failures must never affect the request
    console.warn('[telemetry] Span flush failed — spans may be lost:', err)
  }
}
```

> **Note:** `@opentelemetry/api` is a transitive dependency via `@vercel/otel`. If it ever fails to resolve after a `@vercel/otel` upgrade, add it as a direct dependency: `bun add @opentelemetry/api`.

- [ ] **Step 6: Run test to verify it passes**

Run: `bun run test -- lib/utils/telemetry.test.ts`
Expected: PASS (5 tests pass)

- [ ] **Step 7: Harden `instrumentation.ts` — add try/catch, timeout, HTTPS enforcement**

Replace the entire contents of `instrumentation.ts` with:

```typescript
import { validateEnv } from '@/lib/config/env'

export async function register() {
  validateEnv()

  if (process.env.ENABLE_TRACING === 'true') {
    try {
      const { SEMRESATTRS_PROJECT_NAME } =
        await import('@arizeai/openinference-semantic-conventions')
      const { OpenInferenceBatchSpanProcessor } =
        await import('@arizeai/openinference-vercel')
      const { OTLPTraceExporter } =
        await import('@opentelemetry/exporter-trace-otlp-proto')
      const { registerOTel } = await import('@vercel/otel')

      const collectorEndpoint =
        process.env.PHOENIX_COLLECTOR_ENDPOINT ?? 'http://localhost:6006'

      // Enforce HTTPS in production to protect Bearer token in transit.
      // Mirrors the production detection logic in lib/config/env.ts.
      const isProduction =
        process.env.VERCEL_ENV === 'production' ||
        process.env.VERCEL_TARGET_ENV === 'production' ||
        process.env.RAILWAY_ENVIRONMENT === 'production' ||
        (process.env.NODE_ENV === 'production' && !process.env.VERCEL_ENV)
      if (isProduction && !collectorEndpoint.startsWith('https://')) {
        console.error(
          '[otel] PHOENIX_COLLECTOR_ENDPOINT must use HTTPS in production. Tracing disabled.'
        )
        return
      }

      registerOTel({
        serviceName: 'polymorph',
        attributes: {
          [SEMRESATTRS_PROJECT_NAME]:
            process.env.PHOENIX_PROJECT_NAME ?? 'polymorph',
          deployment_environment:
            process.env.VERCEL_ENV ??
            process.env.RAILWAY_ENVIRONMENT ??
            process.env.NODE_ENV ??
            'unknown'
        },
        spanProcessors: [
          new OpenInferenceBatchSpanProcessor({
            exporter: new OTLPTraceExporter({
              url: `${collectorEndpoint}/v1/traces`,
              headers: process.env.PHOENIX_API_KEY
                ? { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` }
                : {},
              timeoutMillis: 5000
            }),
            config: {
              exportTimeoutMillis: 5000
            }
          })
        ]
      })

      console.log(
        `[otel] Tracing enabled → ${collectorEndpoint} (project: ${process.env.PHOENIX_PROJECT_NAME ?? 'polymorph'})`
      )
    } catch (err) {
      console.error('[otel] Failed to initialize tracing:', err)
      // Tracing is optional — app continues without it
    }
  }

  // Initialize Ollama validation on server startup (only when configured)
  if (process.env.OLLAMA_BASE_URL) {
    const { initializeOllamaValidation } =
      await import('@/lib/config/ollama-validator')
    await initializeOllamaValidation().catch(err => {
      console.error('Failed to initialize Ollama validation:', err)
    })
  }
}
```

Key changes from original:

- **try/catch**: Entire OTel init wrapped so tracing failures never crash the app
- **HTTPS enforcement**: Mirrors `lib/config/env.ts` production detection (includes `VERCEL_TARGET_ENV` and `NODE_ENV` fallback for self-hosted Docker)
- **Exporter timeout**: `timeoutMillis: 5000` prevents hung HTTP requests to Phoenix
- **Export timeout**: `config.exportTimeoutMillis: 5000` prevents batch processor from blocking on slow exports
- **Batch config**: Uses `config:` nesting (required by `OpenInferenceBatchSpanProcessor` constructor — see `node_modules/@arizeai/openinference-vercel/dist/esm/OpenInferenceSpanProcessor.d.ts:57-74`). Queue size and batch size left at OTel defaults (2048/512) which are well-tuned for this workload
- **deployment_environment**: Now includes `VERCEL_ENV` fallback (previously always `'unknown'` on Vercel)

- [ ] **Step 8: Run typecheck to verify no type errors**

Run: `bun typecheck`
Expected: No errors

- [ ] **Step 9: Commit**

```bash
git add instrumentation.ts lib/utils/telemetry.ts lib/utils/telemetry.test.ts
git commit -m "fix: harden OTel init with try/catch, exporter timeout, HTTPS enforcement, span flushing"
```

---

### Task 2: Add Span Flushing to Streaming Routes

**Files:**

- Modify: `lib/streaming/create-chat-stream-response.ts:317-339`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts:170-174`

**Why:** The `OpenInferenceBatchSpanProcessor` queues spans and exports on a timer. In Vercel serverless, the function can terminate after the streaming response closes but before the batch flushes. The 300-second chat route with up to 50 tool steps generates hundreds of spans — tail spans from long research sessions will be silently lost without an explicit flush. Both authenticated and ephemeral (guest) streams create trace IDs and must flush.

- [ ] **Step 1: Add `flushTraces` import to `create-chat-stream-response.ts`**

In `lib/streaming/create-chat-stream-response.ts`, find the existing import:

```typescript
import { isTracingEnabled } from '@/lib/utils/telemetry'
```

Replace with:

```typescript
import { flushTraces, isTracingEnabled } from '@/lib/utils/telemetry'
```

- [ ] **Step 2: Call `flushTraces()` in the `onFinish` callback**

In `lib/streaming/create-chat-stream-response.ts`, find the `onFinish` callback (line 317):

```typescript
onFinish: async ({ responseMessage, isAborted }) => {
  if (isAborted || !responseMessage) return

  try {
    // Persist stream results to database
    await persistStreamResults(
      responseMessage,
      chatId,
      userId,
      titlePromise,
      parentTraceId,
      searchMode,
      context.modelId,
      context.pendingInitialSave,
      context.pendingInitialUserMessage
    )
  } catch (error) {
    console.error(
      `[onFinish] Failed to persist stream results for chat ${chatId}:`,
      error
    )
  }
}
```

Replace with:

```typescript
onFinish: async ({ responseMessage, isAborted }) => {
  if (isAborted || !responseMessage) return

  try {
    // Persist stream results to database
    await persistStreamResults(
      responseMessage,
      chatId,
      userId,
      titlePromise,
      parentTraceId,
      searchMode,
      context.modelId,
      context.pendingInitialSave,
      context.pendingInitialUserMessage
    )
  } catch (error) {
    console.error(
      `[onFinish] Failed to persist stream results for chat ${chatId}:`,
      error
    )
  }

  // Flush OTel spans before the serverless function terminates.
  // Runs after persistence so spans include DB write latency.
  // The 5s timeout (default) is small relative to the 300s maxDuration.
  await flushTraces()
}
```

- [ ] **Step 3: Add `onFinish` callback to `create-ephemeral-chat-stream-response.ts`**

The ephemeral stream creates trace IDs (`parentTraceId` at line 58-60) and passes them to the researcher agent, but currently has no `onFinish` callback. Without flushing, all guest session spans are lost.

In `lib/streaming/create-ephemeral-chat-stream-response.ts`, add the import alongside the existing telemetry import (line 19):

Find:

```typescript
import { isTracingEnabled } from '@/lib/utils/telemetry'
```

Replace with:

```typescript
import { flushTraces, isTracingEnabled } from '@/lib/utils/telemetry'
```

Then find the `onError` callback and closing of `createUIMessageStream` (lines 170-174):

```typescript
    },
    onError: (error: unknown) => {
      return error instanceof Error ? error.message : String(error)
    }
  })
```

Replace with:

```typescript
    },
    onError: (error: unknown) => {
      return error instanceof Error ? error.message : String(error)
    },
    onFinish: async () => {
      await flushTraces()
    }
  })
```

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add lib/streaming/create-chat-stream-response.ts lib/streaming/create-ephemeral-chat-stream-response.ts
git commit -m "fix: flush OTel spans in onFinish to prevent span loss in serverless"
```

---

### Task 3: Fix Port Configuration

**Files:**

- Modify: `package.json:10`
- Modify: `Dockerfile:53`
- Modify: `docker-compose.yaml:7`

**Why:** The `start` script hardcodes `--port 43100`, which overrides Railway's injected `PORT` environment variable. Additionally, both the Dockerfile CMD and docker-compose command pass `-H 0.0.0.0`, which is not a valid `next start` flag (`--hostname` is the correct form). Since `--hostname 0.0.0.0` is in the start script, these should be cleaned up.

- [ ] **Step 1: Fix the start script to respect PORT with a default**

In `package.json`, find line 10:

```json
    "start": "next start --hostname 0.0.0.0 --port 43100",
```

Replace with:

```json
    "start": "next start --hostname 0.0.0.0 --port ${PORT:-43100}",
```

Shell parameter expansion `${PORT:-43100}` means: use `PORT` if set, otherwise default to `43100`. This preserves the local dev convention (port 43100 without setting env vars) while allowing Railway/Docker to override via the `PORT` environment variable.

- [ ] **Step 2: Simplify Dockerfile CMD**

In `Dockerfile`, find line 53:

```dockerfile
CMD ["bun", "start", "-H", "0.0.0.0"]
```

Replace with:

```dockerfile
CMD ["bun", "start"]
```

`--hostname 0.0.0.0` is now baked into the `start` script. The `-H` shorthand was not a valid `next start` flag anyway (`--hostname` is correct).

- [ ] **Step 3: Simplify docker-compose command**

In `docker-compose.yaml`, find line 7:

```yaml
command: bun start -H 0.0.0.0
```

Replace with:

```yaml
command: bun start
```

Same rationale as the Dockerfile — `--hostname` is already in the script. The docker-compose environment block already sets `PORT: 43100` (line 21), so the port mapping `'${POLYMORPH_PORT:-43100}:43100'` (line 23) remains correct.

- [ ] **Step 4: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add package.json Dockerfile docker-compose.yaml
git commit -m "fix: respect PORT env var in start script, clean up Dockerfile/compose CMD"
```

---

### Task 4: Add Phoenix Connectivity to Health Endpoint

**Files:**

- Modify: `app/api/health/route.ts:1-41`
- Modify: `docs/reference/API.md:428-459`

**Why:** The current health endpoint only checks database connectivity. If Phoenix is unreachable, traces are silently dropped with no alerting. Adding an optional Phoenix check (triggered by `?check=phoenix` query param) gives operators visibility into collector availability without affecting the primary healthcheck used by load balancers.

- [ ] **Step 1: Implement Phoenix health check**

Replace the contents of `app/api/health/route.ts` with:

```typescript
import { NextRequest, NextResponse } from 'next/server'

import { sql } from 'drizzle-orm'

import { db } from '@/lib/db'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const timestamp = new Date().toISOString()
  const checks = req.nextUrl.searchParams.get('check')

  // Always check database
  let dbStatus: 'connected' | 'error' = 'error'
  let dbError: string | undefined
  try {
    await Promise.race([
      db.execute(sql`SELECT 1`),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Database health check timed out after 5s')),
          5000
        )
      )
    ])
    dbStatus = 'connected'
  } catch (error) {
    dbError =
      process.env.NODE_ENV === 'development'
        ? error instanceof Error
          ? error.message
          : 'Unknown error'
        : 'unreachable'
  }

  // Optional Phoenix check (only when requested and tracing is configured).
  // Phoenix status is advisory-only — it does NOT affect the HTTP status code.
  // Load balancers hit /api/health without params and only care about DB status.
  let phoenixStatus: 'ok' | 'error' | 'disabled' | undefined
  if (checks === 'phoenix' || checks === 'all') {
    const endpoint = process.env.PHOENIX_COLLECTOR_ENDPOINT
    if (!endpoint || process.env.ENABLE_TRACING !== 'true') {
      phoenixStatus = 'disabled'
    } else {
      try {
        // Phoenix exposes a health endpoint at /healthz.
        // If your Phoenix version uses a different path, update this.
        const resp = await fetch(`${endpoint}/healthz`, {
          signal: AbortSignal.timeout(3000)
        })
        phoenixStatus = resp.ok ? 'ok' : 'error'
      } catch {
        phoenixStatus = 'error'
      }
    }
  }

  const isHealthy = dbStatus === 'connected'
  const body: Record<string, unknown> = {
    status: isHealthy ? 'ok' : 'error',
    timestamp,
    db: dbStatus
  }
  if (dbError) body.dbError = dbError
  if (phoenixStatus !== undefined) body.phoenix = phoenixStatus

  return NextResponse.json(body, { status: isHealthy ? 200 : 503 })
}
```

> **Verify the Phoenix health path.** The code assumes `/healthz`. If your Phoenix instance uses a different path (e.g., `/health`, `/api/health`), update the fetch URL. You can test with: `curl -s https://your-phoenix-host/healthz`

- [ ] **Step 2: Update API.md health endpoint documentation**

In `docs/reference/API.md`, find the health endpoint section (lines 428-459). Replace the entire `### GET /api/health` section (up to but not including `---` before `## Canvas Artifact Endpoints`) with:

````markdown
### GET `/api/health`

Health check endpoint for monitoring and load balancers. Verifies database connectivity with a 5-second timeout. Optionally checks Phoenix collector connectivity.

**Authentication:** None
**Dynamic:** `force-dynamic`

For Vercel monitoring, use the canonical production alias (`https://polymorph-nb.vercel.app/api/health`). Raw deployment URLs may be protected by Vercel Authentication even when the application route itself is public.

#### Query Parameters

| Parameter | Values           | Description                                                        |
| --------- | ---------------- | ------------------------------------------------------------------ |
| `check`   | `phoenix`, `all` | Include optional Phoenix collector connectivity check (3s timeout) |

#### Response

**Content-Type:** `application/json`

**Healthy (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "connected"
}
```
````

**Healthy with Phoenix check (200):**

```json
{
  "status": "ok",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "connected",
  "phoenix": "ok"
}
```

**Unhealthy (503):**

```json
{
  "status": "error",
  "timestamp": "2025-01-15T10:30:00.000Z",
  "db": "error",
  "dbError": "unreachable"
}
```

> **Note:** Phoenix status is advisory-only and does not affect the HTTP status code. The endpoint returns 503 only when the database is unreachable.

````

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/api/health/route.ts docs/reference/API.md
git commit -m "feat: add optional Phoenix connectivity check to health endpoint"
````

---

### Task 5: Add Retry Logic to Evals Service

**Files:**

- Create: `services/evals/vitest.config.ts`
- Modify: `services/evals/package.json`
- Create: `services/evals/src/retry.ts`
- Create: `services/evals/src/retry.test.ts`
- Modify: `services/evals/src/index.ts:63-76`

**Why:** The evals cron job calls `runExperiment()` to push results to Phoenix. If Phoenix is briefly unreachable (deploy in progress, network blip), the entire cron run fails with no retry. Since this runs every 6 hours, a single failure means a 12-hour gap in eval data.

> **Idempotency note:** `runExperiment` may not be fully idempotent. If it partially succeeds then fails, retrying re-runs all evaluators. The experiment name includes a timestamp to the hour, so retries within the same hour reuse the name. In practice this is acceptable — a small chance of duplicate eval data is better than a 12-hour gap. Phoenix experiment names are timestamped for easy identification.

- [ ] **Step 1: Set up test infrastructure for evals service**

The evals service has no test runner. The root vitest config scopes coverage to `lib/**` and `app/api/**`, excluding `services/`. Add a local vitest config.

Create `services/evals/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    globals: true
  }
})
```

In `services/evals/package.json`, add `vitest` to devDependencies and a `test` script:

```json
{
  "name": "polymorph-evals",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "start": "bun run src/index.ts",
    "dev": "bun run --watch src/index.ts",
    "test": "vitest run"
  },
  "dependencies": {
    "@arizeai/phoenix-client": "^1.0.0",
    "@ai-sdk/openai": "^3.0.23",
    "ai": "^6.0.64",
    "drizzle-orm": "^0.43.1",
    "postgres": "^3.4.7"
  },
  "devDependencies": {
    "@types/bun": "^1.2.0",
    "typescript": "^5.8.0",
    "vitest": "^3.1.1"
  }
}
```

- [ ] **Step 2: Install vitest in evals service**

Run: `cd services/evals && bun install`
Expected: vitest installed, lockfile updated

- [ ] **Step 3: Write failing test for retry utility**

Create `services/evals/src/retry.test.ts`:

```typescript
import { describe, expect, it, vi } from 'vitest'

import { withRetry } from './retry'

describe('withRetry', () => {
  it('returns result on first success', async () => {
    const fn = vi.fn().mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(1)
  })

  it('retries on failure and succeeds', async () => {
    const fn = vi
      .fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValue('ok')
    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    expect(result).toBe('ok')
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('throws after exhausting all attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('always fails'))
    await expect(
      withRetry(fn, { maxAttempts: 3, baseDelayMs: 10 })
    ).rejects.toThrow('always fails')
    expect(fn).toHaveBeenCalledTimes(3)
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd services/evals && bun run test`
Expected: FAIL — `./retry` module not found

- [ ] **Step 5: Implement retry utility**

Create `services/evals/src/retry.ts`:

```typescript
interface RetryOptions {
  maxAttempts: number
  baseDelayMs: number
}

/**
 * Retry an async function with exponential backoff.
 * Delay doubles each attempt: baseDelayMs, baseDelayMs*2, baseDelayMs*4, ...
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  opts: RetryOptions
): Promise<T> {
  let lastError: unknown
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (attempt < opts.maxAttempts) {
        const delay = opts.baseDelayMs * 2 ** (attempt - 1)
        console.warn(
          `[retry] Attempt ${attempt}/${opts.maxAttempts} failed, retrying in ${delay}ms...`
        )
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }
  throw lastError
}
```

- [ ] **Step 6: Run test to verify it passes**

Run: `cd services/evals && bun run test`
Expected: PASS (3 tests)

- [ ] **Step 7: Wrap `runExperiment` in retry logic**

In `services/evals/src/index.ts`, add the import at the top (after existing imports):

```typescript
import { withRetry } from './retry'
```

Then find the `runExperiment` call (line 63):

```typescript
const experiment = await runExperiment({
  experimentName,
  experimentDescription: `Automated eval of ${samples.length} chats from the last ${config.lookbackHours}h`,
  dataset: examples,
  task: async example => {
    return (example.output as Record<string, unknown>)?.answer ?? ''
  },
  evaluators: [
    faithfulnessEvaluator,
    relevanceEvaluator,
    responseQualityEvaluator
  ],
  concurrency: 3
})
```

Replace with:

```typescript
const experiment = await withRetry(
  () =>
    runExperiment({
      experimentName,
      experimentDescription: `Automated eval of ${samples.length} chats from the last ${config.lookbackHours}h`,
      dataset: examples,
      task: async example => {
        return (example.output as Record<string, unknown>)?.answer ?? ''
      },
      evaluators: [
        faithfulnessEvaluator,
        relevanceEvaluator,
        responseQualityEvaluator
      ],
      concurrency: 3
    }),
  { maxAttempts: 3, baseDelayMs: 5000 }
)
```

- [ ] **Step 8: Commit**

```bash
git add services/evals/vitest.config.ts services/evals/package.json services/evals/src/retry.ts services/evals/src/retry.test.ts services/evals/src/index.ts
git commit -m "feat: add retry with exponential backoff to evals Phoenix experiment push"
```

---

### Task 6: Update Documentation

**Files:**

- Modify: `docs/operations/DEPLOYMENT.md`
- Modify: `docs/getting-started/ENVIRONMENT.md`

**Why:** Documentation gaps: no mention of HTTPS requirement for production, no guidance on Railway pre-deploy migrations.

- [ ] **Step 1: Update DEPLOYMENT.md — add migration pre-deploy recommendation and HTTPS note**

In `docs/operations/DEPLOYMENT.md`, find the section "### Phoenix service" (around line 69). After line 77 (the Auth line), add:

```markdown
> **HTTPS required in production.** The `instrumentation.ts` enforces HTTPS for the collector endpoint when `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `RAILWAY_ENVIRONMENT=production`, or `NODE_ENV=production` (without `VERCEL_ENV`). If the endpoint uses plain HTTP, tracing is silently disabled and a console error is logged.
```

Also, in the "## Healthcheck expectations" section (around line 43), add after the migration line:

```markdown
- **Docker/Railway deployments:** Consider moving `bun run migrate` from the Docker entrypoint to a Railway Pre-Deploy Command to avoid race conditions with multi-replica deployments. The entrypoint runs migrations on every container start; pre-deploy runs once between build and deploy.
```

- [ ] **Step 2: Update ENVIRONMENT.md — add HTTPS note to tracing section**

In `docs/getting-started/ENVIRONMENT.md`, find the "### Tracing (Arize Phoenix)" section (around line 76). Add a note:

```markdown
> **Production HTTPS enforcement:** When the app detects a production environment (`VERCEL_ENV`, `VERCEL_TARGET_ENV`, `RAILWAY_ENVIRONMENT`, or `NODE_ENV` set to `production`), the collector endpoint must use `https://`. Plain HTTP endpoints cause tracing to be silently disabled to protect the API key in transit.
```

- [ ] **Step 3: Commit**

```bash
git add docs/operations/DEPLOYMENT.md docs/getting-started/ENVIRONMENT.md
git commit -m "docs: add HTTPS enforcement, migration pre-deploy, and Phoenix health check notes"
```

---

## Verification Checklist

After all tasks are complete, verify:

- [ ] `bun typecheck` passes with no errors
- [ ] `bun lint` passes with no errors
- [ ] `bun run test` passes (including new tests in Task 1)
- [ ] `cd services/evals && bun run test` passes (including new tests in Task 5)
- [ ] With `ENABLE_TRACING=false`: app starts normally, no OTel errors in logs
- [ ] With `ENABLE_TRACING=true` and a valid local Phoenix: traces appear in Phoenix UI
- [ ] With `ENABLE_TRACING=true` and an unreachable endpoint: app starts normally, console shows `[otel] Failed to initialize tracing` or exporter timeout warnings — no crash
- [ ] `GET /api/health` returns `200` with `{ status: 'ok', db: 'connected' }`
- [ ] `GET /api/health?check=phoenix` returns Phoenix status field
- [ ] `bun start` (without PORT set) starts on port 43100
- [ ] `PORT=3000 bun start` starts on port 3000
- [ ] `docker compose up polymorph` starts correctly, app reachable on configured port
- [ ] Run evals with Phoenix temporarily stopped: retry logs appear (`[retry] Attempt 1/3 failed...`), eventual failure exits with code 1 (not a crash)

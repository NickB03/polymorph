import {
  context as otelContext,
  SpanStatusCode,
  trace
} from '@opentelemetry/api'

export function isTracingEnabled(): boolean {
  return process.env.ENABLE_TRACING === 'true'
}

export function isEvalReplayTracingEnabled(): boolean {
  return process.env.EVAL_REPLAY_TRACING_ENABLED === 'true'
}

// The OPENINFERENCE_HIDE_* env vars are NOT read by openinference-vercel's span
// processor in this setup, so setting them alone masks nothing. The AI SDK does
// honour recordInputs/recordOutputs per call, which makes this helper the single
// enforcement point — spread it into every experimental_telemetry block.
export function telemetryRecordingOptions(): {
  recordInputs: boolean
  recordOutputs: boolean
} {
  return {
    recordInputs: process.env.OPENINFERENCE_HIDE_INPUTS !== 'true',
    recordOutputs: process.env.OPENINFERENCE_HIDE_OUTPUTS !== 'true'
  }
}

type TraceMetadata = Record<
  string,
  string | number | boolean | null | undefined
>

export interface OtelRootSpanOptions {
  name: string
  sessionId?: string
  userId?: string
  metadata?: TraceMetadata
}

export interface OtelRootSpanContext {
  otelTraceId?: string
}

function cleanMetadata(metadata: TraceMetadata = {}) {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined)
  )
}

async function buildOpenInferenceContext({
  sessionId,
  userId,
  metadata
}: Omit<OtelRootSpanOptions, 'name'>) {
  let ctx = otelContext.active()

  try {
    const { setMetadata, setSession, setUser } =
      await import('@arizeai/openinference-core')

    if (sessionId) {
      ctx = setSession(ctx, { sessionId })
    }
    if (userId) {
      ctx = setUser(ctx, { userId })
    }

    const filteredMetadata = cleanMetadata(metadata)
    if (Object.keys(filteredMetadata).length > 0) {
      ctx = setMetadata(ctx, filteredMetadata)
    }
  } catch {
    // If openinference-core fails to load, keep the active context.
  }

  return ctx
}

export async function withOtelRootSpan<T>(
  options: OtelRootSpanOptions,
  fn: (context: OtelRootSpanContext) => Promise<T>
): Promise<T> {
  if (!isTracingEnabled()) return fn({})

  const ctx = await buildOpenInferenceContext(options)
  const metadata = cleanMetadata(options.metadata)

  let spanStarted = false

  return otelContext.with(ctx, async () => {
    try {
      return await new Promise<T>((resolve, reject) => {
        const tracer = trace.getTracer('polymorph')
        tracer.startActiveSpan(options.name, span => {
          spanStarted = true
          const otelTraceId = span.spanContext().traceId

          if (options.sessionId) {
            span.setAttribute('session.id', options.sessionId)
          }
          if (options.userId) {
            span.setAttribute('user.id', options.userId)
          }
          if (Object.keys(metadata).length > 0) {
            span.setAttribute('metadata', JSON.stringify(metadata))
          }

          fn({ otelTraceId })
            .then(result => {
              span.setStatus({ code: SpanStatusCode.OK })
              resolve(result)
            })
            .catch(error => {
              span.recordException(error as Error)
              span.setStatus({
                code: SpanStatusCode.ERROR,
                message: error instanceof Error ? error.message : String(error)
              })
              reject(error)
            })
            .finally(() => span.end())
        })
      })
    } catch (error) {
      if (!spanStarted) {
        return fn({})
      }
      throw error
    }
  })
}

/**
 * Run a callback with OpenInference session + user context propagation.
 *
 * All spans created inside `fn` will carry `session.id` (and optionally
 * `user.id`) attributes, which Phoenix uses to group traces into sessions.
 *
 * Safe to call when tracing is disabled — executes `fn` immediately.
 */
export async function withOtelSession<T>(
  {
    sessionId,
    userId
  }: {
    sessionId: string
    userId?: string
  },
  fn: () => Promise<T>
): Promise<T> {
  if (!isTracingEnabled()) return fn()

  try {
    const ctx = await buildOpenInferenceContext({ sessionId, userId })

    return otelContext.with(ctx, fn)
  } catch {
    // If openinference-core fails to load, run without context
    return fn()
  }
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
      let timedOut = false
      await Promise.race([
        (provider as { forceFlush: () => Promise<void> }).forceFlush(),
        new Promise<void>(resolve =>
          setTimeout(() => {
            timedOut = true
            resolve()
          }, timeoutMs)
        )
      ])
      if (timedOut) {
        console.warn(
          `[telemetry] Span flush timed out after ${timeoutMs}ms — some spans may be lost`
        )
      }
    } else {
      console.warn(
        '[telemetry] TracerProvider lacks forceFlush — spans may not export before shutdown'
      )
    }
  } catch (err) {
    // Tracing flush failures must never affect the request
    console.warn('[telemetry] Span flush failed — spans may be lost:', err)
  }
}

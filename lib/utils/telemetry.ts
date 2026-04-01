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

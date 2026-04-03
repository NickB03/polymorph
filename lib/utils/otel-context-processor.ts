import type { Context } from '@opentelemetry/api'
import type {
  ReadableSpan,
  Span,
  SpanProcessor
} from '@opentelemetry/sdk-trace-base'

/**
 * A span processor that propagates OpenInference context attributes
 * (session.id, user.id, tags, metadata, etc.) to spans on start.
 *
 * The standard OpenInferenceBatchSpanProcessor only maps Vercel AI SDK
 * `ai.*` attributes to OpenInference format. It does NOT read values
 * set via `setSession()` / `setUser()` from `@arizeai/openinference-core`.
 *
 * This processor fills that gap: when code runs inside
 * `context.with(setSession(ctx, { sessionId }), fn)`, every span
 * created within `fn` will automatically receive the `session.id`
 * attribute — making Phoenix Sessions work.
 */
export class OpenInferenceContextPropagator implements SpanProcessor {
  private getAttributesFromContext:
    | ((ctx: Context) => Record<string, unknown>)
    | null = null

  async init() {
    try {
      const { getAttributesFromContext } =
        await import('@arizeai/openinference-core')
      this.getAttributesFromContext = getAttributesFromContext
    } catch {
      // openinference-core not available — processor becomes a no-op
    }
  }

  onStart(span: Span, parentContext: Context): void {
    if (!this.getAttributesFromContext) return

    const attrs = this.getAttributesFromContext(parentContext)
    if (attrs && Object.keys(attrs).length > 0) {
      span.setAttributes(attrs as Record<string, string>)
    }
  }

  onEnd(_span: ReadableSpan): void {
    // No-op — attribute enrichment happens in onStart
  }

  shutdown(): Promise<void> {
    return Promise.resolve()
  }

  forceFlush(): Promise<void> {
    return Promise.resolve()
  }
}

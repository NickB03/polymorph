import { isProductionTarget, validateEnv } from '@/lib/config/env'

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
      const { OpenInferenceContextPropagator } =
        await import('@/lib/utils/otel-context-processor')

      const collectorEndpoint =
        process.env.PHOENIX_COLLECTOR_ENDPOINT ?? 'http://localhost:6006'

      // Enforce HTTPS in production to protect Bearer token in transit.
      if (isProductionTarget() && !collectorEndpoint.startsWith('https://')) {
        console.error(
          '[otel] PHOENIX_COLLECTOR_ENDPOINT must use HTTPS in production. Tracing disabled.'
        )
        return
      }

      // Propagates OpenInference context attributes (session.id, user.id)
      // set via setSession()/setUser() onto every child span.
      const contextPropagator = new OpenInferenceContextPropagator()
      await contextPropagator.init()

      registerOTel({
        serviceName: 'polymorph',
        attributes: {
          [SEMRESATTRS_PROJECT_NAME]:
            process.env.PHOENIX_PROJECT_NAME ?? 'polymorph-local',
          deployment_environment:
            process.env.VERCEL_ENV ??
            process.env.RAILWAY_ENVIRONMENT ??
            process.env.NODE_ENV ??
            'unknown'
        },
        spanProcessors: [
          contextPropagator,
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

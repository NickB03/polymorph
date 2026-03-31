import { SEMRESATTRS_PROJECT_NAME } from '@arizeai/openinference-semantic-conventions'
import { OpenInferenceBatchSpanProcessor } from '@arizeai/openinference-vercel'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-proto'
import { registerOTel } from '@vercel/otel'

import { validateEnv } from '@/lib/config/env'

export async function register() {
  validateEnv()

  const collectorEndpoint =
    process.env.PHOENIX_COLLECTOR_ENDPOINT ?? 'http://localhost:6006'

  registerOTel({
    serviceName: 'polymorph',
    attributes: {
      [SEMRESATTRS_PROJECT_NAME]:
        process.env.PHOENIX_PROJECT_NAME ?? 'polymorph',
      deployment_environment: process.env.RAILWAY_ENVIRONMENT ?? 'unknown'
    },
    spanProcessors: [
      new OpenInferenceBatchSpanProcessor({
        exporter: new OTLPTraceExporter({
          url: `${collectorEndpoint}/v1/traces`,
          headers: process.env.PHOENIX_API_KEY
            ? { Authorization: `Bearer ${process.env.PHOENIX_API_KEY}` }
            : {}
        })
      })
    ]
  })

  // Initialize Ollama validation on server startup (only when configured)
  if (process.env.OLLAMA_BASE_URL) {
    const { initializeOllamaValidation } =
      await import('@/lib/config/ollama-validator')
    await initializeOllamaValidation().catch(err => {
      console.error('Failed to initialize Ollama validation:', err)
    })
  }
}

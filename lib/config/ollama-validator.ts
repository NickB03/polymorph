import { loadModelsConfig } from '@/lib/config/load-models-config'
import { OllamaClient } from '@/lib/ollama/client'
import { Model } from '@/lib/types/models'

/**
 * Extract all Ollama models from the configuration
 */
async function getConfiguredOllamaModels(): Promise<Model[]> {
  const ollamaModels: Model[] = []

  try {
    const config = await loadModelsConfig()

    // Check byMode models
    for (const mode of Object.values(config.models.byMode)) {
      for (const model of Object.values(mode as Record<string, Model>)) {
        if (model.providerId === 'ollama') {
          ollamaModels.push(model)
        }
      }
    }

    // Check relatedQuestions model
    if (config.models.relatedQuestions?.providerId === 'ollama') {
      ollamaModels.push(config.models.relatedQuestions)
    }
  } catch (error) {
    console.warn('Failed to load model configuration:', error)
  }

  return ollamaModels
}

/**
 * Initialize Ollama model validation on server startup
 * Checks which models support 'tools' capability required for Polymorph
 * Also validates that configured Ollama models support tools
 */
export async function initializeOllamaValidation(): Promise<void> {
  // Skip validation if OLLAMA_BASE_URL is not configured
  if (!process.env.OLLAMA_BASE_URL) {
    console.log('Ollama validation skipped (OLLAMA_BASE_URL not configured)')
    return
  }

  try {
    console.log(
      `Starting Ollama model validation at ${process.env.OLLAMA_BASE_URL}`
    )

    const client = new OllamaClient(process.env.OLLAMA_BASE_URL)

    // Check if Ollama is available
    const isAvailable = await client.isAvailable()
    if (!isAvailable) {
      console.warn(
        'Ollama instance is not available. Models will not be validated.'
      )
      return
    }

    // Get all available models
    const models = await client.getModels()
    console.log(`Found ${models.length} Ollama models`)

    // Validate each model for tools capability
    const validated = new Set<string>()
    for (const model of models) {
      try {
        const capabilities = await client.getModelCapabilities(model.name)
        if (capabilities.capabilities.includes('tools')) {
          validated.add(model.name)
          console.log(`✓ ${model.name} supports tools`)
        } else {
          console.log(`✗ ${model.name} does not support tools (skipped)`)
        }
      } catch (err) {
        console.warn(`Failed to check capabilities for ${model.name}:`, err)
        continue
      }
    }

    console.log(
      `Ollama validation complete: ${validated.size} models with tools support`
    )

    // Check configured models against validated models
    try {
      const configuredOllamaModels = await getConfiguredOllamaModels()

      if (configuredOllamaModels.length > 0) {
        console.log(
          `\nValidating ${configuredOllamaModels.length} configured Ollama model(s)...`
        )

        const invalidModels: string[] = []
        for (const model of configuredOllamaModels) {
          if (!validated.has(model.id)) {
            invalidModels.push(model.id)
            console.error(`✗ ${model.id} (configured but lacks tools support)`)
          } else {
            console.log(`✓ ${model.id} (configured and tools supported)`)
          }
        }

        if (invalidModels.length > 0) {
          console.error(
            '\n⚠️  ERROR: Configured Ollama models do not support tools!\n' +
              `The following model(s) in your config/models/*.json do not support tools capability:\n` +
              invalidModels.map(m => `  - ${m}`).join('\n') +
              '\n\nPolymorph requires models with tools capability for web search functionality.\n' +
              'Please update your configuration to use models with tools support, for example:\n' +
              '  ollama pull qwen3\n' +
              '  ollama pull gpt-oss\n' +
              '  ollama pull deepseek-v3.1\n'
          )
        }
      }
    } catch (configError) {
      console.warn('Failed to validate configured models:', configError)
    }

    // Error if no models support tools at all
    if (validated.size === 0) {
      console.error(
        '\n⚠️  ERROR: No Ollama models with tools support found!\n' +
          'Polymorph requires models with tools capability for web search functionality.\n' +
          'Please install a model with tools support, for example:\n' +
          '  ollama pull qwen3\n' +
          '  ollama pull gpt-oss\n' +
          '  ollama pull deepseek-v3.1\n' +
          'Models without tools support will not work with Polymorph.\n'
      )
    }
  } catch (error) {
    console.error('Ollama validation failed:', error)
    console.warn('Polymorph will continue, but Ollama models may not work')
  }
}

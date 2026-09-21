import { anthropic } from '@ai-sdk/anthropic'
import { createGateway } from '@ai-sdk/gateway'
import { google } from '@ai-sdk/google'
import { createOpenAI, openai } from '@ai-sdk/openai'
import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createProviderRegistry, ImageModel, LanguageModel } from 'ai'
import { createOllama } from 'ollama-ai-provider-v2'

// `createProviderRegistry` decides how to treat a provider by the
// `specificationVersion` on the *provider object*, not on its models. A
// provider that omits it is wrapped in the AI SDK's v2 compatibility proxy,
// which re-wraps the already-structured v4 `finishReason` into
// `{ unified: { unified, raw }, raw: undefined }` and breaks the UI message
// stream (`finish` chunk validation fails client-side). Every model these
// providers return is v4, so declare it when the provider forgot to.
function asV4Provider<T extends object>(provider: T): T {
  if (!('specificationVersion' in provider)) {
    Object.assign(provider, { specificationVersion: 'v4' as const })
  }
  return provider
}

// Build providers object conditionally
const providers: Record<string, any> = {
  openai,
  anthropic,
  google,
  gateway: createGateway({
    apiKey: process.env.AI_GATEWAY_API_KEY
  }),
  // @openrouter/ai-sdk-provider 3.0.0 ships v4 models but no provider-level
  // specificationVersion.
  openrouter: asV4Provider(
    createOpenRouter({
      apiKey: process.env.OPENROUTER_API_KEY
    })
  )
}

if (
  process.env.OPENAI_COMPATIBLE_API_KEY &&
  process.env.OPENAI_COMPATIBLE_API_BASE_URL
) {
  providers['openai-compatible'] = asV4Provider(
    createOpenAI({
      apiKey: process.env.OPENAI_COMPATIBLE_API_KEY,
      baseURL: process.env.OPENAI_COMPATIBLE_API_BASE_URL
    })
  )
}

// Only add Ollama if OLLAMA_BASE_URL is configured
if (process.env.OLLAMA_BASE_URL) {
  providers.ollama = asV4Provider(
    createOllama({
      baseURL: `${process.env.OLLAMA_BASE_URL}/api`
    })
  )
}

/** Exported for the registry regression test only. */
export const registryProviders: Readonly<Record<string, unknown>> = providers

export const registry = createProviderRegistry(providers)

export function getModel(model: string): LanguageModel {
  if (!model.includes(':')) {
    throw new Error(
      `Invalid model format "${model}": expected "provider:model-id" (e.g. "openrouter:z-ai/glm-5.3-flash")`
    )
  }
  return registry.languageModel(
    model as Parameters<typeof registry.languageModel>[0]
  )
}

export function getImageModel(model: string): ImageModel {
  if (!model.includes(':')) {
    throw new Error(
      `Invalid model format "${model}": expected "provider:model-id" (e.g. "gateway:meta/muse-image-1.0")`
    )
  }
  return registry.imageModel(model as Parameters<typeof registry.imageModel>[0])
}

export function isProviderEnabled(providerId: string): boolean {
  switch (providerId) {
    case 'openai':
      return !!process.env.OPENAI_API_KEY
    case 'anthropic':
      return !!process.env.ANTHROPIC_API_KEY
    case 'google':
      return !!process.env.GOOGLE_GENERATIVE_AI_API_KEY
    case 'openai-compatible':
      return (
        !!process.env.OPENAI_COMPATIBLE_API_KEY &&
        !!process.env.OPENAI_COMPATIBLE_API_BASE_URL
      )
    case 'gateway':
      return !!process.env.AI_GATEWAY_API_KEY
    case 'openrouter':
      return !!process.env.OPENROUTER_API_KEY
    case 'ollama':
      return !!process.env.OLLAMA_BASE_URL
    default:
      return false
  }
}

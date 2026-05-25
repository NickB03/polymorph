import { ReadonlyRequestCookies } from 'next/dist/server/web/spec-extension/adapters/request-cookies'

import { getModelForModeAndType } from '@/lib/config/model-types'
import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'
import { isProviderEnabled } from '@/lib/utils/registry'

const DEFAULT_MODEL: Model = {
  id: 'deepseek/deepseek-v4-flash',
  name: 'DeepSeek V4 Flash',
  provider: 'DeepSeek',
  providerId: 'openrouter'
}

const VALID_MODEL_TYPES: ModelType[] = ['speed', 'quality']
const MODE_FALLBACK_ORDER: SearchMode[] = ['chat', 'research']

interface ModelSelectionParams {
  cookieStore: ReadonlyRequestCookies
  searchMode?: SearchMode
}

interface ModelSelectionByModeAndTypeParams {
  searchMode?: SearchMode
  modelType?: ModelType
}

function resolveGatewayFallbackModel(model: Model): Model | undefined {
  if (model.providerId !== 'openrouter' || !isProviderEnabled('gateway')) {
    return undefined
  }

  return { ...model, providerId: 'gateway' }
}

function resolveModelForModeAndType(
  mode: SearchMode,
  type: ModelType
): Model | undefined {
  try {
    const model = getModelForModeAndType(mode, type)
    if (!model) {
      return undefined
    }

    if (!isProviderEnabled(model.providerId)) {
      const gatewayFallback = resolveGatewayFallbackModel(model)
      if (gatewayFallback) {
        console.warn(
          `[ModelSelection] Provider "${model.providerId}" is not enabled for mode "${mode}" and model type "${type}". Falling back to Gateway model "${model.id}".`
        )
        return gatewayFallback
      }

      console.warn(
        `[ModelSelection] Provider "${model.providerId}" is not enabled for mode "${mode}" and model type "${type}"`
      )
      return undefined
    }

    return model
  } catch (error) {
    console.error(
      `[ModelSelection] Failed to load model configuration for mode "${mode}" and type "${type}":`,
      error
    )
    return undefined
  }
}

export function selectModel({
  cookieStore,
  searchMode
}: ModelSelectionParams): Model {
  const modelTypeCookie = cookieStore.get('modelType')?.value as
    | ModelType
    | undefined

  return selectModelForModeAndType({
    searchMode,
    modelType:
      modelTypeCookie && VALID_MODEL_TYPES.includes(modelTypeCookie)
        ? modelTypeCookie
        : undefined
  })
}

export function selectModelForModeAndType({
  searchMode,
  modelType
}: ModelSelectionByModeAndTypeParams): Model {
  const requestedMode =
    searchMode && MODE_FALLBACK_ORDER.includes(searchMode) ? searchMode : 'chat'

  const typePreferenceOrder: ModelType[] = []
  if (modelType && VALID_MODEL_TYPES.includes(modelType)) {
    typePreferenceOrder.push(modelType)
  }

  for (const knownType of VALID_MODEL_TYPES) {
    if (!typePreferenceOrder.includes(knownType)) {
      typePreferenceOrder.push(knownType)
    }
  }

  const modePreferenceOrder: SearchMode[] = Array.from(
    new Set<SearchMode>([requestedMode, ...MODE_FALLBACK_ORDER])
  )

  for (const candidateMode of modePreferenceOrder) {
    for (const candidateType of typePreferenceOrder) {
      const model = resolveModelForModeAndType(candidateMode, candidateType)
      if (model) {
        return model
      }
    }
  }

  const defaultGatewayFallback = resolveGatewayFallbackModel(DEFAULT_MODEL)
  if (defaultGatewayFallback) {
    console.warn(
      `[ModelSelection] Default model provider "${DEFAULT_MODEL.providerId}" is not enabled. Falling back to Gateway model "${DEFAULT_MODEL.id}".`
    )
    return defaultGatewayFallback
  }

  if (!isProviderEnabled(DEFAULT_MODEL.providerId)) {
    console.warn(
      `[ModelSelection] Default model provider "${DEFAULT_MODEL.providerId}" is not enabled. Returning default model configuration.`
    )
  }

  return DEFAULT_MODEL
}

export { DEFAULT_MODEL }

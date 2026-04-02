import { ModelType } from '@/lib/types/model-type'
import { Model } from '@/lib/types/models'
import { SearchMode } from '@/lib/types/search'

import { getModelsConfig } from './load-models-config'

export function getModelForModeAndType(
  mode: SearchMode,
  type: ModelType
): Model | undefined {
  const cfg = getModelsConfig()
  return cfg.models.byMode?.[mode]?.[type]
}

export function getRelatedQuestionsModel(): Model {
  const cfg = getModelsConfig()
  return cfg.models.relatedQuestions
}

export function getTrendingSuggestionsModel(): Model {
  const cfg = getModelsConfig()
  return cfg.models.trendingSuggestions
}

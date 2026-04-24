import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'
import { defaultSettingsMiddleware, wrapLanguageModel } from 'ai'

import { createJudgeConfig } from './judge-config'

export const JUDGE_DEFAULT_SETTINGS = {
  temperature: 0,
  topP: 1
} as const

// `LanguageModel` is `string | LanguageModelV3 | LanguageModelV2`, but
// `wrapLanguageModel` only accepts `LanguageModelV3`. Narrow via `unknown` so
// we don't drag in a transitive `@ai-sdk/provider` import solely for the type.
type WrappableModel = Parameters<typeof wrapLanguageModel>[0]['model']

export function applyJudgeDefaults(model: LanguageModel): LanguageModel {
  return wrapLanguageModel({
    model: model as unknown as WrappableModel,
    middleware: defaultSettingsMiddleware({ settings: JUDGE_DEFAULT_SETTINGS })
  }) as unknown as LanguageModel
}

export function createJudgeModel(): LanguageModel {
  const judgeConfig = createJudgeConfig()
  const provider = createOpenRouter({
    ...(judgeConfig.judgeBaseUrl && { baseURL: judgeConfig.judgeBaseUrl }),
    ...(judgeConfig.judgeApiKey && { apiKey: judgeConfig.judgeApiKey })
  })
  const base = judgeConfig.judgeReasoningEnabled
    ? (provider(judgeConfig.judgeModel, {
        reasoning: {
          enabled: true,
          max_tokens: judgeConfig.judgeReasoningMaxTokens
        }
      }) as unknown as LanguageModel)
    : (provider(judgeConfig.judgeModel) as unknown as LanguageModel)

  return applyJudgeDefaults(base)
}

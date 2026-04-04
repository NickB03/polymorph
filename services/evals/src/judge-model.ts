import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import type { LanguageModel } from 'ai'

import { createJudgeConfig } from './judge-config'

export function createJudgeModel(): LanguageModel {
  const judgeConfig = createJudgeConfig()
  const provider = createOpenRouter({
    ...(judgeConfig.judgeBaseUrl && { baseURL: judgeConfig.judgeBaseUrl }),
    ...(judgeConfig.judgeApiKey && { apiKey: judgeConfig.judgeApiKey })
  })
  if (judgeConfig.judgeReasoningEnabled) {
    return provider(judgeConfig.judgeModel, {
      reasoning: {
        enabled: true,
        max_tokens: judgeConfig.judgeReasoningMaxTokens
      }
    }) as unknown as LanguageModel
  }

  return provider(judgeConfig.judgeModel) as unknown as LanguageModel
}

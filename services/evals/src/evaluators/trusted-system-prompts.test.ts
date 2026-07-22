import type { LanguageModel } from 'ai'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { createFaithfulnessExperimentEvaluator } from './faithfulness'
import { createRelevanceExperimentEvaluator } from './relevance'

function createModel(label: 'faithful' | 'relevant'): LanguageModel {
  return {
    specificationVersion: 'v3',
    modelId: `trusted-system-${label}`,
    provider: 'test',
    supportedUrls: {},
    doGenerate: vi.fn().mockResolvedValue({
      content: [
        {
          type: 'text',
          text: JSON.stringify({ explanation: 'ok', label })
        }
      ],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: []
    }),
    doStream: vi.fn()
  } as unknown as LanguageModel
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('trusted evaluator system prompts', () => {
  it('does not emit AI SDK system-message warnings', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})

    await createFaithfulnessExperimentEvaluator(
      createModel('faithful')
    ).evaluate({
      input: { query: 'question', context: 'retrieved topic' },
      output: 'answer'
    })
    await createRelevanceExperimentEvaluator(createModel('relevant')).evaluate({
      input: { query: 'question', context: 'retrieved topic' },
      output: 'answer'
    })

    expect(warn).not.toHaveBeenCalledWith(
      expect.stringContaining('System messages in the prompt')
    )
  })
})

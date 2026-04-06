import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvaluate = vi.fn()

vi.mock('@arizeai/phoenix-evals', () => ({
  createClassificationEvaluator: () => ({
    evaluate: mockEvaluate
  })
}))

import { createSafetyExperimentEvaluator } from './safety'

describe('safety experiment evaluator', () => {
  const mockModel = {} as LanguageModel

  beforeEach(() => {
    mockEvaluate.mockReset()
  })

  it('has correct name and kind', () => {
    const evaluator = createSafetyExperimentEvaluator(mockModel)
    expect(evaluator.name).toBe('safety')
    expect(evaluator.kind).toBe('LLM')
  })

  it('returns skipped with null score when answer is empty', async () => {
    const evaluator = createSafetyExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test' },
      output: ''
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'No answer to evaluate for safety'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('returns skipped with null score for whitespace-only answer', async () => {
    const evaluator = createSafetyExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test' },
      output: {
        answerText: '   \n\t  ',
        citations: [],
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: false,
        modelId: '',
        durationMs: 0
      }
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'No answer to evaluate for safety'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('delegates to inner evaluator for non-empty answers', async () => {
    mockEvaluate.mockResolvedValue({
      score: 1,
      label: 'safe',
      explanation: 'No safety concerns'
    })
    const evaluator = createSafetyExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'what is the weather?' },
      output: 'The weather is sunny today.'
    })
    expect(mockEvaluate).toHaveBeenCalledWith({
      query: 'what is the weather?',
      answer: 'The weather is sunny today.'
    })
    expect(result).toEqual({
      score: 1,
      label: 'safe',
      explanation: 'No safety concerns'
    })
  })

  it('returns needs_hedging score of 0.5', async () => {
    mockEvaluate.mockResolvedValue({
      score: 0.5,
      label: 'needs_hedging',
      explanation: 'Medical advice should include disclaimer'
    })
    const evaluator = createSafetyExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'should I take aspirin?' },
      output: 'Take two aspirin daily.'
    })
    expect(result).toMatchObject({
      label: 'needs_hedging',
      score: 0.5
    })
  })
})

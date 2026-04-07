import type { LanguageModel } from 'ai'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEvaluate = vi.fn()

vi.mock('@arizeai/phoenix-evals', () => ({
  createDocumentRelevanceEvaluator: () => ({
    evaluate: mockEvaluate
  })
}))

import { createRelevanceExperimentEvaluator } from './relevance'

describe('relevance experiment evaluator', () => {
  const mockModel = {} as LanguageModel

  beforeEach(() => {
    mockEvaluate.mockReset()
  })

  it('has correct name and kind', () => {
    const evaluator = createRelevanceExperimentEvaluator(mockModel)
    expect(evaluator.name).toBe('relevance')
    expect(evaluator.kind).toBe('LLM')
  })

  it('skips when expectsRefusal is true', async () => {
    const evaluator = createRelevanceExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'harmful request', context: '' },
      output: 'I cannot help with that.',
      metadata: { expectsRefusal: true }
    })
    expect(result).toEqual({
      label: 'skipped',
      score: null,
      explanation: 'Refusal case — no search results expected'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('does not skip when expectsRefusal is false', async () => {
    mockEvaluate.mockResolvedValue({
      score: 1,
      label: 'relevant',
      explanation: 'relevant'
    })
    const evaluator = createRelevanceExperimentEvaluator(mockModel)
    await evaluator.evaluate({
      input: { query: 'test', context: 'some context' },
      output: 'answer',
      metadata: { expectsRefusal: false }
    })
    expect(mockEvaluate).toHaveBeenCalled()
  })

  it('skips when context is empty', async () => {
    const evaluator = createRelevanceExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test query', context: '' },
      output: 'some answer'
    })
    expect(result).toEqual({
      label: 'no_results',
      score: 0.0,
      explanation: 'No search results returned'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('skips when context is missing from input', async () => {
    const evaluator = createRelevanceExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'test query' },
      output: 'some answer'
    })
    expect(result).toEqual({
      label: 'no_results',
      score: 0.0,
      explanation: 'No search results returned'
    })
    expect(mockEvaluate).not.toHaveBeenCalled()
  })

  it('maps context to documentText in inner evaluator', async () => {
    mockEvaluate.mockResolvedValue({
      score: 1,
      label: 'relevant',
      explanation: 'directly addresses query'
    })
    const evaluator = createRelevanceExperimentEvaluator(mockModel)
    const result = await evaluator.evaluate({
      input: { query: 'what is AI?', context: 'AI overview article...' },
      output: 'AI is artificial intelligence'
    })
    expect(mockEvaluate).toHaveBeenCalledWith({
      input: 'what is AI?',
      documentText: 'AI overview article...'
    })
    expect(result).toEqual({
      score: 1,
      label: 'relevant',
      explanation: 'directly addresses query'
    })
  })
})

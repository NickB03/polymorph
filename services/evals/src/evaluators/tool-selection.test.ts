import { describe, expect, it, vi } from 'vitest'

import { createToolSelectionExperimentEvaluator } from './tool-selection'

const mockLm = (label: 'correct' | 'wrong' | 'missing' | 'not_required') =>
  vi.fn(async () => ({
    content: [{ type: 'text', text: label }],
    finishReason: 'stop' as const,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: []
  }))

function makeEvaluator(
  label: 'correct' | 'wrong' | 'missing' | 'not_required'
) {
  const stubModel = {
    doGenerate: mockLm(label),
    doStream: vi.fn(),
    specificationVersion: 'v3' as const,
    provider: 'test',
    modelId: 'stub',
    supportedUrls: {}
  } as unknown as import('ai').LanguageModel
  return createToolSelectionExperimentEvaluator(stubModel)
}

const baseInput = {
  query: 'What is the weather in Tokyo today?',
  available_tools: ['webSearch', 'displayFeatureList'],
  tools_called: ['webSearch'],
  model_answer: 'The weather in Tokyo is sunny, 22°C.'
}

describe('tool_selection evaluator', () => {
  it('returns score=1.0 and label=correct when judge says correct', async () => {
    const evaluator = makeEvaluator('correct')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: { toolNames: ['webSearch'], modelAnswer: baseInput.model_answer }
    })
    expect(result.score).toBe(1.0)
    expect(result.label).toBe('correct')
  })

  it('returns score=0.0 and label=wrong when judge says wrong', async () => {
    const evaluator = makeEvaluator('wrong')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: {
        toolNames: ['displayFeatureList'],
        modelAnswer: 'Here are some features.'
      }
    })
    expect(result.score).toBe(0.0)
    expect(result.label).toBe('wrong')
  })

  it('returns score=0.0 and label=missing when judge says missing', async () => {
    const evaluator = makeEvaluator('missing')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: { toolNames: [], modelAnswer: 'It is sunny.' }
    })
    expect(result.score).toBe(0.0)
    expect(result.label).toBe('missing')
  })

  it('returns score=null and label=not_required when no tools were expected', async () => {
    const evaluator = makeEvaluator('not_required')
    const result = await evaluator.evaluate({
      input: { ...baseInput, query: 'Tell me a joke' },
      output: {
        toolNames: [],
        modelAnswer: 'Why did the chicken cross the road?'
      }
    })
    expect(result.score).toBeNull()
    expect(result.label).toBe('not_required')
  })
})

import type { LanguageModel } from 'ai'
import { describe, expect, it, vi } from 'vitest'

import {
  createToolSelectionExperimentEvaluator,
  parseLabel,
  ToolSelectionParseError
} from './tool-selection'

const mockLm = (rawText: string) =>
  vi.fn(async () => ({
    content: [{ type: 'text', text: rawText }],
    finishReason: 'stop' as const,
    usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
    warnings: []
  }))

function makeEvaluator(judgeOutput: string) {
  const stubModel = {
    doGenerate: mockLm(judgeOutput),
    doStream: vi.fn(),
    specificationVersion: 'v3' as const,
    provider: 'test',
    modelId: 'stub',
    supportedUrls: {}
  } as unknown as LanguageModel
  return createToolSelectionExperimentEvaluator(stubModel)
}

// Mocks match the production pipeline shape: EvalDatasetInput exposes
// `availableTools` (camelCase) and EvalRunResult exposes `answerText`.
const baseInput = {
  query: 'What is the weather in Tokyo today?',
  availableTools: ['search', 'displayCallout']
}

const baseAnswer = 'The weather in Tokyo is sunny, 22°C.'

describe('tool_selection evaluator', () => {
  it('exposes name=tool_selection and kind=LLM for orchestration wiring', () => {
    const evaluator = makeEvaluator('correct')
    expect(evaluator.name).toBe('tool_selection')
    expect(evaluator.kind).toBe('LLM')
  })

  it('returns score=1.0 and label=correct when judge says correct', async () => {
    const evaluator = makeEvaluator('correct')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: { toolNames: ['search'], answerText: baseAnswer }
    })
    expect(result.score).toBe(1.0)
    expect(result.label).toBe('correct')
  })

  it('returns score=0.0 and label=wrong when judge says wrong', async () => {
    const evaluator = makeEvaluator('wrong')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: {
        toolNames: ['displayCallout'],
        answerText: 'Here is a callout.'
      }
    })
    expect(result.score).toBe(0.0)
    expect(result.label).toBe('wrong')
  })

  it('returns score=0.0 and label=missing when judge says missing', async () => {
    const evaluator = makeEvaluator('missing')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: { toolNames: [], answerText: 'It is sunny.' }
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
        answerText: 'Why did the chicken cross the road?'
      }
    })
    expect(result.score).toBeNull()
    expect(result.label).toBe('not_required')
  })

  it('classifies "correct — judged appropriate" by first-word match, not substring', async () => {
    const evaluator = makeEvaluator('correct — judged appropriate')
    const result = await evaluator.evaluate({
      input: baseInput,
      output: { toolNames: ['search'], answerText: baseAnswer }
    })
    expect(result.label).toBe('correct')
  })

  it('throws ToolSelectionParseError when the judge returns unrecognized text', async () => {
    const evaluator = makeEvaluator('correctly handled the request')
    await expect(
      evaluator.evaluate({
        input: baseInput,
        output: {
          toolNames: ['search'],
          answerText: baseAnswer
        }
      })
    ).rejects.toBeInstanceOf(ToolSelectionParseError)
  })
})

describe('parseLabel', () => {
  it('accepts each canonical label verbatim', () => {
    expect(parseLabel('correct')).toBe('correct')
    expect(parseLabel('wrong')).toBe('wrong')
    expect(parseLabel('missing')).toBe('missing')
    expect(parseLabel('not_required')).toBe('not_required')
  })

  it('handles "not required" with a space (judge typo path)', () => {
    expect(parseLabel('not required')).toBe('not_required')
  })

  it('rejects ambiguous "not …" outputs that are not "not required"', () => {
    expect(() => parseLabel('not enough context')).toThrow(
      ToolSelectionParseError
    )
    expect(() => parseLabel('not applicable')).toThrow(ToolSelectionParseError)
    expect(() => parseLabel('not sure')).toThrow(ToolSelectionParseError)
  })

  it('normalizes case and whitespace', () => {
    expect(parseLabel('  CORRECT  ')).toBe('correct')
    expect(parseLabel('Wrong.')).toBe('wrong')
  })

  it('does not let "correctly..." silently match correct', () => {
    expect(() => parseLabel('correctly handled it')).toThrow(
      ToolSelectionParseError
    )
  })

  it('throws on empty or garbage input', () => {
    expect(() => parseLabel('')).toThrow(ToolSelectionParseError)
    expect(() => parseLabel('n/a')).toThrow(ToolSelectionParseError)
    expect(() => parseLabel('unclear')).toThrow(ToolSelectionParseError)
  })
})

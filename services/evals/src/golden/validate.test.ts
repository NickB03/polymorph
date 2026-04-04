import { describe, expect, it } from 'vitest'

import { evaluatePrechecks } from '../prechecks'

import { getGoldenExamples } from './index'

describe('prechecks golden validation', () => {
  const examples = getGoldenExamples()

  for (const example of examples) {
    it(`correctly evaluates ${example.id}`, () => {
      const result = evaluatePrechecks(
        {
          answerText: example.answer,
          citations: example.citations,
          searchResults: [],
          toolNames: [],
          usedInteractiveOnlyOutput: example.usedInteractiveOnlyOutput,
          modelId: '',
          durationMs: 0
        },
        {
          requiresTextAnswer: example.requiresTextAnswer,
          requiresCitations: example.requiresCitations,
          allowsInteractiveOnly: example.allowsInteractiveOnly
        }
      )
      expect(result.label).toBe(example.expected.prechecks.label)
      expect(result.score).toBe(example.expected.prechecks.score)
    })
  }
})

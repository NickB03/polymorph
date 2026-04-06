import { describe, expect, it } from 'vitest'

import { createToolUsageExperimentEvaluator } from './tool-usage'

describe('tool-usage evaluator', () => {
  const evaluator = createToolUsageExperimentEvaluator()

  function makeInput(overrides: Record<string, unknown> = {}) {
    return {
      input: {
        prompt: 'What is quantum computing?',
        context: '',
        tags: [],
        searchMode: 'chat',
        ...overrides
      },
      output: {
        answerText: 'Quantum computing uses qubits...',
        citations: [{ url: 'https://example.com', title: 'QC Guide' }],
        searchResults: [
          {
            query: 'quantum computing',
            results: [
              {
                title: 'QC Guide',
                url: 'https://example.com',
                snippet: 'Quantum computing explained'
              }
            ]
          }
        ],
        toolNames: ['search'],
        usedInteractiveOnlyOutput: false,
        modelId: 'test',
        durationMs: 1000
      },
      metadata: {
        caseId: 'test-1',
        suite: 'capability' as const,
        tags: [],
        corpusVersion: 'v4',
        requiresTextAnswer: true,
        requiresCitations: true,
        allowsInteractiveOnly: false
      }
    }
  }

  it('scores 1.0 when search was used and citations required + present', async () => {
    const result = await evaluator.evaluate(makeInput())
    expect(result.score).toBe(1.0)
    expect(result.label).toBe('tools_used')
  })

  it('scores 0.0 when citations required but no tools used', async () => {
    const input = makeInput()
    input.output.toolNames = []
    input.output.searchResults = []
    input.output.citations = []
    const result = await evaluator.evaluate(input)
    expect(result.score).toBe(0.0)
    expect(result.label).toBe('tools_missing')
  })

  it('scores 0.5 when tools used but no search results returned', async () => {
    const input = makeInput()
    input.output.searchResults = []
    const result = await evaluator.evaluate(input)
    expect(result.score).toBe(0.5)
    expect(result.label).toBe('tools_ineffective')
  })

  it('scores 0.5 when citations required but none produced despite search results', async () => {
    const input = makeInput()
    input.output.citations = []
    const result = await evaluator.evaluate(input)
    expect(result.score).toBe(0.5)
    expect(result.label).toBe('citations_missing')
  })

  it('scores 1.0 for non-citation case with tools used', async () => {
    const input = makeInput()
    input.metadata.requiresCitations = false
    input.output.citations = []
    const result = await evaluator.evaluate(input)
    expect(result.score).toBe(1.0)
  })

  it('returns null when case does not require citations and no tools needed', async () => {
    const input = makeInput()
    input.metadata.requiresCitations = false
    input.output.toolNames = []
    input.output.searchResults = []
    input.output.citations = []
    const result = await evaluator.evaluate(input)
    expect(result.score).toBeNull()
    expect(result.label).toBe('skipped')
  })
})

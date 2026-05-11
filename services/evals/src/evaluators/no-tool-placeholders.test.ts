import { describe, expect, it } from 'vitest'

import { createNoToolPlaceholdersExperimentEvaluator } from './no-tool-placeholders'

describe('no-tool-placeholders evaluator', () => {
  const evaluator = createNoToolPlaceholdersExperimentEvaluator()

  function makeInput(answerText: string) {
    return {
      input: {
        prompt: 'irrelevant',
        context: '',
        tags: [],
        searchMode: 'chat'
      },
      output: {
        answerText,
        citations: [],
        searchResults: [],
        toolNames: [],
        usedInteractiveOnlyOutput: false,
        modelId: 'test',
        durationMs: 0
      },
      metadata: {
        caseId: 'test-1',
        suite: 'capability' as const,
        tags: [],
        corpusVersion: 'v4',
        requiresTextAnswer: true,
        requiresCitations: false,
        allowsInteractiveOnly: false
      }
    }
  }

  it('passes when assistant text has no placeholders', async () => {
    const result = await evaluator.evaluate(
      makeInput('Here are the milestones we hit this quarter.')
    )
    expect(result.score).toBe(1)
    expect(result.label).toBe('pass')
  })

  it('passes when answer text is empty', async () => {
    const result = await evaluator.evaluate(makeInput(''))
    expect(result.score).toBe(1)
    expect(result.label).toBe('pass')
  })

  it('fails on fenced-comment placeholder (pattern 1)', async () => {
    const text =
      '## Recent Milestones\n```json\n/* displayTimeline tool call */\n```\n'
    const result = await evaluator.evaluate(makeInput(text))
    expect(result.score).toBe(0)
    expect(result.label).toBe('placeholder_leaked')
    expect(result.explanation).toContain('fenced-comment-placeholder')
    expect(result.explanation).toContain('displayTimeline')
  })

  it('fails on fenced function-call placeholder (pattern 2)', async () => {
    const text =
      'Here are the schools:\n```\ndisplayTable({\n  id: "schools",\n  columns: []\n})\n```\n'
    const result = await evaluator.evaluate(makeInput(text))
    expect(result.score).toBe(0)
    expect(result.label).toBe('placeholder_leaked')
    expect(result.explanation).toContain('fenced-tool-code-function')
    expect(result.explanation).toContain('displayTable')
  })

  it('fails on JSON-comment + function placeholder (pattern 3)', async () => {
    const text =
      '```json\n/* { "tool": "displayChart" } */\ndisplayChart({ id: "x" })\n```\n'
    const result = await evaluator.evaluate(makeInput(text))
    expect(result.score).toBe(0)
    expect(result.label).toBe('placeholder_leaked')
  })

  it('does not fire on legitimate inline mentions of display tools', async () => {
    const text =
      'I can render the data with the `displayTable` tool if you want.'
    const result = await evaluator.evaluate(makeInput(text))
    expect(result.score).toBe(1)
    expect(result.label).toBe('pass')
  })
})

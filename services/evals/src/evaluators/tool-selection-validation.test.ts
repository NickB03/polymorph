import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import { createToolSelectionExperimentEvaluator } from './tool-selection'

interface LabeledFixture {
  case_id: string
  user_query: string
  available_tools: string[]
  tools_called: string[]
  model_answer: string
  human_label: 'correct_tool' | 'wrong_tool' | 'missing_tool' | 'no_tool_needed'
}

const HUMAN_TO_JUDGE_LABEL: Record<LabeledFixture['human_label'], string> = {
  correct_tool: 'correct',
  wrong_tool: 'wrong',
  missing_tool: 'missing',
  no_tool_needed: 'not_required'
}

const FIXTURE_PATH = fileURLToPath(
  new URL('./__fixtures__/tool-selection-labels.json', import.meta.url)
)

const apiKey =
  process.env.AI_GATEWAY_API_KEY ?? process.env.JUDGE_API_KEY ?? undefined

describe.skipIf(!apiKey)(
  'tool_selection validation against human labels',
  () => {
    it('achieves >= 0.80 TPR and >= 0.80 TNR across the labeled set', async () => {
      const raw = await readFile(FIXTURE_PATH, 'utf8')
      const fixtures: LabeledFixture[] = JSON.parse(raw)
      expect(fixtures.length).toBeGreaterThanOrEqual(30)

      const provider = createOpenRouter({
        baseURL: process.env.JUDGE_BASE_URL ?? 'https://openrouter.ai/api/v1',
        apiKey
      })
      const judgeModel = provider('google/gemini-2.0-flash-lite-001')
      const evaluator = createToolSelectionExperimentEvaluator(judgeModel)

      const results = await Promise.all(
        fixtures.map(async fx => {
          const result = await evaluator.evaluate({
            input: {
              query: fx.user_query,
              available_tools: fx.available_tools,
              tools_called: fx.tools_called,
              model_answer: fx.model_answer
            },
            output: { toolNames: fx.tools_called, modelAnswer: fx.model_answer }
          })
          return {
            fixture: fx,
            judgeLabel: result.label,
            expectedLabel: HUMAN_TO_JUDGE_LABEL[fx.human_label]
          }
        })
      )

      const positives = results.filter(r => r.expectedLabel === 'correct')
      const negatives = results.filter(r =>
        ['wrong', 'missing'].includes(r.expectedLabel)
      )

      const tp = positives.filter(r => r.judgeLabel === 'correct').length
      const tn = negatives.filter(r =>
        ['wrong', 'missing'].includes(r.judgeLabel as string)
      ).length

      const tpr = positives.length === 0 ? 1 : tp / positives.length
      const tnr = negatives.length === 0 ? 1 : tn / negatives.length

      const mismatches = results.filter(r => r.judgeLabel !== r.expectedLabel)
      if (mismatches.length > 0) {
        console.warn(
          `[validation] ${mismatches.length}/${results.length} mismatches:`,
          mismatches.map(m => ({
            case: m.fixture.case_id,
            expected: m.expectedLabel,
            got: m.judgeLabel
          }))
        )
      }

      expect(tpr).toBeGreaterThanOrEqual(0.8)
      expect(tnr).toBeGreaterThanOrEqual(0.8)
    }, 120_000)
  }
)

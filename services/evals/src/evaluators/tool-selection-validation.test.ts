import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

import {
  createToolSelectionExperimentEvaluator,
  type ToolSelectionInput
} from './tool-selection'

interface LabeledFixture extends ToolSelectionInput {
  case_id: string
  human_label: 'correct_tool' | 'wrong_tool' | 'missing_tool' | 'no_tool_needed'
  rationale?: string
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
      // Pinned for stable, reproducible measurements — intentionally not the
      // production default (services/evals/src/judge-config.ts may drift).
      const judgeModel = provider('google/gemini-2.0-flash-lite-001')
      const evaluator = createToolSelectionExperimentEvaluator(judgeModel)

      const results = await Promise.all(
        fixtures.map(async fx => {
          // Map the fixture's snake_case (judge-prompt) vocabulary to the
          // pipeline shape the evaluator reads at runtime.
          const result = await evaluator.evaluate({
            input: {
              query: fx.query,
              availableTools: fx.available_tools
            },
            output: { toolNames: fx.tools_called, answerText: fx.model_answer }
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
      const notRequired = results.filter(
        r => r.expectedLabel === 'not_required'
      )

      const tp = positives.filter(r => r.judgeLabel === 'correct').length
      const tn = negatives.filter(r =>
        ['wrong', 'missing'].includes(r.judgeLabel as string)
      ).length
      const tnReq = notRequired.filter(
        r => r.judgeLabel === 'not_required'
      ).length

      const tpr = positives.length === 0 ? 1 : tp / positives.length
      const tnr = negatives.length === 0 ? 1 : tn / negatives.length
      const notRequiredRate =
        notRequired.length === 0 ? 1 : tnReq / notRequired.length

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
      // Lower threshold because the not_required class has only 3 fixtures;
      // 2/3 (0.66) keeps the gate meaningful without making it deterministic-flap.
      expect(notRequiredRate).toBeGreaterThanOrEqual(0.66)
    }, 120_000)
  }
)

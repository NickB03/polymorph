import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'

import { normalizeEvalRunResult } from '../eval-output'

// Mirrors the three patterns in `components/render-message.tsx`
// (`PSEUDO_DISPLAY_TOOL_PLACEHOLDER_PATTERNS`). The client renderer strips
// these from assistant text before display. This evaluator runs against raw
// eval-runner output (pre-sanitization), surfacing the model emission rate
// per cycle so the sanitizer's removal can eventually be data-driven.
const PLACEHOLDER_PATTERNS: { name: string; pattern: RegExp }[] = [
  {
    name: 'fenced-comment-placeholder',
    pattern:
      /```(?:json|javascript|js|typescript|ts|tsx)?\s*\n\s*\/\*\s*(display[A-Za-z]+)\s+tool call\s*\*\/\s*\n```/
  },
  {
    name: 'fenced-tool-code-function',
    pattern:
      /```(?:json|javascript|js|typescript|ts|tsx)?\s*\n\s*(?:\/\*\s*tool_code\s*\*\/\s*\n\s*)?(display[A-Za-z]+)\s*\([\s\S]*?\n```/
  },
  {
    name: 'fenced-json-comment-function',
    pattern:
      /```(?:json|javascript|js|typescript|ts|tsx)?\s*\n\s*\/\*\s*\{[\s\S]*?["']tool["']\s*:\s*["'](display[A-Za-z]+)["'][\s\S]*?\}\s*\*\/\s*\n\s*\1\s*\([\s\S]*?\n```/
  }
]

export function createNoToolPlaceholdersExperimentEvaluator() {
  return asExperimentEvaluator({
    name: 'no_tool_placeholders',
    kind: 'CODE',
    evaluate: async ({ output }: { output: unknown }) => {
      const { answerText } = normalizeEvalRunResult(output)
      if (!answerText) {
        return {
          label: 'pass',
          score: 1,
          explanation: 'No assistant text to scan'
        }
      }

      for (const { name, pattern } of PLACEHOLDER_PATTERNS) {
        const match = pattern.exec(answerText)
        if (match) {
          const toolName = match[1] ?? 'unknown'
          return {
            label: 'placeholder_leaked',
            score: 0,
            explanation: `Pseudo display-tool placeholder leaked into assistant text (pattern=${name}, tool=${toolName})`
          }
        }
      }

      return {
        label: 'pass',
        score: 1,
        explanation: 'No pseudo display-tool placeholders detected'
      }
    }
  })
}

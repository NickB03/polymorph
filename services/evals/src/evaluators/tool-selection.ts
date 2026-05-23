import { asExperimentEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText, type LanguageModel } from 'ai'

const SYSTEM_PROMPT = `You are evaluating whether an assistant picked the right tool for a user's query.

The assistant has access to a known set of tools. For each query you'll see:
- the user's query
- the list of available tool names
- which tools the assistant actually called (may be empty)
- the assistant's final text answer

Judge one thing only: was the tool selection appropriate for this query?

Use exactly one of these four labels:
- "correct" — the assistant called the right tool(s) for the query, OR correctly called no tools when the query needed none
- "wrong" — the assistant called a tool that doesn't fit the query (e.g., a display tool for a factual lookup)
- "missing" — the query required a tool (factual lookup, geo, current data, etc.) but the assistant answered from memory without calling one
- "not_required" — the query was purely conversational AND no tools were called

Do not judge the answer's correctness — only the tool choice. Reply with a single word: the label.`

const USER_PROMPT_TEMPLATE = (input: {
  query: string
  available_tools: string[]
  tools_called: string[]
  model_answer: string
}) => `<query>
${input.query}
</query>

<available_tools>
${input.available_tools.join(', ')}
</available_tools>

<tools_called>
${input.tools_called.length === 0 ? '(none)' : input.tools_called.join(', ')}
</tools_called>

<model_answer>
${input.model_answer}
</model_answer>

Label:`

export type Label = 'correct' | 'wrong' | 'missing' | 'not_required'

function scoreFor(label: Label): number | null {
  if (label === 'correct') return 1.0
  if (label === 'wrong' || label === 'missing') return 0.0
  return null
}

export class ToolSelectionParseError extends Error {
  constructor(text: string) {
    super(
      `tool_selection judge returned an unrecognized label: ${JSON.stringify(text)}`
    )
    this.name = 'ToolSelectionParseError'
  }
}

export function parseLabel(text: string): Label {
  const firstWord = text
    .trim()
    .toLowerCase()
    .split(/[\s,.:;—-]/)[0]
  if (firstWord === 'correct') return 'correct'
  if (firstWord === 'wrong') return 'wrong'
  if (firstWord === 'missing') return 'missing'
  if (firstWord === 'not_required' || firstWord === 'not') return 'not_required'
  throw new ToolSelectionParseError(text)
}

/** Vocabulary the judge prompt expects (snake_case). */
export interface ToolSelectionInput {
  query: string
  available_tools: string[]
  tools_called: string[]
  model_answer: string
}

/** Shape of the per-case output the evaluator receives from the eval pipeline
 * (matches `EvalRunResult` in services/evals/src/types.ts). */
export interface ToolSelectionOutput {
  toolNames: string[]
  answerText: string
}

export function createToolSelectionExperimentEvaluator(model: LanguageModel) {
  return asExperimentEvaluator({
    name: 'tool_selection',
    kind: 'LLM',
    evaluate: async ({
      input,
      output
    }: {
      input: Record<string, unknown>
      output: unknown
    }) => {
      // Pipeline shape: EvalDatasetInput exposes `availableTools` (camelCase),
      // EvalRunResult exposes `answerText` (camelCase). The judge prompt below
      // uses snake_case `available_tools` / `model_answer` because that's the
      // vocabulary the prompt template encodes.
      const typedInput = input as unknown as {
        query: string
        availableTools: string[]
      }
      const typedOutput = output as unknown as ToolSelectionOutput

      const judgeInput: ToolSelectionInput = {
        query: typedInput.query,
        available_tools: typedInput.availableTools,
        tools_called: typedOutput.toolNames,
        model_answer: typedOutput.answerText
      }

      const { text } = await generateText({
        model,
        system: SYSTEM_PROMPT,
        prompt: USER_PROMPT_TEMPLATE(judgeInput)
      })

      const label = parseLabel(text)
      const score = scoreFor(label)

      return {
        label,
        score,
        explanation:
          label === 'correct'
            ? `Tools called: ${judgeInput.tools_called.join(', ') || '(none)'} — judged appropriate`
            : label === 'wrong'
              ? `Tools called: ${judgeInput.tools_called.join(', ')} — judged inappropriate for the query`
              : label === 'missing'
                ? 'Query required a tool but none was called'
                : 'Conversational query; no tool needed'
      }
    }
  })
}

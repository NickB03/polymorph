# Tool-Selection Evaluator Implementation Plan

> **Status:** Completed historical plan with one operational caveat: the evaluator and dashboard labels are implemented, but judge validation against live/human-labeled production calls should be tracked in an active runbook if it is still required.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `tool_selection` LLM-judge evaluator that scores whether the model chose the _right_ tool for a user query — complementing the existing deterministic `tool_usage` which only checks whether _any_ search tool was called and produced results.

**Architecture:** Drop one new file into `services/evals/src/evaluators/` following the existing `relevance.ts` LLM-judge pattern (uses `asExperimentEvaluator` + Vercel AI SDK + a Phoenix-compatible prompt template). Wire it into `runners/shared.ts`'s evaluator factory map alongside `toolUsage`, `faithfulness`, `relevance`, `safety`, `responseQuality`, `citationAccuracy`. Validate the judge against ≥30 human-labeled tool calls before deploying — per phoenix-evals' "validate judges to ≥80% TPR/TNR" principle. The evaluator runs against the model's _replayed_ tool calls (same pipeline limitation as everything else — non-replayable Canvas/image chats remain out of scope; see Open Questions).

**Tech Stack:** TypeScript (strict), `@arizeai/phoenix-client`, `@arizeai/phoenix-evals`, Vercel AI SDK (`ai-sdk/openai` or `ai-sdk/anthropic` via gateway), vitest, the project's `bun` task runner. The `services/evals/` package is an independent bun workspace — run commands from inside that directory.

---

## File Structure

| Path                                                               | Role                                                                                                   | Created or modified  |
| ------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | -------------------- |
| `services/evals/src/evaluators/tool-selection.ts`                  | New LLM-judge evaluator: judges whether the chosen tool matches the user's intent                      | Created              |
| `services/evals/src/evaluators/tool-selection.test.ts`             | Unit tests with mocked LM responses for the rubric paths                                               | Created              |
| `services/evals/src/evaluators/tool-selection-validation.test.ts`  | Validation harness: runs the judge against a labeled fixture set and asserts TPR/TNR ≥ 0.80            | Created              |
| `services/evals/src/runners/shared.ts:27-32, 117-120`              | Add `createToolSelectionExperimentEvaluator` to the import block + the evaluator factory map           | Modified             |
| `services/evals/src/runners/shared.test.ts`                        | Add the new evaluator to the existing vi.mock block                                                    | Modified             |
| `services/evals/src/runners/traffic-monitor.ts:7-9`                | Same import addition (traffic-monitor wires its own evaluator subset)                                  | Modified             |
| `services/evals/src/runners/traffic-monitor.test.ts`               | Same mock addition                                                                                     | Modified             |
| `lib/evals/evaluator-labels.ts`                                    | Add `tool_selection` to `EVALUATOR_DISPLAY_ORDER` and `EVALUATOR_LABELS` for admin dashboard rendering | Modified             |
| `components/evals/dashboard-v2/local-labels.ts`                    | Add the user-facing local label override if the canonical label is too long                            | Modified (if needed) |
| `docs/architecture/MODEL-CONFIGURATION.md` or similar              | Note the new evaluator in the suite roster                                                             | Modified             |
| `lib/evals/glossary/index.ts` (or wherever judge definitions live) | Add a glossary entry for `tool_selection` so the dashboard tooltip explains it                         | Modified             |

**Notes on responsibility boundaries:**

- The evaluator file is single-responsibility: one prompt template + one factory function. No utility logic.
- Validation lives in its own `*-validation.test.ts` file so it can be skipped from the default vitest run if it's slow or burns API credits.
- The orchestrator wiring is intentionally tiny — match the existing per-evaluator import-and-register pattern; don't refactor the factory map.

---

## Pre-Plan Reading

Before starting, the implementer should skim (open these tabs, don't deep-read):

- `services/evals/src/evaluators/relevance.ts` — the closest analog for an LLM-judge evaluator that takes structured XML input
- `services/evals/src/evaluators/tool-usage.ts` — the existing deterministic tool evaluator; understand how it differs
- `services/evals/src/runners/shared.ts:100-180` — the evaluator factory map and how suites pick which evaluators to include
- `services/evals/src/sampler.ts:530-550` — confirms that `toolNames` is captured per chat (and that Canvas/image tools are filtered out at sample time)
- `lib/evals/evaluator-labels.ts` — the display-order array the dashboard reads
- This plan's "Open Questions" section at the end

---

## Task 1: Error analysis — discover the tool-selection failure taxonomy

**Files:** None modified — discovery only. Produce a short markdown note in `docs/evals/tool-selection-failure-modes.md`.

**Why first:** Phoenix-evals' first principle is "error analysis first — can't automate what you haven't observed." Before writing a prompt that judges tool selection, look at what bad selections actually look like in this codebase. The taxonomy directly shapes the prompt's rubric.

- [ ] **Step 1: Pull recent eval-case rows with tool calls from Postgres**

```bash
cd /Users/nick/Projects/vana-v2
# Requires DATABASE_URL or local Supabase running on port 44322
psql "$DATABASE_URL" -c "
  SELECT ecr.case_id,
         ecr.evaluator_name,
         ecr.failed,
         ecr.failure_mode,
         ecr.explanation,
         es.experiment_name
  FROM eval_case_results ecr
  JOIN eval_summaries es ON es.id = ecr.eval_summary_id
  WHERE ecr.evaluator_name = 'tool_usage'
    AND ecr.created_at > NOW() - INTERVAL '30 days'
  ORDER BY ecr.created_at DESC
  LIMIT 50;
"
```

Expected: 0–50 rows. If 0 rows (because the cron is idle per the May 19 conversation), use Phoenix traces instead — see Step 2.

- [ ] **Step 2: Pull recent tool-call spans from Phoenix**

Use the Phoenix MCP if available, or the Phoenix UI. Query:

- Project: `polymorph-traffic-monitor` (or `polymorph-capability` if traffic-monitor is empty)
- Span kind: `TOOL` or `LLM` spans with `tool_calls` attribute
- Time range: last 30 days
- Limit: 50

For each span, capture:

- The user query (parent span's input)
- The list of tool names called
- Whether the model's final output answered the query

- [ ] **Step 3: Hand-categorize 20–30 cases into failure modes**

Open the rows from Step 1+2 and tag each:

- `correct_tool` — model called an appropriate tool for the query
- `wrong_tool` — model called a tool that doesn't fit the query (e.g., `displayFeatureList` for "what's the weather?")
- `missing_tool` — model answered from memory but should have called a tool
- `redundant_tool` — model called the same tool repeatedly with similar args
- `no_tool_needed` — query was conversational; model correctly used no tools

Stop categorizing once you have 5+ examples of `wrong_tool` (the target failure mode) OR you've reviewed 30 cases — whichever is first.

- [ ] **Step 4: Write the failure-mode note**

Create `docs/evals/tool-selection-failure-modes.md` with:

- A short table: failure mode → count → 2 concrete examples (query + chosen tool + why it's wrong)
- A "judging rubric" section: 3–5 sentences describing what the LLM judge should look for, derived from the categorized examples
- The list of tools the model has access to (pull from the tool registry in `lib/agents/chat/`)

This note becomes the source-of-truth for the prompt in Task 3.

- [ ] **Step 5: Commit the discovery note**

```bash
git add docs/evals/tool-selection-failure-modes.md
git commit -m "$(cat <<'EOF'
docs(evals): tool-selection failure taxonomy from error analysis

Documents the 4 observed failure modes for tool selection in the
existing eval corpus, the rubric the new LLM judge should encode, and
the current model tool roster. Source-of-truth for the prompt template
implemented in the tool-selection evaluator.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Build a labeled validation fixture set

**Files:**

- Create: `services/evals/src/evaluators/__fixtures__/tool-selection-labels.json`

**Why:** Per phoenix-evals' "Validate judges to ≥80% TPR/TNR" principle, you cannot deploy an LLM judge without ground truth. Hand-label 30 chats so Task 4 can measure accuracy.

- [ ] **Step 1: Pick 30 chats from the dataset**

From the error analysis in Task 1, select 30 cases. Aim for distribution:

- 12 `correct_tool` (positive class)
- 12 `wrong_tool` (negative class)
- 3 `missing_tool`
- 3 `no_tool_needed`

Avoid Canvas/image chats (they're excluded by the sampler — see `services/evals/src/sampler.ts:16-21`).

- [ ] **Step 2: Write the fixture file**

Create `services/evals/src/evaluators/__fixtures__/tool-selection-labels.json`:

```json
[
  {
    "case_id": "<chat or experiment-run id>",
    "user_query": "<the user's question>",
    "available_tools": [
      "webSearch",
      "advancedSearch",
      "displayFeatureList",
      "displayGeoMap"
    ],
    "tools_called": ["webSearch"],
    "tool_call_args": [
      { "name": "webSearch", "args": { "query": "weather in Tokyo" } }
    ],
    "model_answer": "<the assistant's final text answer>",
    "human_label": "correct_tool",
    "rationale": "Weather is a factual lookup; webSearch is the right primitive."
  }
]
```

Required fields: `case_id`, `user_query`, `available_tools`, `tools_called`, `human_label` (one of: `correct_tool`, `wrong_tool`, `missing_tool`, `no_tool_needed`).
Optional but recommended: `tool_call_args`, `model_answer`, `rationale`.

Aim for ~30 entries. Cite real `case_id`s from the existing eval corpus so the fixtures can be regenerated.

- [ ] **Step 3: Commit the fixture set**

```bash
git add services/evals/src/evaluators/__fixtures__/tool-selection-labels.json
git commit -m "$(cat <<'EOF'
test(evals): add human-labeled fixture set for tool-selection judge

30 hand-labeled cases drawn from the existing eval corpus, balanced
across correct_tool / wrong_tool / missing_tool / no_tool_needed.
Ground-truth for the validation harness in the next commit.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Implement the `tool-selection` evaluator (TDD)

**Files:**

- Create: `services/evals/src/evaluators/tool-selection.ts`
- Create: `services/evals/src/evaluators/tool-selection.test.ts`

- [ ] **Step 1: Write the failing test**

Create `services/evals/src/evaluators/tool-selection.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest'

import { createToolSelectionExperimentEvaluator } from './tool-selection'

const mockLm = (label: 'correct' | 'wrong' | 'missing' | 'not_required') =>
  vi.fn(async () => ({
    text: label,
    finishReason: 'stop' as const,
    usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 }
  }))

function makeEvaluator(
  label: 'correct' | 'wrong' | 'missing' | 'not_required'
) {
  // Pass a stubbed Vercel AI SDK model object — only .doGenerate matters here
  const stubModel = {
    doGenerate: mockLm(label),
    specificationVersion: 'v1',
    provider: 'test',
    modelId: 'stub',
    defaultObjectGenerationMode: undefined
  } as never
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd services/evals
bun run test -- src/evaluators/tool-selection.test.ts
```

Expected: FAIL with `Cannot find module './tool-selection'`.

- [ ] **Step 3: Implement the evaluator**

Create `services/evals/src/evaluators/tool-selection.ts`:

```ts
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

type Label = 'correct' | 'wrong' | 'missing' | 'not_required'

function scoreFor(label: Label): number | null {
  if (label === 'correct') return 1.0
  if (label === 'wrong' || label === 'missing') return 0.0
  return null
}

function parseLabel(text: string): Label {
  const normalized = text.trim().toLowerCase()
  if (normalized.startsWith('correct')) return 'correct'
  if (normalized.startsWith('wrong')) return 'wrong'
  if (normalized.startsWith('missing')) return 'missing'
  return 'not_required'
}

interface ToolSelectionInput {
  query: string
  available_tools: string[]
  tools_called: string[]
  model_answer: string
}

interface ToolSelectionOutput {
  toolNames: string[]
  modelAnswer: string
}

export function createToolSelectionExperimentEvaluator(model: LanguageModel) {
  return asExperimentEvaluator({
    name: 'tool_selection',
    kind: 'LLM',
    evaluate: async ({
      input,
      output
    }: {
      input: ToolSelectionInput
      output: ToolSelectionOutput
    }) => {
      const judgeInput: ToolSelectionInput = {
        query: input.query,
        available_tools: input.available_tools,
        tools_called: output.toolNames,
        model_answer: output.modelAnswer
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
```

- [ ] **Step 4: Run test to verify it passes**

```bash
cd services/evals
bun run test -- src/evaluators/tool-selection.test.ts
```

Expected: 4/4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add services/evals/src/evaluators/tool-selection.ts services/evals/src/evaluators/tool-selection.test.ts
git commit -m "$(cat <<'EOF'
feat(evals): add tool_selection LLM-judge evaluator

Complements the deterministic tool_usage evaluator by judging whether
the assistant chose the right tool for the user's query, not just
whether any tool was called. 4-label rubric: correct (1.0), wrong (0.0),
missing (0.0), not_required (null). Follows the existing
asExperimentEvaluator + Vercel AI SDK pattern used by relevance.ts.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Validate the judge against human labels (TPR/TNR ≥ 0.80)

**Files:**

- Create: `services/evals/src/evaluators/tool-selection-validation.test.ts`

**Why:** Phoenix-evals: "Validate judges — >80% TPR/TNR." Without this, the new evaluator's scores are unverified.

- [ ] **Step 1: Write the validation harness**

Create `services/evals/src/evaluators/tool-selection-validation.test.ts`:

```ts
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

import { openai } from '@ai-sdk/openai'
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

// Map fixture labels (4-class human taxonomy) to the judge's 4-class output
const HUMAN_TO_JUDGE_LABEL: Record<LabeledFixture['human_label'], string> = {
  correct_tool: 'correct',
  wrong_tool: 'wrong',
  missing_tool: 'missing',
  no_tool_needed: 'not_required'
}

const FIXTURE_PATH = fileURLToPath(
  new URL('./__fixtures__/tool-selection-labels.json', import.meta.url)
)

// Use a real judge model. Requires AI_GATEWAY_API_KEY or OPENAI_API_KEY in env.
const JUDGE_MODEL = openai('gpt-4o-mini')

describe.skipIf(!process.env.AI_GATEWAY_API_KEY && !process.env.OPENAI_API_KEY)(
  'tool_selection validation against human labels',
  () => {
    it('achieves >= 0.80 TPR and >= 0.80 TNR across the labeled set', async () => {
      const raw = await readFile(FIXTURE_PATH, 'utf8')
      const fixtures: LabeledFixture[] = JSON.parse(raw)
      expect(fixtures.length).toBeGreaterThanOrEqual(30)

      const evaluator = createToolSelectionExperimentEvaluator(JUDGE_MODEL)

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

      // Surface mismatches in the test output for prompt iteration
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
    }, 120_000) // 2-minute timeout — 30 LLM calls
  }
)
```

- [ ] **Step 2: Run the validation**

```bash
cd services/evals
AI_GATEWAY_API_KEY=$AI_GATEWAY_API_KEY bun run test -- src/evaluators/tool-selection-validation.test.ts
```

Expected outcomes:

- PASS if TPR ≥ 0.80 AND TNR ≥ 0.80 → proceed to Task 5
- FAIL with mismatch list → iterate the prompt in Task 3's `SYSTEM_PROMPT`, commit prompt change, re-run validation. Common fixes: tighten the "wrong" definition, add a 1-sentence example of each label in the system prompt, switch judge model from `gpt-4o-mini` to `gpt-4o` if the smaller model is over-permissive.

- [ ] **Step 3: Commit the validation harness**

```bash
git add services/evals/src/evaluators/tool-selection-validation.test.ts
git commit -m "$(cat <<'EOF'
test(evals): validate tool_selection judge against 30 human-labeled cases

Runs the judge against the fixture set and asserts TPR/TNR >= 0.80 per
phoenix-evals' deploy-readiness threshold. Skipped by default when
AI_GATEWAY_API_KEY / OPENAI_API_KEY is not in env. Mismatches are
printed for prompt iteration.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wire the evaluator into the shared runner and traffic-monitor

**Files:**

- Modify: `services/evals/src/runners/shared.ts`
- Modify: `services/evals/src/runners/shared.test.ts`
- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify: `services/evals/src/runners/traffic-monitor.test.ts`

- [ ] **Step 1: Add the import and factory entry to `shared.ts`**

Open `services/evals/src/runners/shared.ts`. Add the import near the others (around line 27-32):

```ts
import { createToolSelectionExperimentEvaluator } from '../evaluators/tool-selection'
```

In the factory map (around lines 117-120), add:

```ts
toolSelection: createToolSelectionExperimentEvaluator,
```

- [ ] **Step 2: Add the mock to `shared.test.ts`**

Open `services/evals/src/runners/shared.test.ts`. Find the existing `vi.mock` block for evaluators. Add:

```ts
createToolSelectionExperimentEvaluator: vi.fn(() => ({
  name: 'tool_selection',
  kind: 'LLM',
  evaluate: vi.fn()
}))
```

- [ ] **Step 3: Same wiring for `traffic-monitor.ts` and its test**

Open `services/evals/src/runners/traffic-monitor.ts` and add the import + register it in the same evaluator-list pattern other evaluators use (mirror `createRelevanceExperimentEvaluator`'s placement at lines 7-9 and its register call).

Then open `services/evals/src/runners/traffic-monitor.test.ts` and add the same mock as Step 2.

- [ ] **Step 4: Run the runner test suites**

```bash
cd services/evals
bun run test -- src/runners/shared.test.ts src/runners/traffic-monitor.test.ts
```

Expected: all existing tests PASS, no new failures.

- [ ] **Step 5: Commit**

```bash
git add services/evals/src/runners/shared.ts services/evals/src/runners/shared.test.ts \
        services/evals/src/runners/traffic-monitor.ts services/evals/src/runners/traffic-monitor.test.ts
git commit -m "$(cat <<'EOF'
feat(evals): wire tool_selection evaluator into capability + traffic-monitor suites

Adds the new evaluator to runners/shared.ts's factory map and registers
it in traffic-monitor.ts alongside the existing LLM judges. No suite
threshold changes — initial deploy gathers a baseline before any gating
adjustments.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Update dashboard display labels + glossary

**Files:**

- Modify: `lib/evals/evaluator-labels.ts`
- Modify: `components/evals/dashboard-v2/local-labels.ts`
- Modify: `lib/evals/glossary/index.ts` (or wherever judge definitions live — `grep -rn "tool_usage" lib/evals/glossary/` to find)

- [ ] **Step 1: Add to `EVALUATOR_DISPLAY_ORDER`**

Open `lib/evals/evaluator-labels.ts`. Find the `EVALUATOR_DISPLAY_ORDER` array. Add `'tool_selection'` adjacent to `'tool_usage'` (the related evaluator):

```ts
export const EVALUATOR_DISPLAY_ORDER = [
  'faithfulness',
  'relevance',
  'response_quality',
  'safety',
  'citation_accuracy',
  'deterministic_prechecks',
  'tool_usage',
  'tool_selection' // new
] as const
```

- [ ] **Step 2: Add the human-readable label**

In the same file, find the labels map (e.g., `EVALUATOR_LABELS`) and add:

```ts
tool_selection: 'Tool Selection',
```

- [ ] **Step 3: Add the local-labels override if needed**

Open `components/evals/dashboard-v2/local-labels.ts`. If the file remaps any evaluator names for display (e.g., shortening `deterministic_prechecks` → `prechecks`), add a similar entry for `tool_selection` if a shorter display label fits better — e.g., `'tool_selection': 'Tool choice'`. Skip this step if the canonical label is already short enough (≤16 chars).

- [ ] **Step 4: Add the glossary entry**

Find the glossary file via `grep -rn "tool_usage" lib/evals/glossary/`. Add an entry for `tool_selection` mirroring the structure (title, short description, rubric). Use language drawn from your `docs/evals/tool-selection-failure-modes.md`.

- [ ] **Step 5: Run the dashboard tests**

```bash
cd /Users/nick/Projects/vana-v2  # back to project root, not services/evals
bun run test -- components/evals lib/evals
```

Expected: all PASS. If `evaluator-breakdown.test.tsx` snapshots include the evaluator list, they may need updates — that's expected; the new evaluator should now appear in the breakdown UI.

- [ ] **Step 6: Commit**

```bash
git add lib/evals/evaluator-labels.ts components/evals/dashboard-v2/local-labels.ts lib/evals/glossary/
git commit -m "$(cat <<'EOF'
feat(evals): surface tool_selection in admin dashboard

Adds the new evaluator to EVALUATOR_DISPLAY_ORDER, the label map, the
local-label override, and the glossary so it renders alongside the
existing per-judge breakdown rows. No threshold gating yet — baseline
the score before deciding what 'failing' means.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Deploy and verify the first end-to-end run

**Files:** None modified — operational verification only.

- [ ] **Step 1: Trigger a one-off capability suite run**

If you have local Postgres + Phoenix running:

```bash
cd services/evals
RUN_MODE=capability bun run src/index.ts
```

Otherwise trigger via Railway dashboard: `polymorph-evals` service → Deployments → ⋯ → Redeploy. This rebuilds AND runs the cron CMD once.

- [ ] **Step 2: Verify the run reached Phoenix**

Use the Phoenix MCP (`mcp__phoenix__list-experiments-for-dataset` with `dataset_id` for the most recent capability dataset) or the Phoenix UI. The most recent experiment should show `successful_run_count > 0`.

Click into the experiment → click any run → confirm the `tool_selection` annotation is attached to the run with a `label` and `score`.

- [ ] **Step 3: Verify the row reached Postgres**

```bash
psql "$DATABASE_URL" -c "
  SELECT evaluator_name, COUNT(*), AVG(score)
  FROM eval_case_results
  WHERE evaluator_name = 'tool_selection'
    AND created_at > NOW() - INTERVAL '1 hour'
  GROUP BY evaluator_name;
"
```

Expected: 1 row with `count > 0`. If 0 rows, check Railway logs for `PHOENIX UNAVAILABLE` or `DB WRITE FAILED` markers (see `.claude/rules/operations.md`).

- [ ] **Step 4: Verify the admin dashboard renders the new evaluator**

Open `/admin/evals` on the latest preview deployment. In the EvaluatorBreakdown panel, you should see a `Tool Selection` row with a bar reflecting the score from Step 3. Hover should show the glossary entry from Task 6 Step 4.

- [ ] **Step 5: No commit — this task is verification only.**

If everything passes, the evaluator is live. If anything fails, return to the task that's responsible and iterate.

---

## Self-Review

**Spec coverage:**

- "Add tool call evals" → Tasks 3-7 build, validate, wire, and deploy ONE new tool-call evaluator that complements the existing `tool_usage`. Task 1's error analysis ensures the evaluator targets a real failure pattern, not a hypothetical one.
- The plan deliberately scopes to ONE new evaluator (`tool_selection`) rather than batching 3-4 mediocre ones. If more are needed later, this plan establishes the pattern; subsequent evaluators are copy-paste with a different rubric.

**Placeholder scan:** Each step has either a complete command, complete code, or a concrete categorization rule. The only intentional discovery is Task 1 (error analysis) where the OUTPUT — not the procedure — is what the implementer produces.

**Type consistency:**

- `Label` type is `'correct' | 'wrong' | 'missing' | 'not_required'` in Task 3; the validation harness in Task 4 uses the same set.
- The fixture's `human_label` taxonomy is `correct_tool | wrong_tool | missing_tool | no_tool_needed`, mapped to judge labels via `HUMAN_TO_JUDGE_LABEL` in Task 4.
- `EVALUATOR_DISPLAY_ORDER` registration in Task 6 matches the evaluator name `'tool_selection'` used in Task 3's `asExperimentEvaluator({ name: 'tool_selection', ... })`.

**Known risks:**

- `services/evals/` is an independent bun workspace (per CLAUDE.md memory). The implementer MUST `cd services/evals` before running tests for that package. Task 3 Step 2 and Task 4 Step 2 call this out, but it's easy to forget.
- The validation harness in Task 4 burns ~30 LLM calls per run (~$0.05 with `gpt-4o-mini`, ~$1 with `gpt-4o`). The `describe.skipIf` guard keeps it from running in normal CI without an API key.
- The plan inherits the Canvas-exclusion limitation from the sampler — `tool_selection` will only score chats whose tool list doesn't include Canvas/image tools. See Open Questions.

---

## Open Questions

These are NOT in scope for this plan, but the implementer should surface them at handoff:

1. **Canvas/image tool exclusion.** The sampler at `services/evals/src/sampler.ts:539-550` throws `SamplerParseError` for any chat using `createCanvasArtifact`, `updateCanvasArtifact`, `readCanvasArtifact`, `generateImage`. This means `tool_selection` will never see chats that use those tools — and Canvas is a headline product feature. A separate plan should consider either (a) stubbing those tools at replay time, or (b) building a Canvas-specific evaluator that doesn't require replay.

2. **Threshold and gating.** This plan does NOT set a `tool_selection` failure threshold. Baseline the score over 1-2 weeks, then decide what fraction of `wrong` / `missing` labels per suite should mark the suite as `BLOCKED`. Updates to `services/evals/src/runners/shared.ts` would handle gating.

3. **Multi-tool / sequence judgment.** This evaluator scores ONE chat as a single judgment ("was the tool selection right?"). It doesn't separately score each tool call in a multi-step chat. If sequence/orchestration becomes a failure mode in Task 1's error analysis, a follow-up evaluator (`tool_sequence`) is warranted.

4. **Judge model choice.** Task 4 defaults to `gpt-4o-mini`. If TPR/TNR is below 0.80 after 2-3 prompt iterations, the next move is upgrading the judge model — `gpt-4o` or `claude-sonnet-4-5`. Larger model = better recall, higher cost. Capture the decision in `docs/evals/tool-selection-failure-modes.md`.

---

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-05-20-tool-selection-evaluator.md`. Two execution options:**

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration. Best fit because Task 1 (error analysis) and Task 2 (fixture labeling) are open-ended discovery tasks that benefit from independent attention; Tasks 3-6 are mechanical TDD with clear acceptance criteria.

**2. Inline Execution** — Execute tasks in this session using `executing-plans`, batch execution with checkpoints for review.

**Which approach?**

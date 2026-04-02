# PR #88 Review Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Address all CodeRabbit review findings on PR #88 (evals service robustness, design token completeness, DRY refactor) to unblock merge.

**Architecture:** All changes are localized fixes within two areas: the `services/evals/` pipeline (robustness and safety) and one component design-token gap. No new packages, no schema changes, no API surface changes.

**Tech Stack:** TypeScript, Vitest, Bun

---

## File Structure

| File                                                | Action | Responsibility                                        |
| --------------------------------------------------- | ------ | ----------------------------------------------------- |
| `services/evals/src/index.ts`                       | Modify | Guarantee `closeDb()` runs on all exit paths          |
| `services/evals/src/config.ts`                      | Modify | Validate `parseInt` results for `NaN`                 |
| `services/evals/src/retry.ts`                       | Modify | Guard against `maxAttempts <= 0`                      |
| `services/evals/src/retry.test.ts`                  | Modify | Add test for zero-attempt edge case                   |
| `services/evals/src/sampler.ts`                     | Modify | Wrap `JSON.parse(citations)` in try/catch             |
| `services/evals/src/evaluators/extract-verdict.ts`  | Create | Shared `extractVerdict` + `toStringOrEmpty` utilities |
| `services/evals/src/evaluators/faithfulness.ts`     | Modify | Use shared utilities, remove local `extractVerdict`   |
| `services/evals/src/evaluators/relevance.ts`        | Modify | Use shared utilities, remove local `extractVerdict`   |
| `services/evals/src/evaluators/response-quality.ts` | Modify | Use shared utilities, remove local `extractVerdict`   |
| `components/tool-ui/plan/plan.tsx`                  | Modify | Replace hardcoded emerald RGBA with `var(--success)`  |

---

### Task 1: Guarantee DB Cleanup in Evals Entrypoint

**Files:**

- Modify: `services/evals/src/index.ts:114-117`

**Why:** The current `.catch()` handler calls `process.exit(1)` without calling `closeDb()` first, leaking the Postgres connection. The happy path calls `closeDb()` but the fatal error path bypasses it.

- [x] **Step 1: Rewrite the entrypoint to use try/finally**

In `services/evals/src/index.ts`, find the bottom of the file (lines 114-117):

```typescript
main().catch(err => {
  console.error('[evals] Fatal error:', err)
  process.exit(1)
})
```

Replace with:

```typescript
main().catch(async err => {
  console.error('[evals] Fatal error:', err)
  await closeDb().catch(() => {})
  process.exit(1)
})
```

- [x] **Step 2: Remove the `closeDb()` + `process.exit(0)` from inside `main()`**

In `services/evals/src/index.ts`, find lines 84-87 inside `main()`:

```typescript
// Step 5: Clean exit
await closeDb()
console.log('[evals] Done.')
process.exit(0)
```

Replace with:

```typescript
// Step 5: Clean exit
await closeDb()
console.log('[evals] Done.')
```

And also remove the early-exit `closeDb()` at lines 34-35:

```typescript
console.log('[evals] No chats found in lookback window. Exiting.')
await closeDb()
process.exit(0)
```

Replace with:

```typescript
console.log('[evals] No chats found in lookback window. Exiting.')
await closeDb()
return
```

This way `main()` always returns normally (no `process.exit` inside it), and `closeDb()` is called on both the happy path and the error path.

- [x] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [x] **Step 4: Commit**

```bash
git add services/evals/src/index.ts
git commit -m "fix(evals): guarantee closeDb runs on fatal errors"
```

---

### Task 2: Harden Config Parsing and Retry Guard

**Files:**

- Modify: `services/evals/src/config.ts:23-24`
- Modify: `services/evals/src/retry.ts:13-15`
- Modify: `services/evals/src/retry.test.ts`

**Why:** `parseInt` returns `NaN` if the env var is non-numeric (e.g. `SAMPLE_SIZE=abc`), which silently corrupts the sampling query. The retry utility throws `undefined` if `maxAttempts` is 0 or negative because the loop body never executes and `lastError` is never assigned.

- [x] **Step 1: Add NaN guard to config.ts**

In `services/evals/src/config.ts`, find lines 23-24:

```typescript
  sampleSize: parseInt(process.env.SAMPLE_SIZE ?? '50', 10),
  lookbackHours: parseInt(process.env.LOOKBACK_HOURS ?? '6', 10),
```

Replace with:

```typescript
  sampleSize: validInt(process.env.SAMPLE_SIZE, 50),
  lookbackHours: validInt(process.env.LOOKBACK_HOURS, 6),
```

Then add the helper above the `config` export (after line 10):

```typescript
function validInt(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback
  const n = parseInt(raw, 10)
  return Number.isNaN(n) ? fallback : n
}
```

- [x] **Step 2: Add maxAttempts guard to retry.ts**

In `services/evals/src/retry.ts`, find line 13:

```typescript
let lastError: unknown
```

Add before it:

```typescript
if (opts.maxAttempts < 1) {
  throw new Error('withRetry requires maxAttempts >= 1')
}
```

- [x] **Step 3: Add test for zero-attempts edge case**

In `services/evals/src/retry.test.ts`, add after the last `it()` block (before the closing `})`):

```typescript
it('throws if maxAttempts is 0', async () => {
  const fn = vi.fn().mockResolvedValue('ok')
  await expect(
    withRetry(fn, { maxAttempts: 0, baseDelayMs: 10 })
  ).rejects.toThrow('maxAttempts >= 1')
  expect(fn).not.toHaveBeenCalled()
})
```

- [x] **Step 4: Run tests**

Run: `bun run test -- services/evals/src/retry.test.ts`
Expected: PASS (4 tests — including the new edge case)

- [x] **Step 5: Commit**

```bash
git add services/evals/src/config.ts services/evals/src/retry.ts services/evals/src/retry.test.ts
git commit -m "fix(evals): guard parseInt NaN in config, reject maxAttempts < 1 in retry"
```

---

### Task 3: Safe Citations Parsing in Sampler

**Files:**

- Modify: `services/evals/src/sampler.ts:120`

**Why:** `JSON.parse(row.citations)` on line 120 is unguarded — if the DB returns malformed JSON, the entire sampling step crashes. The adjacent `parseSearchResults` function already has a try/catch; citations should follow the same pattern.

- [x] **Step 1: Wrap citations parsing in try/catch**

In `services/evals/src/sampler.ts`, find line 120:

```typescript
citations: row.citations ? JSON.parse(row.citations) : []
```

Replace with:

```typescript
citations: parseCitations(row.citations)
```

Then add the helper after the `parseSearchResults` function (after line 142):

```typescript
function parseCitations(raw: string | null): ChatSample['citations'] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(Boolean).map((c: any) => ({
      url: c?.url ?? '',
      title: c?.title ?? ''
    }))
  } catch {
    return []
  }
}
```

- [x] **Step 2: Commit**

```bash
git add services/evals/src/sampler.ts
git commit -m "fix(evals): guard JSON.parse on citations to match search_results pattern"
```

---

### Task 4: DRY Evaluator Utilities (extractVerdict + Safe Casts)

**Files:**

- Create: `services/evals/src/evaluators/extract-verdict.ts`
- Modify: `services/evals/src/evaluators/faithfulness.ts:19-21, 69-79`
- Modify: `services/evals/src/evaluators/relevance.ts:18-19, 73-83`
- Modify: `services/evals/src/evaluators/response-quality.ts:19-21, 71-81`

**Why:** All three evaluators duplicate an identical `extractVerdict` function (10 lines each, character-for-character). They also use unsafe `output as string` casts — if the output is an object, `as string` silently passes a non-string to the LLM prompt. Extract both into a shared module.

- [x] **Step 1: Create shared evaluator utilities**

Create `services/evals/src/evaluators/extract-verdict.ts`:

```typescript
/**
 * Extract a verdict keyword from LLM judge output.
 * Looks first after </thinking> tags, then falls back to full text.
 */
export function extractVerdict(text: string, options: string[]): string {
  const lower = text.toLowerCase()
  const afterThinking = lower.split('</thinking>').pop() ?? lower
  for (const option of options) {
    if (afterThinking.includes(option)) return option
  }
  for (const option of options) {
    if (lower.includes(option)) return option
  }
  return 'unknown'
}

/**
 * Safely coerce an evaluator input/output to string.
 * Returns empty string for nullish values, calls String() on non-strings.
 */
export function asString(value: unknown): string {
  if (value == null) return ''
  return typeof value === 'string' ? value : String(value)
}
```

- [x] **Step 2: Update faithfulness.ts — use shared utilities, remove local copy**

Replace the entire contents of `services/evals/src/evaluators/faithfulness.ts` with:

```typescript
import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'
import { asString, extractVerdict } from './extract-verdict'

/**
 * Faithfulness evaluator — checks whether the model's answer
 * is grounded in the search results (retrieved context).
 *
 * Uses an LLM judge to classify each response as faithful or unfaithful.
 * A response is "faithful" if every factual claim is supported by
 * the provided search context.
 */
export const faithfulnessEvaluator = asEvaluator({
  name: 'faithfulness',
  kind: 'LLM',
  evaluate: async ({ input, output }) => {
    const query = asString(input.query)
    const context = asString(input.context)
    const answer = asString(output)

    if (!context || !answer) {
      return {
        score: null,
        label: 'skipped',
        metadata: {},
        explanation: 'Missing context or answer'
      }
    }

    const { text } = await generateText({
      model: openai(config.judgeModel),
      prompt: `You are an evaluator assessing whether an AI assistant's answer is faithful to the provided search context.

<question>${query}</question>

<search_context>
${context}
</search_context>

<answer>${answer}</answer>

Evaluate faithfulness:
- "faithful": Every factual claim in the answer is supported by the search context
- "unfaithful": The answer contains claims not supported by or contradicting the search context
- "partial": Some claims are supported, but others are not

First, briefly explain your reasoning in <thinking> tags.
Then give your verdict as exactly one of: faithful, partial, unfaithful

<thinking>`,
      maxOutputTokens: 500
    })

    const verdict = extractVerdict(text, ['faithful', 'partial', 'unfaithful'])
    const score =
      verdict === 'faithful' ? 1.0 : verdict === 'partial' ? 0.5 : 0.0

    return {
      score,
      label: verdict,
      metadata: {},
      explanation: text.split('</thinking>')[0]?.trim() ?? null
    }
  }
})
```

- [x] **Step 3: Update relevance.ts — use shared utilities, remove local copy**

Replace the entire contents of `services/evals/src/evaluators/relevance.ts` with:

```typescript
import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'
import { asString, extractVerdict } from './extract-verdict'

/**
 * Search relevance evaluator — checks whether the search results
 * retrieved for a query are actually relevant to answering it.
 *
 * This evaluates the retrieval quality, not the generation quality.
 * Poor retrieval is the most common root cause of bad answers.
 */
export const relevanceEvaluator = asEvaluator({
  name: 'search_relevance',
  kind: 'LLM',
  evaluate: async ({ input }) => {
    const query = asString(input.query)
    const context = asString(input.context)

    if (!context) {
      return {
        score: 0.0,
        label: 'no_results',
        metadata: {},
        explanation: 'No search results returned'
      }
    }

    const { text } = await generateText({
      model: openai(config.judgeModel),
      prompt: `You are an evaluator assessing whether search results are relevant to a user's query.

<query>${query}</query>

<search_results>
${context}
</search_results>

Rate the relevance of these search results to the query:
- "highly_relevant": Results directly address the query with useful, on-topic information
- "partially_relevant": Some results are useful but others are off-topic or tangential
- "not_relevant": Results do not meaningfully help answer the query

First, briefly explain your reasoning in <thinking> tags.
Then give your verdict as exactly one of: highly_relevant, partially_relevant, not_relevant

<thinking>`,
      maxOutputTokens: 400
    })

    const verdict = extractVerdict(text, [
      'highly_relevant',
      'partially_relevant',
      'not_relevant'
    ])
    const score =
      verdict === 'highly_relevant'
        ? 1.0
        : verdict === 'partially_relevant'
          ? 0.5
          : 0.0

    return {
      score,
      label: verdict,
      metadata: {},
      explanation: text.split('</thinking>')[0]?.trim() ?? null
    }
  }
})
```

- [x] **Step 4: Update response-quality.ts — use shared utilities, remove local copy**

Replace the entire contents of `services/evals/src/evaluators/response-quality.ts` with:

```typescript
import { openai } from '@ai-sdk/openai'
import { asEvaluator } from '@arizeai/phoenix-client/experiments'
import { generateText } from 'ai'

import { config } from '../config'
import { asString, extractVerdict } from './extract-verdict'

/**
 * Response quality evaluator — overall assessment of whether
 * the assistant's answer is helpful, complete, and well-structured.
 *
 * This is a higher-level eval than faithfulness — it checks not just
 * whether claims are grounded, but whether the response actually
 * answers the user's question in a useful way.
 */
export const responseQualityEvaluator = asEvaluator({
  name: 'response_quality',
  kind: 'LLM',
  evaluate: async ({ input, output }) => {
    const query = asString(input.query)
    const context = asString(input.context)
    const answer = asString(output)

    if (!answer) {
      return {
        score: 0.0,
        label: 'no_answer',
        metadata: {},
        explanation: 'No answer generated'
      }
    }

    const { text } = await generateText({
      model: openai(config.judgeModel),
      prompt: `You are an evaluator assessing the overall quality of an AI research assistant's response.

<question>${query}</question>

${context ? `<search_context>\n${context}\n</search_context>\n` : ''}
<answer>${answer}</answer>

Rate the response quality on these criteria:
1. Does it directly answer the user's question?
2. Is it well-organized and easy to read?
3. Does it provide sufficient depth without unnecessary padding?
4. Does it use the available context effectively?

Give a rating:
- "excellent": Comprehensive, well-structured, directly answers the question
- "good": Adequately answers the question with minor issues
- "poor": Fails to answer the question, is confusing, or has significant issues

First, briefly explain your reasoning in <thinking> tags.
Then give your verdict as exactly one of: excellent, good, poor

<thinking>`,
      maxOutputTokens: 400
    })

    const verdict = extractVerdict(text, ['excellent', 'good', 'poor'])
    const score = verdict === 'excellent' ? 1.0 : verdict === 'good' ? 0.7 : 0.0

    return {
      score,
      label: verdict,
      metadata: {},
      explanation: text.split('</thinking>')[0]?.trim() ?? null
    }
  }
})
```

- [x] **Step 5: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [x] **Step 6: Commit**

```bash
git add services/evals/src/evaluators/
git commit -m "refactor(evals): extract shared extractVerdict + asString, fix unsafe casts"
```

---

### Task 5: Fix Design Token Gap in Progress Tracker Glow

**Files:**

- Modify: `components/tool-ui/plan/plan.tsx:274-276`

**Why:** Line 262 correctly uses `bg-success` (design token), but the celebration glow on line 275 still uses hardcoded `rgba(16, 185, 129, 0.6)` (emerald-500). If the success color changes via tokens, the glow drifts.

- [x] **Step 1: Replace hardcoded RGBA with token-based color**

In `components/tool-ui/plan/plan.tsx`, find lines 274-276:

```typescript
          style={{
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)'
          }}
```

Replace with:

```typescript
          style={{
            boxShadow:
              '0 0 20px color-mix(in oklch, var(--success) 60%, transparent)'
          }}
```

- [x] **Step 2: Run typecheck and lint**

Run: `bun typecheck && bun lint`
Expected: No errors

- [x] **Step 3: Commit**

```bash
git add components/tool-ui/plan/plan.tsx
git commit -m "fix: use success token in progress tracker glow instead of hardcoded emerald"
```

---

## Verification Checklist

After all tasks are complete:

- [x] `bun typecheck` — no errors
- [x] `bun lint` — no errors
- [x] `bun run test` — all tests pass (including new retry edge case)
- [x] No duplicate `extractVerdict` functions remain in `services/evals/src/evaluators/`
- [x] `closeDb()` is called on all exit paths in evals `index.ts`

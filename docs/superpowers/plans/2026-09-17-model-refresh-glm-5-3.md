# Model Refresh: DeepSeek V4 → GLM-5.3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move the text-model tiers from DeepSeek V4 Flash 0423 / V4 Pro 0423 to GLM-5.3-Flash (speed + background) and GLM-5.3 (quality), fixing the two latent config bugs found along the way.

**Architecture:** All text models are served through OpenRouter and selected from `config/models/{default,cloud}.json`; three hardcoded fallbacks and one lookup table mirror those ids in code. The swap is config + four one-line code edits + docs. No new providers, dependencies, or abstractions.

**Tech Stack:** Next.js 16, AI SDK 7 (`ToolLoopAgent`), `@openrouter/ai-sdk-provider` 3.0.0, Vitest.

**Spec:** Research & decision record is the section below (§Research and decision). Executors read it first.

## Global Constraints

- Provider stays `openrouter` for every text model. Do not add API keys or providers.
- `services/evals/` judge model (`google/gemini-3.1-flash-lite-preview`) is **out of scope** — changing it invalidates regression baselines (memory: `feedback_eval_judge_immutable`).
- Image model `gateway:google/gemini-2.5-flash-image` is out of scope for this plan (see Follow-ups).
- Prettier: no semicolons, single quotes, no trailing commas, 2-space indent.
- `bun lint`, `bun typecheck`, `bun run test` must pass before any task is marked done.
- Every commit: `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## Research and decision (2026-09-17)

### What we run today

| Slot                                                         | Model id (OpenRouter)                   | Version  | $/M in | $/M out | AA Index v4.3          | Notes                                   |
| ------------------------------------------------------------ | --------------------------------------- | -------- | ------ | ------- | ---------------------- | --------------------------------------- |
| chat/research **speed**                                      | `deepseek/deepseek-v4-flash`            | **0423** | 0.089  | 0.18    | not listed (0731 = 35) | text-only, reasoning effort `low`       |
| chat/research **quality**                                    | `deepseek/deepseek-v4-pro`              | **0423** | 1.60   | 3.20    | not listed (0813 = 36) | text-only, effort `medium`              |
| relatedQuestions, trendingSuggestions                        | `deepseek/deepseek-v4-flash`            | 0423     | 0.089  | 0.18    | —                      | `reasoning.exclude: true`               |
| hardcoded `DEFAULT_MODEL` (`lib/utils/model-selection.ts:9`) | `deepseek/deepseek-v4-flash`            | 0423     |        |         |                        | fallback when config fails              |
| search summarizer default (`lib/tools/search/server.ts:372`) | `openrouter:deepseek/deepseek-v4-flash` | 0423     |        |         |                        | only used by the bare `search()` helper |
| title generator                                              | inherits chat model                     |          |        |         |                        | `create-chat-stream-response.ts:286`    |
| evals judge (Railway)                                        | `google/gemini-3.1-flash-lite-preview`  | preview  | 0.25   | 1.50    |                        | out of scope                            |
| image generation                                             | `gateway:google/gemini-2.5-flash-image` |          | 0.30   | 2.50    |                        | out of scope                            |

Both slugs we pin resolve to the **April 2026** snapshots. DeepSeek has since shipped V4 Flash 0731, V4 Pro 0813, and V4.1 Flash (2026-09-10). Artificial Analysis lists 0731 as deprecated.

Production volume (Phoenix `polymorph-prod`, 2026-09-03 → 09-17, aggregate only): 819 traces, 94K prompt tokens, 2.3K completion tokens. That is roughly **$0.02/month** at current prices. Cost is not a constraint today; per-token ratios only matter for scale, so the decision is driven by quality, latency, and operational fit.

### Candidates (OpenRouter list price, `/api/v1/models`, 2026-09-17)

| Model                            | $/M in   | $/M out  | Blended 10:1 | AA Index  | t/s | Ctx  | Inputs           | Providers     | Thinking                             |
| -------------------------------- | -------- | -------- | ------------ | --------- | --- | ---- | ---------------- | ------------- | ------------------------------------ |
| DeepSeek V4 Flash 0423 (current) | 0.089    | 0.18     | 0.10         | ~30s      | 207 | 1M   | text             | 15            | toggleable                           |
| DeepSeek V4 Flash 0731           | 0.06     | 0.12     | 0.07         | 35        | 207 | 1.3M | text             | 28            | toggleable, deprecated by AA         |
| DeepSeek V4.1 Flash              | 0.30     | 1.20     | 0.38         | 40        | 207 | 1M   | text+image       | 20            | toggleable, 1 week old, very verbose |
| **GLM-5.3-Flash**                | **0.09** | **0.30** | **0.11**     | **42**    | 107 | 1.3M | text+image+video | 29 incl. Z.AI | forced, effort low/high/max          |
| Qwen3.8 Flash                    | 0.15     | 0.47     | 0.18         | 40        | 51  | 1M   | text+image+video | 1 (Alibaba)   | toggleable                           |
| Gemini 3.8 Flash                 | 0.75     | 3.75     | 1.02         | 41 (high) | 293 | 1M   | all              | Google        | levels; 15 s TTFT at high            |
| DeepSeek V4 Pro 0423 (current)   | 1.60     | 3.20     | 1.75         | —         | 80  | 1M   | text             |               |                                      |
| DeepSeek V4 Pro 0813             | 1.32     | 3.96     | 1.56         | 36        | 80  | 1M   | text             | 22            |                                      |
| **GLM-5.3**                      | **1.40** | **4.40** | **1.67**     | **45**    | 63  | 1.3M | text             | 34 incl. Z.AI | forced, effort low/high/max          |
| Qwen3.8 Max 0902                 | 2.00     | 6.00     | 2.36         | 45        | —   | 1M   | text+image+video |               |                                      |
| Kimi K3                          | 2.10     | 10.95    | 2.90         | 44        | 36  | 1M   | text+image+video |               |                                      |

Blended = (10 × input + output) / 11, matching an input-heavy tool loop.

### Decision

- **Speed tier → `z-ai/glm-5.3-flash`, effort `low`.** Highest independent score in the flash class (42 vs 35 for the newest DeepSeek Flash) at the same input price we pay now and $0.30 output. Adds image input, which the app already accepts as uploads. 29 hosts including Z.AI first-party, so OpenRouter fallback stays healthy. Official numbers: Terminal-Bench 2.1 84.3, DeepSWE 63.4, HLE (tools) 55.3. Trade-off: ~2× slower per token than DeepSeek (107 vs 207 t/s).
- **Quality tier → `z-ai/glm-5.3`, effort `high`.** Top-scoring open-weight model (45) at a wash on price versus our current V4 Pro 0423 (1.67 vs 1.75 blended). Same vendor as the speed tier, so one set of provider quirks. Trade-off: 63 t/s and ~3 s time-to-first-token; text-only (same as today's quality tier).
- **Background slots → `z-ai/glm-5.3-flash`, effort `low`, `exclude: true`.** GLM-5.3 thinking cannot be disabled (Z.ai docs), so keep the reasoning hidden and at the lowest budget. Single vendor beats a second model for a ~$0.0001/call difference.
- **Rejected — Gemini 3.8 Flash.** ~10× the blended cost of GLM-5.3-Flash for a lower index score, prices double on 2027-01-01 ($1.50/$7.50), 15 s TTFT at high effort, and Gemini 3 via OpenRouter requires replaying thought signatures on every tool-call turn, which our reasoning-strip path deliberately does not do (documented breakages in Roo Code, LobeHub, Cherry Studio). Google itself says to stay on 3.7 Flash for efficiency-first workloads.
- **Rejected — DeepSeek V4.1 Flash.** Better than what we run, but 3.5× the blended cost of GLM-5.3-Flash for 2 fewer index points, only a week old, and the most verbose model in the class (250M output tokens on the index vs 180M).
- **Rejected — Kimi K3 / Qwen3.8 Max.** Same tier as GLM-5.3 at 1.4–1.7× the cost; K3 is also the slowest (36 t/s).
- **Rejected — Qwen3.8 Flash.** Comparable score to V4.1 Flash, but a single host (Alibaba) and 51 t/s.

### Two latent bugs this plan also fixes

1. **`reasoning.exclude: true` does not skip reasoning cost.** OpenRouter docs: "The model will still use reasoning, but it won't be returned in the response. The tokens are still billed." PR #234 added it to the background slots believing it disabled thinking. For GLM (forced thinking) the correct lever is `effort: 'low'` plus `exclude`. Task 1 sets both and rewrites the test comment so the intent is accurate.
2. **Unknown model ids silently get a 16K context window.** `lib/utils/context-window.ts:47` defaults `DEFAULT_CONTEXT_WINDOW = 16384` for any id not in `MODEL_CONTEXT_WINDOWS`. Swapping the config without Task 3 would truncate every conversation to ~13K tokens. This is the highest-risk step of the swap.

### Behaviour notes for the executor

- OpenRouter's reasoning `effort` for Z.ai maps to Z.ai's `reasoning_effort`, which accepts `low`, `high`, `max` (default `max`). Do **not** use `medium` for GLM.
- Z.ai wants thinking blocks preserved _within_ a tool loop. The AI SDK does this inside a single `ToolLoopAgent` run: the OpenRouter provider (`dist/index.js:3169-3207`) reconstructs `reasoning_details` from prior steps. Across user turns we strip reasoning (Task 4), exactly as we do for DeepSeek, which avoids replaying stale signatures and keeps prompt size down.
- GLM-5.3-Flash and GLM-5.3 both support `tools`, `response_format`, and `structured_outputs` on OpenRouter, which `Output.array` in `generate-related-questions.ts` relies on. The `:free` variants do not; never pin those.

---

### Task 1: Swap the model config

**Files:**

- Modify: `config/models/default.json` (whole file)
- Modify: `config/models/cloud.json` (whole file, identical content)
- Test: `lib/config/__tests__/load-models-config.test.ts`

**Interfaces:**

- Produces: config entries with `id: 'z-ai/glm-5.3-flash'` and `id: 'z-ai/glm-5.3'`, `providerId: 'openrouter'`. Later tasks assume these exact ids.

- [ ] **Step 1: Update the config test to the new expectations**

Replace the contents of `lib/config/__tests__/load-models-config.test.ts` with:

```ts
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadModelsConfigSync } from '../load-models-config'

// Both default and cloud profiles must enable OpenRouter reasoning streaming
// for interactive chat/research tiers. GLM-5.3 thinking cannot be disabled,
// so background calls pin the lowest effort and hide the reasoning output
// (`exclude` hides it; it does not skip the cost — effort: low does that).
describe('loadModelsConfig — GLM-5.3 reasoning provider options', () => {
  const originalCloud = process.env.POLYMORPH_CLOUD_DEPLOYMENT
  const originalVana = process.env.VANA_CLOUD_DEPLOYMENT

  afterEach(() => {
    if (originalCloud === undefined) {
      delete process.env.POLYMORPH_CLOUD_DEPLOYMENT
    } else {
      process.env.POLYMORPH_CLOUD_DEPLOYMENT = originalCloud
    }
    if (originalVana === undefined) {
      delete process.env.VANA_CLOUD_DEPLOYMENT
    } else {
      process.env.VANA_CLOUD_DEPLOYMENT = originalVana
    }
  })

  describe.each([
    ['default profile', undefined],
    ['cloud profile', 'true']
  ] as const)('%s', (_label, cloudEnv) => {
    beforeEach(() => {
      if (cloudEnv) {
        process.env.POLYMORPH_CLOUD_DEPLOYMENT = cloudEnv
      } else {
        delete process.env.POLYMORPH_CLOUD_DEPLOYMENT
      }
      delete process.env.VANA_CLOUD_DEPLOYMENT
    })

    it('uses GLM-5.3-Flash with effort: low for the speed tier', () => {
      const config = loadModelsConfigSync()
      for (const mode of ['chat', 'research'] as const) {
        const model = config.models.byMode[mode].speed
        expect(model.id).toBe('z-ai/glm-5.3-flash')
        expect(model.providerId).toBe('openrouter')
        expect((model as any).providerOptions?.openrouter?.reasoning).toEqual({
          enabled: true,
          effort: 'low'
        })
      }
    })

    it('uses GLM-5.3 with effort: high for the quality tier', () => {
      const config = loadModelsConfigSync()
      for (const mode of ['chat', 'research'] as const) {
        const model = config.models.byMode[mode].quality
        expect(model.id).toBe('z-ai/glm-5.3')
        expect(model.providerId).toBe('openrouter')
        expect((model as any).providerOptions?.openrouter?.reasoning).toEqual({
          enabled: true,
          effort: 'high'
        })
      }
    })

    it('pins background calls to GLM-5.3-Flash at low effort with hidden reasoning', () => {
      const config = loadModelsConfigSync()
      for (const key of ['relatedQuestions', 'trendingSuggestions'] as const) {
        const model = config.models[key]
        expect(model.id).toBe('z-ai/glm-5.3-flash')
        expect((model as any).providerOptions?.openrouter?.reasoning).toEqual({
          effort: 'low',
          exclude: true
        })
      }
    })
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- lib/config/__tests__/load-models-config.test.ts`
Expected: FAIL — `expected 'deepseek/deepseek-v4-flash' to be 'z-ai/glm-5.3-flash'`

- [ ] **Step 3: Write the new config**

Replace the contents of **both** `config/models/default.json` and `config/models/cloud.json` with:

```json
{
  "version": 1,
  "models": {
    "byMode": {
      "chat": {
        "speed": {
          "id": "z-ai/glm-5.3-flash",
          "name": "GLM-5.3 Flash",
          "provider": "Z.ai",
          "providerId": "openrouter",
          "providerOptions": {
            "openrouter": {
              "reasoning": { "enabled": true, "effort": "low" }
            }
          }
        },
        "quality": {
          "id": "z-ai/glm-5.3",
          "name": "GLM-5.3",
          "provider": "Z.ai",
          "providerId": "openrouter",
          "providerOptions": {
            "openrouter": {
              "reasoning": { "enabled": true, "effort": "high" }
            }
          }
        }
      },
      "research": {
        "speed": {
          "id": "z-ai/glm-5.3-flash",
          "name": "GLM-5.3 Flash",
          "provider": "Z.ai",
          "providerId": "openrouter",
          "providerOptions": {
            "openrouter": {
              "reasoning": { "enabled": true, "effort": "low" }
            }
          }
        },
        "quality": {
          "id": "z-ai/glm-5.3",
          "name": "GLM-5.3",
          "provider": "Z.ai",
          "providerId": "openrouter",
          "providerOptions": {
            "openrouter": {
              "reasoning": { "enabled": true, "effort": "high" }
            }
          }
        }
      }
    },
    "relatedQuestions": {
      "id": "z-ai/glm-5.3-flash",
      "name": "GLM-5.3 Flash",
      "provider": "Z.ai",
      "providerId": "openrouter",
      "providerOptions": {
        "openrouter": {
          "reasoning": { "effort": "low", "exclude": true }
        }
      }
    },
    "trendingSuggestions": {
      "id": "z-ai/glm-5.3-flash",
      "name": "GLM-5.3 Flash",
      "provider": "Z.ai",
      "providerId": "openrouter",
      "providerOptions": {
        "openrouter": {
          "reasoning": { "effort": "low", "exclude": true }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- lib/config/__tests__/load-models-config.test.ts`
Expected: PASS (6 tests)

- [ ] **Step 5: Confirm the two profiles are byte-identical**

Run: `diff config/models/default.json config/models/cloud.json && echo SAME`
Expected: `SAME`

- [ ] **Step 6: Commit**

```bash
git add config/models/default.json config/models/cloud.json lib/config/__tests__/load-models-config.test.ts
git commit -m "feat(models): move speed/quality tiers to GLM-5.3-Flash / GLM-5.3

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Update the two hardcoded fallbacks

**Files:**

- Modify: `lib/utils/model-selection.ts:9-14`
- Modify: `lib/tools/search/server.ts:372-374`
- Modify: `lib/utils/registry.ts:69` (error-message example only)
- Test: `lib/utils/__tests__/model-selection.test.ts:140-185`

**Interfaces:**

- Produces: `DEFAULT_MODEL.id === 'z-ai/glm-5.3-flash'` (exported from `lib/utils/model-selection.ts`).

- [ ] **Step 1: Update the model-selection test fixtures**

In `lib/utils/__tests__/model-selection.test.ts`, replace every expected-model object that currently reads

```ts
      id: 'deepseek/deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      provider: 'DeepSeek',
```

with

```ts
      id: 'z-ai/glm-5.3-flash',
      name: 'GLM-5.3 Flash',
      provider: 'Z.ai',
```

and every

```ts
      id: 'deepseek/deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      provider: 'DeepSeek',
```

with

```ts
      id: 'z-ai/glm-5.3',
      name: 'GLM-5.3',
      provider: 'Z.ai',
```

(Four occurrences at approximately lines 142, 157, 166, 181. Leave `providerId: 'openrouter'` and any `providerOptions` assertions as they are, except that the quality-tier `effort` becomes `'high'` if asserted.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- lib/utils/__tests__/model-selection.test.ts`
Expected: FAIL on the default-model assertions.

- [ ] **Step 3: Change `DEFAULT_MODEL`**

In `lib/utils/model-selection.ts` replace lines 9–14 with:

```ts
const DEFAULT_MODEL: Model = {
  id: 'z-ai/glm-5.3-flash',
  name: 'GLM-5.3 Flash',
  provider: 'Z.ai',
  providerId: 'openrouter'
}
```

- [ ] **Step 4: Change the search-tool default and the registry error example**

In `lib/tools/search/server.ts` replace lines 372–374 with:

```ts
export const searchTool = createSearchTool('openrouter:z-ai/glm-5.3-flash')
```

In `lib/utils/registry.ts` line 69 change the example inside the error string from `openrouter:deepseek/deepseek-v4-flash` to `openrouter:z-ai/glm-5.3-flash`.

- [ ] **Step 5: Run the affected tests**

Run: `bun run test -- lib/utils/__tests__/model-selection.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/tools/__tests__/search-telemetry.test.ts`
Expected: PASS. If a search test asserts the literal default id, update that literal to `openrouter:z-ai/glm-5.3-flash`.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/model-selection.ts lib/tools/search/server.ts lib/utils/registry.ts lib/utils/__tests__/model-selection.test.ts lib/tools/__tests__
git commit -m "feat(models): point hardcoded fallbacks at GLM-5.3-Flash

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: Register GLM context windows (prevents silent 16K truncation)

**Files:**

- Modify: `lib/utils/context-window.ts:12-45` and `:60-82`
- Test: `lib/utils/__tests__/context-window.test.ts`

**Interfaces:**

- Produces: `getMaxAllowedTokens({ id: 'z-ai/glm-5.3-flash', ... })` returns `1048576 - 131072 - 104857 = 812647`.

- [ ] **Step 1: Write the failing test**

Append inside the existing top-level `describe` in `lib/utils/__tests__/context-window.test.ts`:

```ts
test('resolves GLM-5.3 ids to a 1M context window', () => {
  for (const id of ['z-ai/glm-5.3-flash', 'z-ai/glm-5.3']) {
    const max = getMaxAllowedTokens({
      id,
      name: 'GLM',
      provider: 'Z.ai',
      providerId: 'openrouter'
    })
    // 1,048,576 context − 131,072 output − 10% safety buffer
    expect(max).toBe(1048576 - 131072 - Math.floor(1048576 * 0.1))
  }
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- lib/utils/__tests__/context-window.test.ts`
Expected: FAIL — received `10650` (the 16K default minus output and buffer), not `812647`.

- [ ] **Step 3: Add the table entries**

In `lib/utils/context-window.ts`, inside `MODEL_CONTEXT_WINDOWS` after the DeepSeek block, add:

```ts
  // Z.ai Models (OpenRouter lists 1,310,720 but most hosts serve 1,048,576;
  // use the conservative figure)
  'glm-5.3-flash': { contextWindow: 1048576, outputTokens: 131072 },
  'glm-5.3': { contextWindow: 1048576, outputTokens: 131072 },
```

Inside `MODEL_TO_ENCODING` after the DeepSeek entries, add:

```ts
  'glm-5.3-flash': 'cl100k_base',
  'glm-5.3': 'cl100k_base',
```

Keep the existing DeepSeek rows; other tests use them for the prefix-stripping case.

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- lib/utils/__tests__/context-window.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/utils/context-window.ts lib/utils/__tests__/context-window.test.ts
git commit -m "fix(context-window): register GLM-5.3 context limits

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: Extend the cross-turn reasoning strip to Z.ai models

**Files:**

- Modify: `lib/streaming/helpers/strip-reasoning-parts.ts:13-17`
- Test: `lib/streaming/helpers/__tests__/strip-reasoning-parts.test.ts:78-85`

**Interfaces:**

- Produces: `needsReasoningStrip('openrouter:z-ai/glm-5.3-flash') === true`.

- [ ] **Step 1: Extend the existing test**

In `lib/streaming/helpers/__tests__/strip-reasoning-parts.test.ts`, inside the test at line 78 (`strips for OpenAI and DeepSeek-via-OpenRouter models`), add after the DeepSeek assertion:

```ts
expect(needsReasoningStrip('openrouter:z-ai/glm-5.3-flash')).toBe(true)
expect(needsReasoningStrip('openrouter:z-ai/glm-5.3')).toBe(true)
```

Rename the test title to `'strips for OpenAI, DeepSeek and Z.ai via OpenRouter'`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `bun run test -- lib/streaming/helpers/__tests__/strip-reasoning-parts.test.ts`
Expected: FAIL — `expected false to be true`

- [ ] **Step 3: Implement**

Replace lines 13–17 of `lib/streaming/helpers/strip-reasoning-parts.ts` with:

```ts
export function needsReasoningStrip(modelId: string): boolean {
  return (
    modelId.startsWith('openai:') ||
    modelId.startsWith('openrouter:deepseek/') ||
    modelId.startsWith('openrouter:z-ai/')
  )
}
```

and extend the doc comment above it with one bullet:

```ts
 * - Z.ai GLM (via OpenRouter) returns `reasoning_details` per step. The SDK
 *   replays them within a tool loop (required); across user turns they are
 *   stale, inflate the prompt, and trigger missing-signature warnings.
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `bun run test -- lib/streaming/helpers/__tests__/strip-reasoning-parts.test.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add lib/streaming/helpers/strip-reasoning-parts.ts lib/streaming/helpers/__tests__/strip-reasoning-parts.test.ts
git commit -m "fix(streaming): strip prior-turn reasoning for Z.ai models

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: Update documentation

**Files:**

- Modify: `docs/architecture/DECISIONS.md:27`
- Modify: `docs/architecture/MODEL-SELECTION.md:36,48,52,54,66-71,77-79`
- Modify: `docs/architecture/OVERVIEW-MODELS-STATE.md:29,70-74`
- Modify: `docs/architecture/RESEARCH-AGENT-MODELS-CONTEXT.md:25,42-45,61,100`
- Modify: `docs/architecture/RESEARCH-AGENT-STREAMING-AUXILIARY.md:92`
- Modify: `docs/architecture/AI-PROVIDER-REGISTRY.md` (the "Using OpenRouter or Gateway Providers" JSON example)
- Modify: `README.md:40,95`
- Modify: `docs/getting-started/QUICKSTART.md:107`

Do **not** touch `AGENTS.md` lines 127–128: those are the graphify CLI's own model flags, unrelated to the app.

- [ ] **Step 1: Apply the replacements**

Run from the repo root (macOS `sed`):

```bash
sed -i '' -e 's#`deepseek/deepseek-v4-flash`#`z-ai/glm-5.3-flash`#g' -e 's#`deepseek/deepseek-v4-pro`#`z-ai/glm-5.3`#g' -e 's#openrouter:deepseek/deepseek-v4-flash#openrouter:z-ai/glm-5.3-flash#g' -e 's#DeepSeek V4 Flash/Pro#GLM-5.3 Flash/GLM-5.3#g' -e 's#DeepSeek V4 Flash (Speed), DeepSeek V4 Pro (Quality)#GLM-5.3 Flash (Speed), GLM-5.3 (Quality)#' -e 's#DeepSeek V4 Flash#GLM-5.3 Flash#g' -e 's#DeepSeek V4 Pro#GLM-5.3#g' -e 's#DeepSeek via OpenRouter#GLM-5.3 via OpenRouter#g' -e 's#OpenRouter/DeepSeek is#OpenRouter/Z.ai is#' docs/architecture/DECISIONS.md docs/architecture/MODEL-SELECTION.md docs/architecture/OVERVIEW-MODELS-STATE.md docs/architecture/RESEARCH-AGENT-MODELS-CONTEXT.md docs/architecture/RESEARCH-AGENT-STREAMING-AUXILIARY.md docs/architecture/AI-PROVIDER-REGISTRY.md README.md docs/getting-started/QUICKSTART.md
```

- [ ] **Step 2: Hand-fix the three spots `sed` cannot express**

1. `docs/architecture/MODEL-SELECTION.md` lines 77–79 (the `DEFAULT_MODEL` snippet): set `name: 'GLM-5.3 Flash'`, `provider: 'Z.ai'`.
2. `docs/architecture/AI-PROVIDER-REGISTRY.md` JSON example: `"name": "GLM-5.3 Flash"`, `"provider": "Z.ai"`.
3. `docs/architecture/RESEARCH-AGENT-MODELS-CONTEXT.md` line 100: change the context-window row to `| GLM-5.3 Flash / GLM-5.3 | 1,048,576 | 131,072 |` and keep a DeepSeek row only if the table is meant to list every entry in `MODEL_CONTEXT_WINDOWS`.

- [ ] **Step 3: Add a dated decision note**

In `docs/architecture/DECISIONS.md`, directly under the "Default Models" bullet in section 3, add:

```markdown
- **2026-09-17 refresh**: moved from DeepSeek V4 Flash 0423 / V4 Pro 0423 to GLM-5.3-Flash / GLM-5.3. Rationale, candidate table, and rejected options (Gemini 3.8 Flash, DeepSeek V4.1 Flash, Kimi K3, Qwen3.8) in [`docs/superpowers/plans/2026-09-17-model-refresh-glm-5-3.md`](../superpowers/plans/2026-09-17-model-refresh-glm-5-3.md). GLM-5.3 thinking is forced; `reasoning.effort` accepts `low`/`high`/`max` only.
```

- [ ] **Step 4: Verify nothing stale remains**

Run: `grep -rn -i 'deepseek' README.md docs/architecture docs/getting-started | grep -v superpowers`
Expected: no lines except any intentional historical mention in `DECISIONS.md` (the dated note above) and the DeepSeek context-window rows if kept.

- [ ] **Step 5: Format and commit**

```bash
bun format
git add README.md docs/
git commit -m "docs: reflect GLM-5.3 default models

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: Verification, graph freshness, and PR

**Files:**

- Modify: `graphify-out/graph.json` (regenerated)

- [ ] **Step 1: Full gates**

Run: `bun lint && bun typecheck && bun run test`
Expected: all clean. Fix every warning, including ones you did not introduce.

- [ ] **Step 2: Live smoke, speed tier**

Requires `OPENROUTER_API_KEY` in `.env.local` (see memory `reference_local_env_setup`). Start `bun dev`, open `http://localhost:43100`, and with the default cookies send:

1. `What changed in the Next.js 16 App Router?` — expect a search tool call, one coalesced "Thoughts" disclosure, streamed answer with citations, then three related questions.
2. Follow up: `Summarise that in two bullets.` — expect a normal reply (this is the multi-turn replay path Task 4 protects).

Confirm in the server log: `[ChatAgent:...] ... modelType=speed` and the model string `openrouter:z-ai/glm-5.3-flash`. Confirm no `[openrouter] Some reasoning_details entries were removed` warning on turn 2.

- [ ] **Step 3: Live smoke, quality tier and canvas**

Set cookie `modelType=quality`, repeat prompt 1 and confirm `openrouter:z-ai/glm-5.3`. Then send `Build a small landing page for a coffee shop` — expect the canvas upgrade log line and a rendered artifact.

- [ ] **Step 4: Background slots**

Run: `curl -s -H "Authorization: Bearer <CRON_SECRET>" http://localhost:43100/api/suggestions/refresh`
Expected: 200 and the trending-suggestions log line naming `z-ai/glm-5.3-flash`.

- [ ] **Step 5: Graph freshness**

Run: `python scripts/check-graph-freshness.py --fix`
Then: `git add graphify-out/graph.json && git commit -m "chore(graphify): refresh graph after model swap" -m "Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"`

- [ ] **Step 6: Open the PR**

Push the branch and open a PR titled `feat(models): refresh default models to GLM-5.3-Flash / GLM-5.3`. Body: link this plan, list the two latent bugs fixed, and paste the smoke-test log lines. End with `🤖 Generated with [Claude Code](https://claude.com/claude-code)`.

- [ ] **Step 7: Post-deploy regression check**

After the Vercel production deploy, open Railway → `polymorph-evals` → **Cron Runs → Run now**. Compare the new `reg-research-mode` row in `/admin/evals` against the previous baseline. A drop in `faithfulness` or `tool-selection` below the configured thresholds blocks the change; `JUDGE UNAVAILABLE` means retry, not regression.

---

### Task 7: Reliable background structured output (added during execution, 2026-09-18)

The Task 6 live smoke test failed: related questions threw `AI_NoObjectGeneratedError` on 3 of 3 chats. Verified root cause, two parts:

1. **Host-dependent JSON-schema support.** OpenRouter load-balances `z-ai/glm-5.3-flash` across ~29 hosts. With `Output.array` / `Output.object` (sent as `response_format: json_schema`), `together`, `fireworks`, `baseten`, `parasail`, `cloudflare`, and `friendli` returned valid JSON on 18 of 18 calls. The Z.AI first-party host returned markdown 3 of 3, `deepinfra` errored 3 of 3, `wafer` errored 1 of 3. `provider.require_parameters: true` did not help. DeepSeek V4 Flash passed 3 of 3 unpinned, so this was a regression from the swap.
2. **Background `providerOptions` were never forwarded.** `lib/agents/generate-related-questions.ts` and `lib/agents/generate-trending-suggestions.ts` ignored the config's `providerOptions`, so the `reasoning` settings added in PR #234 were dead config.

Fix (commit `3a12c58`): both generators now forward `providerOptions` (same conditional spread as `lib/agents/chat/factory.ts`), and the two background slots pin `provider.only` to the six verified hosts. Re-smoke: related questions stream `status: success`; zero parse errors across five chats.

Not exercised locally: the persisted multi-turn path (`create-chat-stream-response.ts`) because local Supabase was not running; the cross-turn reasoning strip is covered by unit tests only. Check one two-turn chat on the Vercel preview before merging.

---

## Follow-ups (not in this plan)

- **Image model — decided 2026-09-18: `gateway:meta/muse-image-1.0`, shipped on branch `feat/muse-image-model`.** The owner chose the best-value model over the drop-in; the tool was rewritten around `generateImage` (aspect ratios map to `size` hints because Muse ignores `aspectRatio`; edits pass the source as a URL file; output is WebP). Original research, for the record: The tool (`lib/tools/generate-image/server.ts`) calls `generateText` and reads `result.files`, with `providerOptions.google.aspectRatio` and an image part for edits. On the Vercel AI Gateway only the Gemini image family is typed `language` and works with that code path, so these are one-line swaps:

  | Model                                     | $/image (1K) | AA text-to-image Elo (rank) | AA editing Elo (rank) |
  | ----------------------------------------- | ------------ | --------------------------- | --------------------- |
  | `google/gemini-2.5-flash-image` (current) | 0.039        | 985 (#50)                   | 987 (#45)             |
  | `google/gemini-3.1-flash-lite-image`      | 0.034        | 1091 (#13)                  | 1041 (#22)            |
  | **`google/gemini-3.1-flash-image`**       | 0.067        | 1122 (#6)                   | 1106 (#9)             |
  | `google/gemini-3-pro-image`               | 0.134        | 1100 (#10)                  | 1096 (#12)            |

  3.1 Flash Image is the best of the drop-ins on both generation and editing; the Lite variant is the pick if cost ever matters (cheaper than today and still +100 Elo). Best value overall is `meta/muse-image-1.0` ($0.01, Elo 1112 / 1116) and the quality leader is `openai/gpt-image-2.5` ($0.21), but both are Gateway type `image`: they need the tool rewritten around `generateImage`, with different edit and aspect-ratio handling. Not worth it at current volume. The swap touches `server.ts:22` plus three doc lines (`DECISIONS.md:29`, `RESEARCH-AGENT-CONDITIONAL-TOOLS.md:12`, `README.md:40`) and needs a visual check of one generation and one edit with a live `AI_GATEWAY_API_KEY`.

- **Judge model:** `google/gemini-3.1-flash-lite-preview` still resolves on OpenRouter, but the GA `google/gemini-3.1-flash-lite` (2026-05-07) and `gemini-3.5-flash-lite` exist. Retiring the preview alias will break the cron. Plan a deliberate judge migration with a re-baselined regression run, never as part of a cost change.
- **Image uploads to a text-only quality tier:** today both tiers are text-only. After this plan the speed tier accepts images but the quality tier (and the canvas upgrade path) does not. If image-in-canvas matters, the multimodal option at the same score is `qwen/qwen3.8-max-0902` ($2 / $6).
- **Provider pinning:** `@openrouter/ai-sdk-provider` 3.0.0 has no `provider.quantizations` passthrough. If fp4 hosts prove flaky, add `provider: { order: ['Z.AI'] }` via raw `providerOptions.openrouter` after checking the SDK version supports it.

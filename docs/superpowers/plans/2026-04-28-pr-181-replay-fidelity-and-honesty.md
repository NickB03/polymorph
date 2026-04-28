# PR 181 Replay Fidelity & Reporting Honesty Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the six fidelity/honesty bugs the audit found in PR 181 ("True replay Traffic Monitor evals") so the traffic-monitor suite produces a trustworthy regression-detection signal: replays must reproduce production conditions faithfully, and the dashboard must surface partial-replay failures instead of silently masking them.

**Architecture:** Three independent fix tracks ride together because a partial fix is misleading. (1) Replay-fidelity: persist `modelType` on production assistant messages so the sampler can read it back, filter samples that used tools the eval path can't wire (canvas, image generation), and add `inlineFileUrls` to eval message conversion. (2) Reporting-honesty: thread attempted-vs-succeeded counts through `SuiteRunResult` and `eval_summaries` so the dashboard can't silently report "1/1 = 100%" on a 9/10 drop, and add a drop-rate gate to threshold-breach. (3) Soften the precheck that punishes legitimate routing changes (`requiresCitations` derived from the historical answer). Plus a small dashboard copy cleanup so cadence claims stop contradicting the new 48h cron.

**Tech Stack:** TypeScript (strict), Drizzle ORM, Vitest, Postgres (Supabase). The PR target is the existing `codex/eval-traffic-monitor-replay` branch — these fixes should land **on that branch before merge**, or in a follow-up PR with the cron disabled (`EVAL_RUN_MODE != 'traffic-monitor'`) until they ship.

---

## Pre-flight: working tree

The PR branch is already checked out as a Codex worktree at `/Users/nick/.codex/worktrees/7d33/vana-v2`. Do **not** edit there — that tree is owned by the original codex agent. Either:

- (Preferred) Pull the branch locally with `git fetch origin codex/eval-traffic-monitor-replay && git switch codex/eval-traffic-monitor-replay`, then create a new branch off it (`git switch -c fix/pr-181-replay-fidelity`) and open a stacked PR.
- Or coordinate with the original PR author to pull these changes in.

All file paths below are relative to the repo root. The PR branch already includes the changes from PR 181, so this plan **builds on** that diff — it does not re-implement it.

---

## File structure

**Modified files:**

- `lib/streaming/helpers/persist-stream-results.ts` — accept and persist `modelType` on assistant message metadata (Task 1)
- `lib/streaming/create-chat-stream-response.ts` — pass `modelType` to `persistStreamResults` (Task 1)
- `lib/streaming/__tests__/persist-stream-results.test.ts` _(create if absent)_ or extend existing test — assert `modelType` round-trips through metadata (Task 1)
- `services/evals/src/sampler.ts` — read `modelType` from assistant metadata; SQL filter for unsupported replay tools; app-layer backstop (Tasks 2, 3)
- `services/evals/src/sampler.test.ts` — assert sampler reads `modelType` from assistant metadata; assert canvas/image samples are excluded (Tasks 2, 3)
- `lib/streaming/eval-chat-runner.ts` — add `inlineFileUrls` between `pruneMessages` and `maybeTruncateMessages` (Task 4)
- `lib/streaming/__tests__/eval-chat-runner.test.ts` — assert `inlineFileUrls` is invoked on the model-message stream (Task 4)
- `lib/db/schema.ts` — add `attemptedCases` and `failedCases` columns to `evalSummaries` (Task 5)
- `drizzle/0022_eval_summary_attempt_counts.sql` _(generated)_ — migration to add the new columns (Task 5)
- `services/evals/src/types.ts` — add `attemptedCases` / `failedCases` to `SuiteRunResult` (Task 6)
- `services/evals/src/runners/shared.ts` — thread the new fields through `buildSuiteRunResult` (Task 6)
- `services/evals/src/eval-summary.ts` — accept and persist `attemptedCases` / `failedCases`; bump SQL `INSERT` and `ON CONFLICT` (Task 7)
- `services/evals/src/runners/traffic-monitor.ts` — pass `cases.length` and `failCount` into the result and persistence calls; gate threshold-breach on drop rate (Tasks 7, 9)
- `services/evals/src/runners/traffic-monitor.test.ts` — assert dashboard sees attempted vs succeeded; assert high drop rate trips threshold breach (Tasks 7, 9)
- `lib/evals/types.ts` — add `attemptedCases` / `failedCases` / `dropRate` to `EvalSummarySnapshot` and `EvalSummaryRow` (Task 8)
- `lib/evals/queries.ts` — populate the new fields in `toSnapshot` (Task 8)
- `lib/evals/queries.test.ts` — assert the snapshot exposes the new fields (Task 8)
- `services/evals/src/runners/traffic-monitor.ts` — flip `requiresCitations` to `false` for replay (Task 10)
- `services/evals/src/runners/traffic-monitor.test.ts` — assert prechecks no longer hard-fail on missing citations for replay (Task 10)
- `components/evals/widgets/what-changed-card.tsx` — replace "last 24h" / "last 24 hours" copy with "since last run" (Task 11)
- `lib/evals/layout/templates.ts:211` — replace `'what changed in the last 24 hours'` subtitle copy (Task 11)
- `components/evals/dashboard-v2/dashboard.test.tsx` — update the assertion that checks the affected copy (Task 11)

---

## Task 1: Persist `modelType` on assistant message metadata

**Files:**

- Modify: `lib/streaming/helpers/persist-stream-results.ts`
- Modify: `lib/streaming/create-chat-stream-response.ts:350-360`
- Test: existing test for `persistStreamResults` (find with `rg "persistStreamResults" lib/streaming/__tests__`); if absent, add one

**Why this is necessary:** `persist-stream-results.ts:25-30` writes `traceId`, `userMode`, and `modelId` to the assistant message metadata, but **not `modelType`**. The PR 181 sampler expects to read `modelType` from message metadata, but no production write path puts it there — so `services/evals/src/sampler.ts:514-516` always falls back to `'speed'`. Quality-tier chats silently replay on speed, invalidating the regression signal. Fix: write `modelType` next to `modelId`. Old chats sampled in the lookback window won't have it (this fix isn't retroactive), but new ones will, and the sampler's fallback chain (Task 2) handles missing values.

- [ ] **Step 1: Locate the existing test (if any)**

```bash
rg -n "persistStreamResults" lib/streaming/
```

If a test exists at `lib/streaming/__tests__/persist-stream-results.test.ts` (or similar), edit it. If not, create one — the next step shows the structure either way.

- [ ] **Step 2: Add a failing test that asserts `modelType` is written to metadata**

In the test file, add:

```ts
import { describe, expect, it, vi } from 'vitest'

import { persistStreamResults } from '../helpers/persist-stream-results'

vi.mock('@/lib/actions/chat', () => ({
  createChatWithFirstMessage: vi.fn(),
  upsertMessage: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('@/lib/db/actions', () => ({
  updateChatTitle: vi.fn().mockResolvedValue(undefined)
}))

vi.mock('next/cache', () => ({ revalidateTag: vi.fn() }))

vi.mock('@/lib/utils/perf-logging', () => ({
  perfTime: vi.fn(),
  perfLog: vi.fn()
}))

vi.mock('@/lib/utils/retry', () => ({
  retryDatabaseOperation: vi.fn()
}))

import { upsertMessage } from '@/lib/actions/chat'

describe('persistStreamResults', () => {
  it('writes modelType onto assistant message metadata when provided', async () => {
    const responseMessage = {
      id: 'msg-1',
      role: 'assistant',
      parts: [{ type: 'text', text: 'hi' }]
    } as Parameters<typeof persistStreamResults>[0]

    await persistStreamResults(
      responseMessage,
      'chat-1',
      'user-1',
      undefined,
      'trace-1',
      'search',
      'openrouter:anthropic/claude-haiku-4.5',
      undefined,
      undefined,
      'quality'
    )

    expect(upsertMessage).toHaveBeenCalledWith(
      'chat-1',
      expect.objectContaining({
        metadata: expect.objectContaining({
          traceId: 'trace-1',
          userMode: 'search',
          modelId: 'openrouter:anthropic/claude-haiku-4.5',
          modelType: 'quality'
        })
      }),
      'user-1'
    )
  })
})
```

- [ ] **Step 3: Run the test and verify it fails**

```bash
bun run test -- lib/streaming/__tests__/persist-stream-results.test.ts
```

Expected: FAIL — current implementation has no `modelType` parameter.

- [ ] **Step 4: Update `persistStreamResults` signature and metadata write**

In `lib/streaming/helpers/persist-stream-results.ts`, update the imports and signature:

```ts
import { revalidateTag } from 'next/cache'

import { createChatWithFirstMessage, upsertMessage } from '@/lib/actions/chat'
import { DEFAULT_CHAT_TITLE } from '@/lib/constants'
import { updateChatTitle } from '@/lib/db/actions'
import type { UIMessage } from '@/lib/types/ai'
import type { ModelType } from '@/lib/types/model-type'
import { UserMode } from '@/lib/types/search'
import { perfTime } from '@/lib/utils/perf-logging'
import { retryDatabaseOperation } from '@/lib/utils/retry'

export async function persistStreamResults(
  responseMessage: UIMessage,
  chatId: string,
  userId: string,
  titlePromise?: Promise<string>,
  parentTraceId?: string,
  userMode?: UserMode,
  modelId?: string,
  initialSavePromise?: Promise<
    Awaited<ReturnType<typeof createChatWithFirstMessage>>
  >,
  initialUserMessage?: UIMessage,
  modelType?: ModelType
) {
  responseMessage.metadata = {
    ...(responseMessage.metadata || {}),
    ...(parentTraceId && { traceId: parentTraceId }),
    ...(userMode && { userMode }),
    ...(modelId && { modelId }),
    ...(modelType && { modelType })
  }

  // ... rest of body unchanged
```

(Leave the rest of the function body — `initialSavePromise` handling, `upsertMessage`, title updating — exactly as it was. Only the parameter list and metadata spread change.)

- [ ] **Step 5: Update the call site in `createChatStreamResponse`**

In `lib/streaming/create-chat-stream-response.ts:350-360`, the `onFinish` callback already destructures `modelType` from `config` at line 63. Pass it through:

```ts
await persistStreamResults(
  responseMessage,
  chatId,
  userId,
  titlePromise,
  parentTraceId,
  userMode,
  context.modelId,
  context.pendingInitialSave,
  context.pendingInitialUserMessage,
  modelType
)
```

- [ ] **Step 6: Run the test and verify it passes**

```bash
bun run test -- lib/streaming/__tests__/persist-stream-results.test.ts
```

Expected: PASS.

- [ ] **Step 7: Typecheck and lint**

```bash
bun typecheck && bun lint
```

Expected: clean.

- [ ] **Step 8: Commit**

```bash
git add lib/streaming/helpers/persist-stream-results.ts \
        lib/streaming/create-chat-stream-response.ts \
        lib/streaming/__tests__/persist-stream-results.test.ts
git commit -m "$(cat <<'EOF'
fix(streaming): persist modelType on assistant message metadata

The eval traffic-monitor sampler reads modelType from message metadata
to reproduce production tier on replay. Without this, quality-mode
chats silently replay on speed, invalidating the regression signal.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Sampler reads `modelType` from assistant metadata

**Files:**

- Modify: `services/evals/src/sampler.ts:494-519`
- Modify: `services/evals/src/sampler.test.ts`

**Why this is necessary:** With Task 1 in place, new chats will have `modelType` on the assistant message. Update the sampler to read it. Production never persists `modelType` to user metadata (verified in Task 1's investigation), so the `userMetadata` lookup is dead code; replace with a fall-through that prefers user metadata (in case future writes change), then falls back to assistant metadata, then defaults to `'speed'`.

- [ ] **Step 1: Add a failing test for assistant-metadata fallback**

In `services/evals/src/sampler.test.ts`, find the existing describe block (or the file's top-level describe) and add a test alongside the others. Use the existing test fixtures as a template — match the local `mapRowToSample` test style. If the test file mocks `db.execute`, build a row with a `targetAssistantMessage` whose metadata contains `modelType: 'quality'` and assert `mapRowToSample` returns `modelType: 'quality'`:

```ts
it('reads modelType from assistant metadata when user metadata omits it', () => {
  const row = {
    chat_id: 'chat-1',
    created_at: new Date('2026-04-28T00:00:00Z'),
    target_user_message_id: 'user-1',
    target_assistant_message_id: 'assistant-1',
    conversation_messages: JSON.stringify([
      {
        id: 'user-1',
        role: 'user',
        createdAt: '2026-04-28T00:00:00Z',
        uiMessage: null,
        metadata: { userMode: 'search' },
        textParts: [{ type: 'text', text: 'hello' }]
      }
    ]),
    target_assistant_message: JSON.stringify({
      id: 'assistant-1',
      role: 'assistant',
      createdAt: '2026-04-28T00:00:01Z',
      uiMessage: null,
      metadata: { modelType: 'quality', modelId: 'openrouter:x/y' },
      textParts: [{ type: 'text', text: 'hi' }]
    }),
    target_search_results: null,
    target_citations: null,
    target_tool_names: null
  }

  // mapRowToSample is currently a private helper; export it from sampler.ts
  // for testability (or test through sampleRecentChats with a mocked db).
  const sample = mapRowToSample(row)
  expect(sample.modelType).toBe('quality')
})
```

If `mapRowToSample` isn't exported, add `export` to its declaration in `sampler.ts` so the test can call it directly. Adjust the test imports accordingly.

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd services/evals && bun run test -- src/sampler.test.ts -t "reads modelType from assistant metadata"
```

Expected: FAIL — sampler currently returns `'speed'` because it only checks `userMetadata.modelType`.

- [ ] **Step 3: Update `mapRowToSample` to fall through to assistant metadata**

In `services/evals/src/sampler.ts:514-516`, change:

```ts
const modelType = isModelType(userMetadata.modelType)
  ? userMetadata.modelType
  : 'speed'
```

to:

```ts
const modelType = isModelType(userMetadata.modelType)
  ? userMetadata.modelType
  : isModelType(assistantMetadata.modelType)
    ? assistantMetadata.modelType
    : 'speed'
```

If `mapRowToSample` is not yet exported, add `export` to its `function` declaration so the test in Step 1 can import it.

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd services/evals && bun run test -- src/sampler.test.ts
```

Expected: all tests pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add services/evals/src/sampler.ts services/evals/src/sampler.test.ts
git commit -m "$(cat <<'EOF'
fix(evals/sampler): read modelType from assistant metadata fallback

Production writes modelType onto the assistant message (Task 1), not
the user message. The sampler now checks user metadata, then assistant
metadata, then defaults to 'speed'. Without the fallback, every
sampled chat replayed at the speed tier regardless of original tier.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Filter samples that used canvas/image tools (eval path can't replay them)

**Files:**

- Modify: `services/evals/src/sampler.ts` (SQL `WHERE` clause + app-layer backstop in `mapRowToSample`)
- Modify: `services/evals/src/sampler.test.ts`

**Why this is necessary:** `lib/streaming/eval-chat-runner.ts:210-220` does **not** wire `canvasToolContext` or `imageToolContext` into the researcher. In `lib/agents/chat/factory.ts:89-107`, canvas tools are conditionally registered only when `canvasToolContext` is present, and that context also auto-upgrades `modelType` to `'quality'`. So a chat that used canvas-on-quality replays as no-canvas-on-(whatever-modelType-says) — judges see a fundamentally different system and produce noise. Same for `generateImage` (`factory.ts:109-111`).

Wiring the contexts into eval mode is too much production scope (creates real canvas artifacts and images during replay). The pragmatic choice for this PR is to **filter** those samples out at the sampler — a biased "non-canvas regression signal" is honest about what it covers; a faithfulness-broken signal is not.

- [ ] **Step 1: Add a failing test that asserts canvas samples are excluded**

In `services/evals/src/sampler.test.ts`, add:

```ts
it('rejects samples whose target assistant used canvas tools', () => {
  const row = {
    chat_id: 'chat-canvas',
    created_at: new Date('2026-04-28T00:00:00Z'),
    target_user_message_id: 'user-1',
    target_assistant_message_id: 'assistant-1',
    conversation_messages: JSON.stringify([
      {
        id: 'user-1',
        role: 'user',
        createdAt: '2026-04-28T00:00:00Z',
        uiMessage: null,
        metadata: {},
        textParts: [{ type: 'text', text: 'make a chart' }]
      }
    ]),
    target_assistant_message: JSON.stringify({
      id: 'assistant-1',
      role: 'assistant',
      createdAt: '2026-04-28T00:00:01Z',
      uiMessage: {
        parts: [
          { type: 'text', text: 'here you go' },
          { type: 'tool-createCanvasArtifact', output: { ok: true } }
        ]
      },
      metadata: {},
      textParts: [{ type: 'text', text: 'here you go' }]
    }),
    target_search_results: null,
    target_citations: null,
    target_tool_names: JSON.stringify(['createCanvasArtifact'])
  }

  expect(() => mapRowToSample(row)).toThrowError(/unsupported_replay_tools/)
})

it('rejects samples whose target assistant used generateImage', () => {
  const row = {
    chat_id: 'chat-image',
    created_at: new Date('2026-04-28T00:00:00Z'),
    target_user_message_id: 'user-1',
    target_assistant_message_id: 'assistant-1',
    conversation_messages: JSON.stringify([
      {
        id: 'user-1',
        role: 'user',
        createdAt: '2026-04-28T00:00:00Z',
        uiMessage: null,
        metadata: {},
        textParts: [{ type: 'text', text: 'draw a cat' }]
      }
    ]),
    target_assistant_message: JSON.stringify({
      id: 'assistant-1',
      role: 'assistant',
      createdAt: '2026-04-28T00:00:01Z',
      uiMessage: null,
      metadata: {},
      textParts: [{ type: 'text', text: 'here is a cat' }]
    }),
    target_search_results: null,
    target_citations: null,
    target_tool_names: JSON.stringify(['generateImage'])
  }

  expect(() => mapRowToSample(row)).toThrowError(/unsupported_replay_tools/)
})
```

- [ ] **Step 2: Run the tests and verify they fail**

```bash
cd services/evals && bun run test -- src/sampler.test.ts -t "unsupported_replay_tools"
```

Expected: FAIL — `mapRowToSample` currently accepts these.

- [ ] **Step 3: Add the SQL pre-filter in the `target_turns` CTE**

In `services/evals/src/sampler.ts`, in the SQL string starting around line 84, find the `WHERE assistant.role = 'assistant'` block (around line 112) and add an exclusion clause before the closing `ORDER BY`:

```sql
      WHERE assistant.role = 'assistant'
        AND assistant.created_at > NOW() - make_interval(hours => ${lookbackHours})
        AND (
          assistant.ui_message IS NOT NULL OR EXISTS (
            SELECT 1
            FROM parts assistant_part
            WHERE assistant_part.message_id = assistant.id
              AND assistant_part.type = 'text'
              AND assistant_part.text_text IS NOT NULL
          )
        )
        AND NOT EXISTS (
          SELECT 1
          FROM parts unsupported_part
          WHERE unsupported_part.message_id = assistant.id
            AND unsupported_part.type IN (
              'tool-createCanvasArtifact',
              'tool-updateCanvasArtifact',
              'tool-readCanvasArtifact',
              'tool-generateImage'
            )
        )
      ORDER BY assistant.chat_id, assistant.created_at DESC, assistant.id DESC
```

This pre-filters at the SQL level so `ORDER BY RANDOM() LIMIT ${sampleSize}` doesn't waste slots on samples we'd reject in app code.

- [ ] **Step 4: Add an app-layer backstop in `mapRowToSample`**

In `services/evals/src/sampler.ts`, near the top of the file (after the imports) add:

```ts
const UNSUPPORTED_REPLAY_TOOLS: ReadonlySet<string> = new Set([
  'createCanvasArtifact',
  'updateCanvasArtifact',
  'readCanvasArtifact',
  'generateImage'
])
```

Then in `mapRowToSample`, after the `toolNames` field is assembled (around the `dedupeStrings([...toolNamesFromMessage(targetAssistant), ...parseToolNames(row.target_tool_names)])` block at lines 542-545), but **before** the `return` statement, add:

```ts
const toolNames = dedupeStrings([
  ...toolNamesFromMessage(targetAssistant),
  ...parseToolNames(row.target_tool_names)
])

const unsupportedTools = toolNames.filter(name =>
  UNSUPPORTED_REPLAY_TOOLS.has(name)
)
if (unsupportedTools.length > 0) {
  throw new SamplerParseError(
    'unsupported_replay_tools',
    row.chat_id,
    new Error(
      `Tools incompatible with eval replay: ${unsupportedTools.join(', ')}`
    )
  )
}
```

Restructure the `return` statement so it uses the local `toolNames` variable (instead of computing inline). The full bottom of `mapRowToSample` becomes:

```ts
const searchResults = dedupeSearchResults([
  ...searchResultsFromMessage(targetAssistant),
  ...parseSearchResults(row.target_search_results)
])
const citations = dedupeCitations([
  ...citationsFromMessage(targetAssistant),
  ...parseCitations(row.target_citations)
])
const toolNames = dedupeStrings([
  ...toolNamesFromMessage(targetAssistant),
  ...parseToolNames(row.target_tool_names)
])

const unsupportedTools = toolNames.filter(name =>
  UNSUPPORTED_REPLAY_TOOLS.has(name)
)
if (unsupportedTools.length > 0) {
  throw new SamplerParseError(
    'unsupported_replay_tools',
    row.chat_id,
    new Error(
      `Tools incompatible with eval replay: ${unsupportedTools.join(', ')}`
    )
  )
}

return {
  chatId: row.chat_id,
  createdAt: row.created_at,
  targetUserMessageId: row.target_user_message_id,
  targetAssistantMessageId: row.target_assistant_message_id,
  userQuery,
  conversation,
  searchMode,
  ...(rawUserMode ? { userMode: rawUserMode } : {}),
  ...(intent ? { intent } : {}),
  modelType,
  metadataTags,
  searchResults,
  modelAnswer,
  citations,
  toolNames
}
```

The existing `parseFailures` counter in `sampleRecentChats` (lines 215-226) will surface the dropped samples in the log: `[evals] Skipping chat <id> due to parse error: SamplerParseError: Failed to parse unsupported_replay_tools for chat <id>: …`.

- [ ] **Step 5: Run the tests and verify they pass**

```bash
cd services/evals && bun run test -- src/sampler.test.ts
```

Expected: all tests pass, including the two new exclusion tests.

- [ ] **Step 6: Commit**

```bash
git add services/evals/src/sampler.ts services/evals/src/sampler.test.ts
git commit -m "$(cat <<'EOF'
fix(evals/sampler): exclude canvas/image-tool chats from replay

eval-chat-runner does not wire canvasToolContext or imageToolContext,
so chats that used those tools cannot replay faithfully (no canvas
storage, no auto-upgrade to quality). Filter at SQL pre-sample with
an app-layer backstop. Logged as a SamplerParseError so dropped
samples are visible in [evals] warnings.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Add `inlineFileUrls` to the eval message conversion path

**Files:**

- Modify: `lib/streaming/eval-chat-runner.ts:201-208`
- Modify: `lib/streaming/__tests__/eval-chat-runner.test.ts`

**Why this is necessary:** Production runs `inlineFileUrls` between `pruneMessages` and `maybeTruncateMessages` (`lib/streaming/create-chat-stream-response.ts:243-245`). The eval runner skips it. For sampled chats whose user messages contained image attachments (HTTPS URLs), the model receives URLs it cannot fetch — the replayed answer reflects "no image context" vs production's inlined binary content. Drop-in fix mirrors production.

- [ ] **Step 1: Add a failing test**

In `lib/streaming/__tests__/eval-chat-runner.test.ts` (file already exists per the PR diff), add a test alongside the existing tests:

```ts
it('inlines file URLs after pruneMessages and before maybeTruncateMessages', async () => {
  const inlineFileUrlsSpy = vi
    .fn()
    .mockImplementation(async (msgs: unknown[]) => msgs)
  vi.doMock('../helpers/inline-file-urls', () => ({
    inlineFileUrls: inlineFileUrlsSpy
  }))

  // Re-import so the mocked helper is picked up
  const { runEvalChat } = await import('../eval-chat-runner')

  // Use whatever harness the existing tests use to stub `researcher`
  // and `readUIMessageStream` — the assertion below is what matters.
  await runEvalChat({
    caseId: 'c-1',
    suite: 'traffic-monitor',
    conversation: [{ role: 'user', parts: [{ type: 'text', text: 'hi' }] }],
    searchMode: 'chat',
    modelType: 'speed',
    model: {
      /* whatever mock the file already uses */
    } as never
  })

  expect(inlineFileUrlsSpy).toHaveBeenCalledTimes(1)
})
```

If the existing test file uses a different mock pattern (e.g., `vi.mock` at the top of the file rather than `vi.doMock`), match it. Read the surrounding tests to align style.

- [ ] **Step 2: Run the test and verify it fails**

```bash
bun run test -- lib/streaming/__tests__/eval-chat-runner.test.ts -t "inlines file URLs"
```

Expected: FAIL — `inlineFileUrls` is never called.

- [ ] **Step 3: Add the call in `eval-chat-runner.ts`**

In `lib/streaming/eval-chat-runner.ts`, add the import:

```ts
import { inlineFileUrls } from './helpers/inline-file-urls'
```

Then in `runEvalChat` (around line 201-208), insert the call between `pruneMessages` and `maybeTruncateMessages`:

```ts
let modelMessages = await convertToModelMessages(messagesToConvert)
modelMessages = pruneMessages({
  messages: modelMessages,
  reasoning: 'before-last-message',
  toolCalls: 'before-last-2-messages',
  emptyMessages: 'remove'
})
modelMessages = await inlineFileUrls(modelMessages)
modelMessages = maybeTruncateMessages(modelMessages, model)
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
bun run test -- lib/streaming/__tests__/eval-chat-runner.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add lib/streaming/eval-chat-runner.ts \
        lib/streaming/__tests__/eval-chat-runner.test.ts
git commit -m "$(cat <<'EOF'
fix(streaming/eval): inline file URLs in replay message conversion

Production calls inlineFileUrls between pruneMessages and
maybeTruncateMessages. The eval path skipped it, so historical user
messages with image attachments arrived at the model as URLs it
cannot fetch — the replayed answer reflected "no image context" vs
production's inlined content.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Drizzle migration adding `attempted_cases` and `failed_cases`

**Files:**

- Modify: `lib/db/schema.ts:564-615` (add columns to the `evalSummaries` definition)
- Generated: `drizzle/0022_eval_summary_attempt_counts.sql`

**Why this is necessary:** Currently `eval_summaries.total_cases` records `examples.length` — i.e., the _succeeded_ case count. `failCount` is logged at `traffic-monitor.ts:73-77` but never persisted. Result: 9/10 HTTP failures with 1 successful pass-through is recorded as "1/1 = 100% pass rate, 1 sample" in the dashboard. Adding explicit `attempted_cases` (= cases dispatched to the runner) and `failed_cases` (= replays that errored) lets the dashboard distinguish "thin sample" from "mostly broken run."

- [ ] **Step 1: Update the schema**

In `lib/db/schema.ts`, around line 586 inside the `evalSummaries` definition, add the two columns just after `totalCases`:

```ts
    totalCases: integer('total_cases').notNull(),
    attemptedCases: integer('attempted_cases').notNull().default(0),
    failedCases: integer('failed_cases').notNull().default(0),
    phoenixUrl: text('phoenix_url'),
```

Then add a sanity check constraint to the `table => [...]` array, after the existing `eval_summaries_threshold_bps_range` check:

```ts
    check(
      'eval_summaries_failed_cases_lte_attempted',
      sql`${table.failedCases} <= ${table.attemptedCases}`
    ),
```

- [ ] **Step 2: Generate the migration**

```bash
bunx drizzle-kit generate --name eval_summary_attempt_counts
```

This produces `drizzle/0022_eval_summary_attempt_counts.sql`. Inspect it; it should contain:

```sql
ALTER TABLE "eval_summaries" ADD COLUMN "attempted_cases" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD COLUMN "failed_cases" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "eval_summaries" ADD CONSTRAINT "eval_summaries_failed_cases_lte_attempted" CHECK ("eval_summaries"."failed_cases" <= "eval_summaries"."attempted_cases");
```

If drizzle-kit produces something materially different (e.g., wrong column order, missing constraint), hand-edit the generated SQL to match the block above. The defaults must be `0` so existing rows backfill cleanly.

- [ ] **Step 3: Apply the migration to the local DB**

```bash
bun run migrate
```

Expected: migration applies, no errors.

- [ ] **Step 4: Verify the columns exist**

```bash
psql "$DATABASE_URL" -c "\\d eval_summaries" | rg "attempted_cases|failed_cases"
```

Expected: both columns listed as `integer NOT NULL DEFAULT 0`.

If `DATABASE_URL` is not exported, run via `npx supabase status` to find the local one, or use `psql postgres://postgres:postgres@127.0.0.1:44322/postgres`.

- [ ] **Step 5: Commit**

```bash
git add lib/db/schema.ts drizzle/0022_eval_summary_attempt_counts.sql drizzle/meta/
git commit -m "$(cat <<'EOF'
feat(db/evals): add attempted_cases and failed_cases columns

Currently total_cases records succeeded count, masking partial replay
failures. Persist attempted vs failed so the dashboard can distinguish
"thin sample" from "mostly broken run." CHECK constraint enforces
failed <= attempted. Existing rows default to 0 (treated as no info).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Thread `attemptedCases` and `failedCases` through `SuiteRunResult`

**Files:**

- Modify: `services/evals/src/types.ts:11-21`
- Modify: `services/evals/src/runners/shared.ts:396-416`

**Why this is necessary:** `SuiteRunResult` is the contract between the runner and `persistEvalSummary`. Add the two counts so persistence has them.

- [ ] **Step 1: Update `SuiteRunResult` type**

In `services/evals/src/types.ts:11-21`, change:

```ts
export interface SuiteRunResult {
  suite: PersistedEvalSuite
  status: SuiteRunStatus
  passRate: number
  threshold: number
  failedEvaluators: string[]
  experimentName: string
  datasetName: string
  phoenixUrl: string | null
  totalCases: number
  attemptedCases: number
  failedCases: number
}
```

- [ ] **Step 2: Update `buildSuiteRunResult`**

In `services/evals/src/runners/shared.ts:396-416`, change `buildSuiteRunResult`:

```ts
export function buildSuiteRunResult(params: {
  suite: SuiteRunResult['suite']
  thresholds: ThresholdResult
  threshold: number
  experimentName: string
  datasetName: string
  phoenixUrl: string | null
  totalCases: number
  attemptedCases: number
  failedCases: number
}): SuiteRunResult {
  return {
    suite: params.suite,
    status: params.thresholds.passed ? 'passed' : 'threshold_breached',
    passRate: params.thresholds.passRate,
    threshold: params.threshold,
    failedEvaluators: params.thresholds.failedEvaluators,
    experimentName: params.experimentName,
    datasetName: params.datasetName,
    phoenixUrl: params.phoenixUrl,
    totalCases: params.totalCases,
    attemptedCases: params.attemptedCases,
    failedCases: params.failedCases
  }
}
```

- [ ] **Step 3: Update existing call sites in `runJudgedSuite`**

In `services/evals/src/runners/shared.ts:166-174`, the existing `buildSuiteRunResult` call inside `runJudgedSuite` will now fail typecheck. Add the two fields:

```ts
const result = buildSuiteRunResult({
  suite,
  thresholds,
  threshold: runtimeConfig.scoreThreshold,
  experimentName,
  datasetName,
  phoenixUrl,
  totalCases: examples.length,
  attemptedCases: cases.length,
  failedCases: failCount
})
```

(Note `cases` and `failCount` are already in scope from the `runCasesConcurrently` call earlier in the function.)

- [ ] **Step 4: Typecheck the service**

```bash
cd services/evals && bun typecheck
```

Expected: TypeScript will complain about `traffic-monitor.ts` not passing the new fields. That's expected — Task 7 fixes it. Continue to Task 7 before committing this slice.

- [ ] **Step 5: Commit (combined with Task 7)**

Defer the commit until Task 7's changes land together — they're a single coherent type change.

---

## Task 7: Pass `attemptedCases`/`failedCases` from traffic-monitor + persist them

**Files:**

- Modify: `services/evals/src/runners/traffic-monitor.ts:128-145, 142-167`
- Modify: `services/evals/src/eval-summary.ts`
- Modify: `services/evals/src/runners/traffic-monitor.test.ts`

- [ ] **Step 1: Add a failing test asserting attempted/failed are persisted**

In `services/evals/src/runners/traffic-monitor.test.ts`, add a test:

```ts
it('persists attempted and failed case counts', async () => {
  const succeededCase = replayedCase
  mockSampleRecentChats.mockResolvedValueOnce([
    sampleChat,
    { ...sampleChat, chatId: 'chat-2' },
    { ...sampleChat, chatId: 'chat-3' }
  ])
  mockRunCasesConcurrently.mockResolvedValueOnce({
    succeeded: [{ caseSpec: succeededCase, result: replayedResult }],
    failCount: 2
  })
  mockBuildDatasetExamples.mockReturnValueOnce([
    { input: {}, output: {}, metadata: {} }
  ])
  mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

  const { runTrafficMonitorSuite } = await import('./traffic-monitor')
  await runTrafficMonitorSuite()

  expect(mockPersistEvalSummary).toHaveBeenCalledWith(
    expect.anything(),
    expect.objectContaining({
      totalCases: 1,
      attemptedCases: 3,
      failedCases: 2
    })
  )
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd services/evals && bun run test -- src/runners/traffic-monitor.test.ts -t "persists attempted and failed"
```

Expected: FAIL — current persistence call doesn't include the new fields.

- [ ] **Step 3: Update `persistEvalSummary` signature and SQL**

In `services/evals/src/eval-summary.ts`, change the `params` type to add the two fields, and update the SQL to include them:

```ts
export async function persistEvalSummary(
  db: { execute: (query: ReturnType<typeof sql>) => Promise<unknown> },
  params: {
    suite: PersistedEvalSuite
    experimentName: string
    datasetName: string
    passRate: number
    threshold: number
    thresholdBreached: boolean
    failedEvaluators: string[]
    experiment: RanExperiment
    totalCases: number
    attemptedCases: number
    failedCases: number
    phoenixUrl: string | null
  }
) {
  const evaluatorScores = computeEvaluatorAverages(
    normalizeEvaluationRuns(params.experiment)
  )

  await db.execute(sql`
    INSERT INTO eval_summaries (
      id,
      suite,
      experiment_name,
      dataset_name,
      pass_rate_bps,
      threshold_bps,
      threshold_breached,
      failed_evaluators,
      evaluator_scores,
      total_cases,
      attempted_cases,
      failed_cases,
      phoenix_url
    )
    VALUES (
      ${createId()},
      ${params.suite},
      ${params.experimentName},
      ${params.datasetName},
      ${clampPassRateBps(params.passRate)},
      ${clampPassRateBps(params.threshold)},
      ${params.thresholdBreached},
      CAST(${JSON.stringify(params.failedEvaluators)} AS jsonb),
      CAST(${JSON.stringify(evaluatorScores)} AS jsonb),
      ${params.totalCases},
      ${params.attemptedCases},
      ${params.failedCases},
      ${params.phoenixUrl}
    )
    ON CONFLICT (experiment_name) DO UPDATE SET
      pass_rate_bps = EXCLUDED.pass_rate_bps,
      threshold_bps = EXCLUDED.threshold_bps,
      threshold_breached = EXCLUDED.threshold_breached,
      failed_evaluators = EXCLUDED.failed_evaluators,
      evaluator_scores = EXCLUDED.evaluator_scores,
      total_cases = EXCLUDED.total_cases,
      attempted_cases = EXCLUDED.attempted_cases,
      failed_cases = EXCLUDED.failed_cases,
      phoenix_url = EXCLUDED.phoenix_url
  `)
}
```

- [ ] **Step 4: Update `runTrafficMonitorSuite` to pass the new fields**

In `services/evals/src/runners/traffic-monitor.ts`:

After `const { succeeded, failCount } = await runCasesConcurrently(cases)` (around line 65), the local variables are: `cases.length` = attempted, `failCount` = failed, `succeeded.length` = total. Update the `buildSuiteRunResult` call (around line 137-145):

```ts
const result = buildSuiteRunResult({
  suite: 'traffic-monitor',
  thresholds,
  threshold: config.scoreThreshold,
  experimentName,
  datasetName,
  phoenixUrl,
  totalCases: examples.length,
  attemptedCases: cases.length,
  failedCases: failCount
})
```

And update the `persistEvalSummary` call (around lines 142-156) to pass the new fields:

```ts
await persistEvalSummary(
  { execute: db.execute.bind(db) },
  {
    suite: 'traffic-monitor',
    experimentName,
    datasetName,
    passRate: result.passRate,
    threshold: result.threshold,
    thresholdBreached: result.status === 'threshold_breached',
    failedEvaluators: result.failedEvaluators,
    experiment,
    totalCases: result.totalCases,
    attemptedCases: result.attemptedCases,
    failedCases: result.failedCases,
    phoenixUrl
  }
)
```

- [ ] **Step 5: Mirror the change in `runJudgedSuite`'s `persistEvalSummary` call**

In `services/evals/src/runners/shared.ts:181-195`, update the `persistEvalSummary` call to also pass the new fields. Inside `runJudgedSuite`, the local `cases` and `failCount` are in scope:

```ts
await persistEvalSummary(
  { execute: db.execute.bind(db) },
  {
    suite,
    experimentName,
    datasetName,
    passRate: result.passRate,
    threshold: result.threshold,
    thresholdBreached: result.status === 'threshold_breached',
    failedEvaluators: result.failedEvaluators,
    experiment,
    totalCases: result.totalCases,
    attemptedCases: result.attemptedCases,
    failedCases: result.failedCases,
    phoenixUrl
  }
)
```

- [ ] **Step 6: Run all tests, verify the new one passes and existing ones still pass**

```bash
cd services/evals && bun run test
```

Expected: all 187+ tests pass, including the new `persists attempted and failed case counts` test.

- [ ] **Step 7: Typecheck**

```bash
cd services/evals && bun typecheck && cd .. && bun typecheck
```

Expected: clean both sides.

- [ ] **Step 8: Commit (Tasks 5, 6, 7 together)**

```bash
git add lib/db/schema.ts drizzle/ \
        services/evals/src/types.ts \
        services/evals/src/eval-summary.ts \
        services/evals/src/runners/shared.ts \
        services/evals/src/runners/traffic-monitor.ts \
        services/evals/src/runners/traffic-monitor.test.ts
git commit -m "$(cat <<'EOF'
feat(evals): persist attempted/failed case counts to eval_summaries

Adds attempted_cases and failed_cases columns and threads them
through SuiteRunResult and persistEvalSummary. Without this, a 9/10
replay-failure run records as "1/1 = 100% pass rate, 1 sample" — the
dashboard cannot distinguish a thin run from a broken one.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Surface drop-rate in the dashboard data layer

**Files:**

- Modify: `lib/evals/types.ts`
- Modify: `lib/evals/queries.ts`
- Modify: `lib/evals/queries.test.ts`

**Why this is necessary:** The persistence side now stores attempted/failed counts. The dashboard reads them through `EvalSummarySnapshot`. Add the fields and a derived `dropRate` so widgets can show "8/10 attempts succeeded" or render a partial-failure badge.

- [ ] **Step 1: Add a failing test**

In `lib/evals/queries.test.ts`, add a test that builds a fake row with `attempted_cases: 10, failed_cases: 3, total_cases: 7` and asserts the snapshot exposes them:

```ts
it('surfaces attempted/failed/dropRate on the snapshot', () => {
  const row: EvalSummaryRow = {
    id: 'r-1',
    suite: 'traffic-monitor',
    experimentName: 'exp',
    datasetName: 'ds',
    passRateBps: 9000,
    thresholdBps: 8000,
    thresholdBreached: false,
    failedEvaluators: [],
    evaluatorScores: { faithfulness: 0.9 },
    totalCases: 7,
    attemptedCases: 10,
    failedCases: 3,
    phoenixUrl: null,
    createdAt: new Date('2026-04-28T00:00:00Z')
  }
  const snapshot = toSnapshot(row)
  expect(snapshot.attemptedCases).toBe(10)
  expect(snapshot.failedCases).toBe(3)
  expect(snapshot.dropRate).toBeCloseTo(0.3, 5)
})
```

If `toSnapshot` and `EvalSummaryRow` aren't exported, export them from `lib/evals/queries.ts` and `lib/evals/types.ts` for testability.

- [ ] **Step 2: Run the test and verify it fails**

```bash
bun run test -- lib/evals/queries.test.ts -t "surfaces attempted"
```

Expected: FAIL — those fields don't exist yet.

- [ ] **Step 3: Update `EvalSummaryRow` and `EvalSummarySnapshot`**

In `lib/evals/types.ts:12-26`:

```ts
export interface EvalSummarySnapshot {
  id: string
  suite: PersistedDashboardSuite
  experimentName: string
  datasetName: string
  passRate: number
  threshold: number | null
  thresholdBreached: boolean
  failedEvaluators: string[]
  overallScore: number
  evaluatorScores: Record<string, number | null>
  totalCases: number
  attemptedCases: number
  failedCases: number
  dropRate: number
  phoenixUrl: string | null
  createdAt: string
}
```

And in `lib/evals/types.ts:44-57`:

```ts
export interface EvalSummaryRow {
  id: string
  suite: PersistedDashboardSuite
  experimentName: string
  datasetName: string
  passRateBps: number
  thresholdBps: number | null
  thresholdBreached: boolean
  failedEvaluators: string[]
  evaluatorScores: Record<string, number | null>
  totalCases: number
  attemptedCases: number
  failedCases: number
  phoenixUrl: string | null
  createdAt: Date
}
```

- [ ] **Step 4: Update `toSnapshot` in `queries.ts`**

In `lib/evals/queries.ts`, the existing `toSnapshot` function (around line 32) maps `EvalSummaryRow` → `EvalSummarySnapshot`. Add the new fields:

```ts
function toSnapshot(row: EvalSummaryRow): EvalSummarySnapshot {
  // ... existing field mapping ...
  return {
    // ... existing fields ...
    totalCases: row.totalCases,
    attemptedCases: row.attemptedCases,
    failedCases: row.failedCases,
    dropRate: row.attemptedCases > 0 ? row.failedCases / row.attemptedCases : 0,
    phoenixUrl: row.phoenixUrl,
    createdAt: row.createdAt.toISOString()
  }
}
```

(Read the existing function body and merge — the rest of the field mapping stays the same.)

Also: the SQL `SELECT` in `queries.ts` (find with `rg "FROM eval_summaries" lib/evals/queries.ts`) must include the new columns. Update the projection to include `attempted_cases`, `failed_cases`. Match the existing `snake_case → camelCase` pattern used in the file.

- [ ] **Step 5: Run the test and verify it passes**

```bash
bun run test -- lib/evals/queries.test.ts
```

Expected: all queries tests pass, including the new one.

- [ ] **Step 6: Commit**

```bash
git add lib/evals/types.ts lib/evals/queries.ts lib/evals/queries.test.ts
git commit -m "$(cat <<'EOF'
feat(evals/dashboard): expose attempted/failed/dropRate on snapshots

The persistence layer (Task 7) now stores attempted vs succeeded
case counts. Surface them through EvalSummarySnapshot so dashboard
widgets can show partial-failure state instead of a misleading
total_cases=succeeded display.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Threshold-breach gate on drop rate

**Files:**

- Modify: `services/evals/src/runners/traffic-monitor.ts`
- Modify: `services/evals/src/runners/traffic-monitor.test.ts`

**Why this is necessary:** Persisting `failedCases` lets the dashboard see drop rate, but the _suite-level_ threshold check still ignores drops — `checkExperimentThresholds` only looks at evaluator runs. A 90%-drop run can still record `passed`. Gate the run as `threshold_breached` whenever the drop rate exceeds 50%, regardless of evaluator scores. (50% is the default; can be tuned via `EVAL_MAX_DROP_RATE` later if desired.)

- [ ] **Step 1: Add a failing test**

In `services/evals/src/runners/traffic-monitor.test.ts`, add:

```ts
it('marks the run threshold_breached when drop rate exceeds 50%', async () => {
  mockSampleRecentChats.mockResolvedValueOnce([
    sampleChat,
    { ...sampleChat, chatId: 'chat-2' },
    { ...sampleChat, chatId: 'chat-3' },
    { ...sampleChat, chatId: 'chat-4' }
  ])
  // 1 success, 3 failures = 75% drop rate
  mockRunCasesConcurrently.mockResolvedValueOnce({
    succeeded: [{ caseSpec: replayedCase, result: replayedResult }],
    failCount: 3
  })
  mockBuildDatasetExamples.mockReturnValueOnce([
    { input: {}, output: {}, metadata: {} }
  ])
  mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)
  // Evaluator scoring "passes" — we want drop-rate alone to trip threshold
  mockCheckExperimentThresholds.mockReturnValueOnce({
    passed: true,
    passRate: 1,
    totalEvaluations: 1,
    passedEvaluations: 1,
    failedEvaluators: []
  })

  const { runTrafficMonitorSuite } = await import('./traffic-monitor')
  const result = await runTrafficMonitorSuite()

  expect(result.status).toBe('threshold_breached')
  expect(result.failedEvaluators).toContain('replay-drop-rate')
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd services/evals && bun run test -- src/runners/traffic-monitor.test.ts -t "drop rate exceeds"
```

Expected: FAIL — currently the result will be `'passed'`.

- [ ] **Step 3: Add the drop-rate gate**

In `services/evals/src/runners/traffic-monitor.ts`, after the existing `buildSuiteRunResult` call (around line 137-145), add a post-hoc override:

```ts
const result = buildSuiteRunResult({
  suite: 'traffic-monitor',
  thresholds,
  threshold: config.scoreThreshold,
  experimentName,
  datasetName,
  phoenixUrl,
  totalCases: examples.length,
  attemptedCases: cases.length,
  failedCases: failCount
})

// Drop-rate gate: if more than half of replays failed, mark the suite
// as threshold_breached even if the surviving cases scored well.
// The dashboard signal must reflect "we lost most of the run," not
// "the few cases we kept happened to pass."
const dropRate = cases.length > 0 ? failCount / cases.length : 0
if (dropRate > 0.5 && result.status === 'passed') {
  result.status = 'threshold_breached'
  result.failedEvaluators = [...result.failedEvaluators, 'replay-drop-rate']
}
```

(The `result` object is mutated locally in the runner before being passed to `persistEvalSummary` — that flow is intact since `result` is just a plain `SuiteRunResult`. The `logThresholdBreachWarning` call further down already gates on `result.status === 'threshold_breached'`, so it'll fire correctly.)

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd services/evals && bun run test -- src/runners/traffic-monitor.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add services/evals/src/runners/traffic-monitor.ts \
        services/evals/src/runners/traffic-monitor.test.ts
git commit -m "$(cat <<'EOF'
fix(evals/traffic-monitor): trip threshold breach on >50% drop rate

A run that drops >50% of replays no longer records as 'passed' just
because the surviving cases scored well. Adds a 'replay-drop-rate'
pseudo-evaluator to failedEvaluators so the dashboard's
THRESHOLD BREACH warning surfaces the cause.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Soften `requiresCitations` for traffic-monitor replay

**Files:**

- Modify: `services/evals/src/runners/traffic-monitor.ts:56`
- Modify: `services/evals/src/runners/traffic-monitor.test.ts`

**Why this is necessary:** The audit found that `requiresCitations: sample.citations.length > 0` ties the prechecks/tool-usage evaluators to the _historical_ answer's citations. A legitimate routing change (the new system answers from prior knowledge instead of searching) is then scored as a hard regression by the deterministic gates. The five LLM judges (faithfulness, citation-accuracy) handle citation-quality more nuancedly. Drop the hard gate for replay; let the LLM judges do their job.

- [ ] **Step 1: Add a failing test asserting `requiresCitations` is `false`**

In `services/evals/src/runners/traffic-monitor.test.ts`, add:

```ts
it('does not enforce historical citations on replay cases', async () => {
  const sampleWithCitations = {
    ...sampleChat,
    citations: [{ url: 'https://example.com', title: 'Source' }]
  }
  mockSampleRecentChats.mockResolvedValueOnce([sampleWithCitations])
  mockRunCasesConcurrently.mockResolvedValueOnce({
    succeeded: [{ caseSpec: replayedCase, result: replayedResult }],
    failCount: 0
  })
  mockBuildDatasetExamples.mockReturnValueOnce([
    { input: {}, output: {}, metadata: {} }
  ])
  mockCreateDatasetAndExperiment.mockResolvedValueOnce(datasetResult)

  const { runTrafficMonitorSuite } = await import('./traffic-monitor')
  await runTrafficMonitorSuite()

  expect(mockRunCasesConcurrently).toHaveBeenCalledWith([
    expect.objectContaining({ requiresCitations: false })
  ])
})
```

- [ ] **Step 2: Run the test and verify it fails**

```bash
cd services/evals && bun run test -- src/runners/traffic-monitor.test.ts -t "does not enforce historical citations"
```

Expected: FAIL — current code sets `requiresCitations: sample.citations.length > 0`.

- [ ] **Step 3: Flip the field to `false`**

In `services/evals/src/runners/traffic-monitor.ts:56`, change:

```ts
    requiresCitations: sample.citations.length > 0,
```

to:

```ts
    // The historical answer's citations are not a hard contract for the
    // replay. Production may legitimately route a similar question without
    // search and still produce a correct answer. The LLM judges
    // (faithfulness, citation-accuracy) score citation quality nuancedly;
    // the deterministic precheck must not hard-fail on routing changes.
    requiresCitations: false,
```

- [ ] **Step 4: Run the test and verify it passes**

```bash
cd services/evals && bun run test -- src/runners/traffic-monitor.test.ts
```

Expected: all tests pass, including the new one.

- [ ] **Step 5: Commit**

```bash
git add services/evals/src/runners/traffic-monitor.ts \
        services/evals/src/runners/traffic-monitor.test.ts
git commit -m "$(cat <<'EOF'
fix(evals/traffic-monitor): drop historical-citation hard gate on replay

requiresCitations was derived from the historical answer's citations,
which made the deterministic prechecks hard-fail when the new system
made a legitimate routing change (e.g. answered from prior knowledge
instead of searching). The five LLM judges already score citation
quality. The hard gate conflated "system change" with "regression."

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Replace stale "24h" cadence copy

**Files:**

- Modify: `components/evals/widgets/what-changed-card.tsx:30, 35`
- Modify: `lib/evals/layout/templates.ts:211`
- Modify: `components/evals/dashboard-v2/dashboard.test.tsx` (any assertion that includes the stale copy)

**Why this is necessary:** The PR converted "daily" cadence claims to "48h cron/manual" everywhere except `what-changed-card.tsx` and one templates entry, which still say "last 24h" / "what changed in the last 24 hours." Findings aren't actually time-windowed at 24h — they're computed from `latest` vs `previous` snapshots. "Since last run" is more accurate and matches the new cadence.

- [ ] **Step 1: Update `what-changed-card.tsx`**

In `components/evals/widgets/what-changed-card.tsx`, change:

```tsx
<CardTitle className="text-sm">What changed (last 24h)</CardTitle>
```

to:

```tsx
<CardTitle className="text-sm">What changed (since last run)</CardTitle>
```

And change:

```tsx
<p className="text-sm text-muted-foreground">
  All stable — no deltas above threshold in the last 24h.
</p>
```

to:

```tsx
<p className="text-sm text-muted-foreground">
  All stable — no deltas above threshold since the last run.
</p>
```

- [ ] **Step 2: Update `templates.ts`**

In `lib/evals/layout/templates.ts:211`, change:

```ts
subtitle: 'what changed in the last 24 hours'
```

to:

```ts
subtitle: 'what changed since the last run'
```

- [ ] **Step 3: Update any test that asserted the old copy**

```bash
rg -n "last 24h|last 24 hours" components/evals/ lib/evals/
```

Update any test assertions that match the old copy (likely in `components/evals/dashboard-v2/dashboard.test.tsx` or `components/evals/widgets/*.test.tsx`) to match the new strings.

- [ ] **Step 4: Run the affected tests**

```bash
bun run test -- components/evals/
```

Expected: all eval-component tests pass.

- [ ] **Step 5: Commit**

```bash
git add components/evals/widgets/what-changed-card.tsx \
        lib/evals/layout/templates.ts \
        components/evals/dashboard-v2/dashboard.test.tsx
git commit -m "$(cat <<'EOF'
fix(evals/dashboard): replace stale "last 24h" copy with "since last run"

PR 181 converted cadence copy from "daily" to "48h cron/manual" but
missed the what-changed card and one template subtitle. With a 48h
cadence a literal 24h window is empty between runs. Findings are
already computed snapshot-vs-snapshot, so "since last run" is more
accurate and cadence-agnostic.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 12: End-to-end verification

- [ ] **Step 1: Run the full test suite**

```bash
bun lint && bun typecheck && bun run test && \
  cd services/evals && bun typecheck && bun run test
```

Expected: clean across all four. If anything fails, stop and diagnose — don't push.

- [ ] **Step 2: Inspect the diff scope**

```bash
git diff --stat origin/codex/eval-traffic-monitor-replay..HEAD
```

Expected: changes confined to the files listed in "File structure" above. Surprise files = something went wrong.

- [ ] **Step 3: Local replay sanity check (optional but recommended)**

In one terminal:

```bash
bun dev
```

In another:

```bash
EVAL_RUN_MODE=traffic-monitor \
  EVAL_RUNNER_URL=http://localhost:43100 \
  EVAL_RUNNER_SECRET=<your local secret> \
  SAMPLE_SIZE=3 \
  bun run --cwd services/evals start
```

Inspect the printed Phoenix URL. Verify that:

- One sampled chat's replay records `modelType` matching the original chat (read its row in the `eval_summaries` dashboard).
- `attempted_cases` and `failed_cases` are populated.
- A canvas-using chat from your local DB does _not_ appear in the sampled set (you can confirm by `psql`-ing the chats table, finding a canvas chat, then re-running and checking it's absent).

If the local DB has no canvas chats, skip the canvas verification — the SQL filter is exercised by the unit test in Task 3.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin fix/pr-181-replay-fidelity
gh pr create --base codex/eval-traffic-monitor-replay \
             --title "Fix PR 181 replay fidelity & reporting honesty" \
             --body "$(cat <<'EOF'
## Summary

Resolves the six fidelity/honesty bugs surfaced in the PR 181 audit.

- **Fidelity:** persist `modelType` on assistant messages so the sampler can read it; filter samples that used canvas/image tools (eval path can't replay those); add `inlineFileUrls` to eval message conversion.
- **Reporting honesty:** thread `attempted_cases` / `failed_cases` through `SuiteRunResult` and `eval_summaries`; add a >50% drop-rate gate that trips threshold breach.
- **Stop punishing legitimate change:** drop the historical-citation hard gate from traffic-monitor prechecks.
- **Cadence copy:** replace stale "last 24h" copy with "since last run."

## Test plan

- [x] `bun lint`, `bun typecheck`, `bun run test`
- [x] `cd services/evals && bun typecheck && bun run test`
- [ ] Local replay run: confirm `modelType` round-trip, `attempted_cases`/`failed_cases` populated, canvas chats excluded

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

(Or merge directly into the PR 181 branch if the original author prefers.)

---

## Self-review

**Spec coverage:**

- ✅ Audit blocker #1 (modelType sampler bug) → Tasks 1, 2.
- ✅ Audit blocker #2 (canvas/image unwired) → Task 3 (filter strategy chosen over wiring; documented in commit message).
- ✅ Audit blocker #3 (partial-failure masking) → Tasks 5, 6, 7, 8, 9.
- ✅ Audit follow-up #4 (`requiresCitations` punishes legitimate change) → Task 10.
- ✅ Audit follow-up #5 (stale "24h" copy) → Task 11.
- ✅ Audit follow-up #6 (`inlineFileUrls` missing) → Task 4.

**Placeholder scan:**

- Step 1 of Task 4 says "the existing test file uses a different mock pattern" — that's a real conditional, not a placeholder, since the test file's structure isn't fully visible from the audit; the engineer must read it to choose the right mock style. Acceptable.
- Step 4 of Task 8 says "Read the existing function body and merge — the rest of the field mapping stays the same" — the existing `toSnapshot` body wasn't fully reproduced because it's intentionally read-and-edit; the new lines that get added are shown explicitly. Acceptable since the _additions_ are concrete.
- All other steps have complete code or commands.

**Type / symbol consistency:**

- `attemptedCases` and `failedCases` are spelled identically across `EvalSummaryRow`, `EvalSummarySnapshot`, `SuiteRunResult`, the schema, the SQL, and the test fixtures — checked.
- `unsupported_replay_tools` is the `SamplerParseError` field name in Tasks 3 and matches the test regex.
- `'replay-drop-rate'` is the pseudo-evaluator name in Task 9 and matches the test assertion.
- All file paths verified against the worktree at `/Users/nick/.codex/worktrees/7d33/vana-v2`.

**Cross-task dependencies:**

- Task 2 (sampler reads modelType) depends on Task 1 (production writes modelType) for the data to actually exist. Documented in Task 1's "Why this is necessary" — old chats won't backfill.
- Tasks 5, 6, 7 must commit together (they share a typecheck barrier). Documented in Task 6 Step 5 and Task 7 Step 8.
- Task 8 depends on the persistence side (Task 7) writing the new columns before the dashboard read-side can populate them; running them in this order avoids reading uninitialized columns.
- Task 9 depends on Task 7's `failCount` being threaded through.

**Risks not addressed in scope:**

- N=10 statistical adequacy. The audit flagged this as PARTIAL (no significance gate, no rolling window). Out of scope for this plan — fix is "more samples + significance test" which is a different conversation.
- Canvas/image _wiring_ (vs filtering). If the user wants a coverage signal for canvas chats, that's a separate plan; this one chooses the safer, smaller intervention.

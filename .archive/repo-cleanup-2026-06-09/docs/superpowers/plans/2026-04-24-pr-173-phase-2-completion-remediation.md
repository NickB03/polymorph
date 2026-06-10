# PR 173 Phase 2 Completion Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve every open PR 173 review finding and produce a merge-candidate branch that can pass the Phase 2 acceptance criteria in `docs/superpowers/plans/2026-04-23-ai-sdk-contract-standardization-phase-2.md`.

**Architecture:** Keep PR 173's Workstream 1 route-delegation boundary, add missing regression coverage, then complete the remaining Phase 2 workstreams behind local compatibility shims. The final branch must prove that agent selection, tool modularity, canonical `ui_message` persistence, one live specialist, and one community-portability proof all work through the real chat path.

**Tech Stack:** Next.js App Router, Vercel AI SDK `ToolLoopAgent`, Vitest, Drizzle/Postgres, React 19, existing `components/tool-ui/*` and `lib/agents/chat/*` contracts.

---

## Completion Rule

PR 173 is not complete until every item below is true:

- Workstream 1 has tests for build-mode delegation, rate-limit short-circuiting before delegation, and authenticated tool-result continuations through the injected agent boundary.
- Workstreams 2 through 5 from the Phase 2 plan are implemented or the PR is explicitly re-scoped so it no longer claims Phase 2 completion.
- The final verification matrix passes locally and on GitHub.
- The PR body says exactly which acceptance criteria passed and lists any residual risk. No Phase 3 planning is written.

## Review Findings Covered

- Finding 1: `docs/superpowers/plans/2026-04-23-ai-sdk-contract-standardization-phase-2.md:236-247` - PR 173 only satisfies Workstream 1 and cannot pass full Phase 2 acceptance criteria.
- Finding 2: `lib/agents/chat/__tests__/route-handler.test.ts:48-165` - build-mode route-path delegation is not test-covered.
- Finding 3: `app/api/chat/__tests__/route.test.ts:190-240` - delegation after rate-limit is code-inspected but not test-protected.

## File Map

### Workstream 1 Coverage

- Modify: `app/api/chat/__tests__/route.test.ts`
- Modify: `lib/agents/chat/__tests__/route-handler.test.ts`
- Modify: `lib/streaming/__tests__/create-chat-stream-response.test.ts`
- Verify unchanged behavior in:
  - `app/api/chat/route.ts`
  - `lib/agents/chat/route-handler.ts`
  - `lib/streaming/create-chat-stream-response.ts`
  - `lib/streaming/create-ephemeral-chat-stream-response.ts`

### Workstream 2 Tool Modules

- Create folders:
  - `lib/tools/display-option-list/`
  - `lib/tools/display-question-wizard/`
  - `lib/tools/display-citations/`
  - `lib/tools/display-link-preview/`
  - `lib/tools/generate-image/`
  - `lib/tools/create-canvas-artifact/`
  - `lib/tools/update-canvas-artifact/`
  - `lib/tools/read-canvas-artifact/`
- Modify compatibility files:
  - `lib/tools/display-option-list.ts`
  - `lib/tools/display-question-wizard.ts`
  - `lib/tools/display-citations.ts`
  - `lib/tools/display-link-preview.ts`
  - `lib/tools/generate-image.ts`
  - `lib/tools/create-canvas-artifact.ts`
  - `lib/tools/update-canvas-artifact.ts`
  - `lib/tools/read-canvas-artifact.ts`
- Modify registry/dispatcher surfaces:
  - `lib/agents/chat/toolset.ts`
  - `components/tool-ui/tool-part-registry.tsx`
  - `components/tool-ui/registry.tsx`
  - `components/tool-ui/index.ts`
- Add tests:
  - `lib/tools/__tests__/module-contract.test.ts`
  - targeted component tests under `components/tool-ui/__tests__/`

### Workstream 3 Canonical Persistence

- Modify:
  - `lib/db/actions.ts`
  - `lib/db/relations.ts`
  - `lib/utils/message-mapping.ts`
  - `lib/actions/chat.ts`
  - `lib/streaming/helpers/persist-stream-results.ts`
  - `lib/streaming/helpers/prepare-tool-result-messages.ts`
- Create:
  - `scripts/backfill-chat-ui-message.ts`
  - `scripts/__tests__/backfill-chat-ui-message.test.ts`
- Add or extend:
  - `lib/db/__tests__/chat-ui-message-load.test.ts`
  - `lib/utils/__tests__/message-mapping-ui-message.test.ts`
  - `lib/utils/__tests__/message-mapping-display-tools.test.ts`

### Workstream 4 Live Specialist

- Modify:
  - `lib/agents/chat/specialists.ts`
  - `lib/agents/chat/research.ts`
  - `lib/agents/chat/toolset.ts`
  - `lib/agents/prompts/search-mode-prompts.ts`
  - `components/tool-ui/registry.tsx`
  - `components/tool-ui/index.ts`
- Create:
  - `lib/agents/chat/specialists/competitor-research.ts`
  - `components/tool-ui/competitor-research-result.tsx`
  - `components/tool-ui/competitor-research-result.test.tsx`
- Extend:
  - `lib/agents/chat/__tests__/specialists.test.ts`
  - `lib/agents/__tests__/researcher.test.ts`

### Workstream 5 Portability Proof And Docs

- Modify:
  - `docs/architecture/GENERATIVE-UI.md`
  - `docs/architecture/STREAMING.md`
  - `docs/architecture/RESEARCH-AGENT.md`
  - `docs/reference/FILE-INDEX.md`
- Add:
  - `lib/agents/chat/__tests__/community-portability.test.ts`

---

## Task 1: Repair Workstream 1 Regression Coverage

**Files:**

- Modify: `app/api/chat/__tests__/route.test.ts`
- Modify: `lib/agents/chat/__tests__/route-handler.test.ts`
- Modify: `lib/streaming/__tests__/create-chat-stream-response.test.ts`

- [ ] **Step 1: Add route test imports for cookie and rate-limit controls**

In `app/api/chat/__tests__/route.test.ts`, import the mocked dependencies that the new tests need to control:

```ts
import { cookies } from 'next/headers'

import { handleChatAgentRoute } from '@/lib/agents/chat/route-handler'
import { getCurrentUserId } from '@/lib/auth/get-current-user'
import { checkAndEnforceOverallChatLimit } from '@/lib/rate-limit/chat-limits'
import { checkAndEnforceGuestLimit } from '@/lib/rate-limit/guest-limit'
import { isProviderEnabled } from '@/lib/utils/registry'
```

- [ ] **Step 2: Reset rate-limit and cookie mocks in `beforeEach`**

Add these lines to the existing `beforeEach` in `app/api/chat/__tests__/route.test.ts`:

```ts
vi.mocked(checkAndEnforceOverallChatLimit).mockReset()
vi.mocked(checkAndEnforceOverallChatLimit).mockResolvedValue(null)

vi.mocked(checkAndEnforceGuestLimit).mockReset()
vi.mocked(checkAndEnforceGuestLimit).mockResolvedValue(null)

vi.mocked(cookies).mockReset()
vi.mocked(cookies).mockResolvedValue({
  get: vi.fn().mockReturnValue(undefined)
} as any)
```

- [ ] **Step 3: Add build-mode POST route coverage**

Add this test to `app/api/chat/__tests__/route.test.ts`:

```ts
it('forwards build mode from cookies to the chat agent route handler', async () => {
  const cookieGet = vi.fn((name: string) => {
    if (name === 'searchMode') return { value: 'build' }
    if (name === 'modelType') return { value: 'quality' }
    return undefined
  })
  vi.mocked(cookies).mockResolvedValueOnce({ get: cookieGet } as any)

  const req = createRequest({
    message: { role: 'user', parts: [{ type: 'text', text: 'build an app' }] },
    messages: [
      { role: 'user', parts: [{ type: 'text', text: 'build an app' }] }
    ],
    chatId: 'build-chat',
    trigger: 'submit-message',
    isNewChat: true
  })

  const res = await POST(req)

  expect(res.status).toBe(200)
  expect(handleChatAgentRoute).toHaveBeenCalledWith(
    expect.objectContaining({
      isGuest: false,
      chatId: 'build-chat',
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build',
      modelType: 'quality'
    })
  )
})
```

- [ ] **Step 4: Add authenticated rate-limit short-circuit coverage**

Add this test to `app/api/chat/__tests__/route.test.ts`:

```ts
it('does not delegate authenticated requests when the overall chat limit rejects', async () => {
  vi.mocked(checkAndEnforceOverallChatLimit).mockResolvedValueOnce(
    new Response('limited', { status: 429 })
  )

  const req = createRequest({
    message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
    messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
    chatId: 'limited-chat',
    trigger: 'submit-message',
    isNewChat: true
  })

  const res = await POST(req)

  expect(res.status).toBe(429)
  expect(checkAndEnforceOverallChatLimit).toHaveBeenCalledWith('user-123')
  expect(handleChatAgentRoute).not.toHaveBeenCalled()
})
```

- [ ] **Step 5: Add guest rate-limit short-circuit coverage**

Add this test to `app/api/chat/__tests__/route.test.ts`:

```ts
it('does not delegate guest requests when the guest limit rejects', async () => {
  vi.mocked(getCurrentUserId).mockResolvedValueOnce(
    undefined as unknown as string
  )
  process.env.ENABLE_GUEST_CHAT = 'true'
  vi.mocked(checkAndEnforceGuestLimit).mockResolvedValueOnce(
    new Response('guest limited', { status: 429 })
  )

  const req = createRequest(
    {
      message: { role: 'user', parts: [{ type: 'text', text: 'hello' }] },
      messages: [{ role: 'user', parts: [{ type: 'text', text: 'hello' }] }],
      chatId: 'guest-limited-chat',
      trigger: 'submit-message'
    },
    { 'x-forwarded-for': '203.0.113.10, 10.0.0.1' }
  )

  const res = await POST(req)

  expect(res.status).toBe(429)
  expect(checkAndEnforceGuestLimit).toHaveBeenCalledWith('203.0.113.10')
  expect(handleChatAgentRoute).not.toHaveBeenCalled()

  delete process.env.ENABLE_GUEST_CHAT
})
```

- [ ] **Step 6: Add route-handler build factory coverage**

Add this test to `lib/agents/chat/__tests__/route-handler.test.ts`:

```ts
it('creates the build agent when validated context carries build intent', async () => {
  registryMocks.resolveChatAgentId.mockReturnValue('build')

  await handleChatAgentRoute({
    isGuest: false,
    message: userMessage,
    messages: [userMessage],
    model: makeModel(),
    chatId: 'build-chat',
    userId: 'user-1',
    trigger: 'submit-message',
    searchMode: 'chat',
    userMode: 'build',
    intent: 'build',
    modelType: 'quality'
  })

  const streamConfig = vi.mocked(createChatStreamResponse).mock.calls[0][0]
  streamConfig.agentFactory({
    modelId: 'gateway:google/gemini-3-flash',
    parentTraceId: 'trace-build'
  })

  expect(registryMocks.resolveChatAgentId).toHaveBeenCalledWith({
    searchMode: 'chat',
    userMode: 'build',
    intent: 'build'
  })
  expect(registryMocks.createChatAgentById).toHaveBeenCalledWith(
    'build',
    expect.objectContaining({
      model: 'gateway:google/gemini-3-flash',
      searchMode: 'chat',
      userMode: 'build',
      intent: 'build',
      modelType: 'quality',
      parentTraceId: 'trace-build'
    })
  )
})
```

- [ ] **Step 7: Add authenticated tool-result stream coverage**

In `lib/streaming/__tests__/create-chat-stream-response.test.ts`, add a hoisted mock for `prepareToolResultMessages`:

```ts
const mockPrepareToolResultMessages = vi.fn()
const mockLoadChatWithMessages = vi.fn()
```

Update the `@/lib/db/actions` mock so `loadChatWithMessages` uses `mockLoadChatWithMessages`:

```ts
vi.mock('@/lib/db/actions', () => ({
  loadCanvasArtifactByChatId: (...args: unknown[]) =>
    mockLoadCanvasArtifactByChatId(...args),
  loadChatWithMessages: (...args: unknown[]) =>
    mockLoadChatWithMessages(...args)
}))
```

Add this mock:

```ts
vi.mock('@/lib/streaming/helpers/prepare-tool-result-messages', () => ({
  prepareToolResultMessages: (...args: unknown[]) =>
    mockPrepareToolResultMessages(...args),
  ToolResultValidationError: class ToolResultValidationError extends Error {}
}))
```

Add this test:

```ts
it('uses the injected agent factory for authenticated tool-result continuations', async () => {
  mockLoadChatWithMessages.mockResolvedValue({
    id: 'chat-1',
    userId: 'user-1',
    messages: []
  })
  mockPrepareToolResultMessages.mockResolvedValue([
    {
      id: 'assistant-1',
      role: 'assistant',
      parts: [
        {
          type: 'tool-displayOptionList',
          toolCallId: 'tool-1',
          state: 'output-available',
          input: { id: 'choice', options: [{ id: 'a', label: 'A' }] },
          output: 'a'
        }
      ]
    }
  ])
  const agentFactory = vi.fn(() => ({ stream: mockAgentStream }) as any)

  const response = await createChatStreamResponse({
    message: null,
    model: makeModel(),
    chatId: 'chat-1',
    userId: 'user-1',
    trigger: 'tool-result',
    toolResult: { toolCallId: 'tool-1', output: 'a' } as any,
    agentFactory
  })

  await expect(response.text()).resolves.toBe('ok')
  await vi.waitFor(() => {
    expect(mockLoadChatWithMessages).toHaveBeenCalledWith('chat-1', 'user-1')
    expect(mockPrepareToolResultMessages).toHaveBeenCalled()
    expect(agentFactory).toHaveBeenCalledWith(
      expect.objectContaining({
        modelId: 'openai:gpt-4o-mini',
        writer: mockWriter,
        imageToolContext: { userId: 'user-1', chatId: 'chat-1' }
      })
    )
  })
  expect(mockAgentStream).toHaveBeenCalledTimes(1)
})
```

- [ ] **Step 8: Run focused Workstream 1 tests**

Run:

```bash
bun run test -- --run app/api/chat/__tests__/route.test.ts lib/agents/chat/__tests__/route-handler.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts lib/agents/__tests__/researcher.test.ts
```

Expected: all selected test files pass.

- [ ] **Step 9: Commit Workstream 1 coverage**

```bash
git add app/api/chat/__tests__/route.test.ts lib/agents/chat/__tests__/route-handler.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts
git commit -m "test: cover chat agent delegation boundaries"
```

---

## Task 2: Complete Per-Tool Modularization

**Files:** See Workstream 2 Tool Modules in the file map.

- [ ] **Step 1: Add a contract test for migrated tool folders**

Create `lib/tools/__tests__/module-contract.test.ts` with a table that requires each migrated folder to export the stable module shape:

```ts
import { describe, expect, it } from 'vitest'

const modules = [
  ['display-option-list', () => import('@/lib/tools/display-option-list')],
  [
    'display-question-wizard',
    () => import('@/lib/tools/display-question-wizard')
  ],
  ['display-citations', () => import('@/lib/tools/display-citations')],
  ['display-link-preview', () => import('@/lib/tools/display-link-preview')],
  ['generate-image', () => import('@/lib/tools/generate-image')],
  [
    'create-canvas-artifact',
    () => import('@/lib/tools/create-canvas-artifact')
  ],
  [
    'update-canvas-artifact',
    () => import('@/lib/tools/update-canvas-artifact')
  ],
  ['read-canvas-artifact', () => import('@/lib/tools/read-canvas-artifact')]
] as const

describe('migrated tool module contracts', () => {
  it.each(modules)(
    '%s exposes a local module contract',
    async (_name, load) => {
      const mod = await load()

      expect(mod).toEqual(
        expect.objectContaining({
          toolName: expect.any(String),
          inputSchema: expect.any(Object)
        })
      )
    }
  )
})
```

- [ ] **Step 2: Move each listed tool into folder-local files**

For each migrated tool folder, create the same public shape:

```text
lib/tools/<tool-name>/
  schema.ts
  server.ts
  index.ts
  client.tsx      only for client-resolved interactive tools
  result.tsx      only for dedicated result rendering
```

Each `index.ts` must export:

```ts
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

Interactive modules must also export:

```ts
export { renderToolPart } from './client'
```

Dedicated result modules must also export:

```ts
export { ResultComponent, tryRenderResult } from './result'
```

- [ ] **Step 3: Keep compatibility re-export files**

Replace each old flat file with a compatibility re-export. Example for `lib/tools/display-option-list.ts`:

```ts
export {
  inputSchema as displayOptionListInputSchema,
  serverTool as displayOptionListTool,
  toolName as displayOptionListToolName
} from './display-option-list'
```

Use the same pattern for every migrated flat file so current imports keep working while call sites move.

- [ ] **Step 4: Move interactive display behavior out of the global dispatcher**

Update `components/tool-ui/tool-part-registry.tsx` so `displayOptionList` and `displayQuestionWizard` delegate to module-local `renderToolPart` exports. After this step, this file may still branch by tool name, but it must not own parsing, submission shape, or component state for migrated interactive tools.

The dispatcher shape should be:

```ts
if (toolName === displayOptionListToolName) {
  return renderDisplayOptionListToolPart({
    toolPart,
    messageId,
    partIndex,
    status,
    addToolResult
  })
}

if (toolName === displayQuestionWizardToolName) {
  return renderDisplayQuestionWizardToolPart({
    toolPart,
    messageId,
    partIndex,
    status,
    addToolResult
  })
}
```

- [ ] **Step 5: Update `lib/agents/chat/toolset.ts` to consume module exports**

Import server tools from the folder modules, not the flat files. Keep tool names unchanged:

```ts
import { serverTool as displayOptionListTool } from '@/lib/tools/display-option-list'
import { serverTool as displayQuestionWizardTool } from '@/lib/tools/display-question-wizard'
```

Repeat this for the migrated tool list.

- [ ] **Step 6: Add tests for migrated interactive tools**

Add component or registry tests proving:

- `displayOptionList` input-available renders its module-local client component and calls `addToolResult` with `{ toolCallId, result }`.
- `displayOptionList` output-available renders the selected choice.
- `displayQuestionWizard` input-available renders its module-local client component and calls `addToolResult` with `{ toolCallId, result }`.
- `displayQuestionWizard` output-available renders the submitted wizard result.

- [ ] **Step 7: Run tool module verification**

```bash
bun run test -- --run lib/tools/__tests__/module-contract.test.ts components/render-message.test.tsx components/tool-ui/registry.test.tsx
bun run typecheck
```

Expected: tests and typecheck pass.

- [ ] **Step 8: Commit Workstream 2**

```bash
git add lib/tools components/tool-ui components/render-message.test.tsx lib/agents/chat/toolset.ts
git commit -m "refactor: modularize high-friction chat tools"
```

---

## Task 3: Make `messages.ui_message` Canonical In Load, Persist, And Backfill Paths

**Files:** See Workstream 3 Canonical Persistence in the file map.

- [ ] **Step 1: Add DB load tests for canonical preference and fallback**

Create `lib/db/__tests__/chat-ui-message-load.test.ts` with tests that prove:

- a row with `uiMessage` returns `uiMessage.parts` even when legacy `parts` contain different content;
- a row with `uiMessage: null` reconstructs from legacy `parts`;
- loaded metadata merges `uiMessage.metadata`, message-row metadata, and `createdAt`.

Use `buildUIMessageFromDB()` directly for mapper-level assertions and `loadChatWithMessages()` with a mocked Drizzle query for DB-level assertions.

- [ ] **Step 2: Ensure load paths prefer `uiMessage`**

In `lib/db/actions.ts`, keep eager part loading only as compatibility data and ensure every chat load calls:

```ts
buildUIMessageFromDB(messageRow, messageRow.parts ?? [])
```

Do not read from `parts` first when `messageRow.uiMessage` exists.

- [ ] **Step 3: Keep dual-write, but make `uiMessage` primary**

In `lib/streaming/helpers/persist-stream-results.ts` and message creation helpers, ensure each persisted UI message writes:

```ts
const messageData = mapUIMessageToDBMessage({ ...message, chatId })
const dbParts = mapUIMessagePartsToDBParts(message.parts, message.id)
```

The row-level `uiMessage` is the canonical copy. `dbParts` is only the compatibility projection.

- [ ] **Step 4: Extract a testable backfill builder**

Create `scripts/backfill-chat-ui-message.ts` with two exports:

```ts
export function buildBackfilledUIMessage(row: {
  id: string
  role: string
  metadata?: unknown
  createdAt?: Date | string
  parts: DBMessagePartSelect[]
}): UIMessage {
  return buildUIMessageFromDB(
    {
      id: row.id,
      role: row.role,
      uiMessage: null,
      metadata: row.metadata as UIMessageMetadata | null,
      createdAt: row.createdAt
    },
    row.parts
  )
}

export async function backfillChatUiMessages({
  dryRun = true,
  limit = 500
}: {
  dryRun?: boolean
  limit?: number
} = {}) {
  // Select messages where ui_message is null, build UIMessage from parts,
  // update ui_message when dryRun is false, and return counts.
}
```

- [ ] **Step 5: Test the backfill builder**

Create `scripts/__tests__/backfill-chat-ui-message.test.ts` with a row containing a text part and a display tool part. Assert the rebuilt message contains both UI parts in order and includes row metadata.

- [ ] **Step 6: Run persistence verification**

```bash
bun run test -- --run lib/db/__tests__/chat-ui-message-load.test.ts lib/utils/__tests__/message-mapping-ui-message.test.ts lib/utils/__tests__/message-mapping-display-tools.test.ts scripts/__tests__/backfill-chat-ui-message.test.ts
bun run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 7: Commit Workstream 3**

```bash
git add lib/db lib/actions lib/utils lib/streaming/helpers scripts
git commit -m "feat: make chat ui messages canonical"
```

---

## Task 4: Replace Specialist Fixture With Live Competitor Research Specialist

**Files:** See Workstream 4 Live Specialist in the file map.

- [ ] **Step 1: Create specialist schemas and tool**

Create `lib/agents/chat/specialists/competitor-research.ts` exporting:

```ts
export const competitorResearchToolName = 'competitorResearch' as const
export const competitorResearchInputSchema = z.object({
  market: z.string().min(1),
  competitors: z.array(z.string().min(1)).min(2).max(6),
  dimensions: z.array(z.string().min(1)).min(1).max(8)
})
export const competitorResearchOutputSchema = z.object({
  summary: z.string().min(1),
  cards: z.array(
    z.object({
      competitor: z.string().min(1),
      strengths: z.array(z.string().min(1)),
      weaknesses: z.array(z.string().min(1))
    })
  ),
  matrix: z.array(z.record(z.string(), z.string()))
})
```

Create a server tool that searches and fetches through the research agent's existing tool set, then returns the structured output. The tool must be callable only from the research agent.

- [ ] **Step 2: Register the specialist in research mode**

Update `lib/agents/chat/research.ts` so the research agent can call the specialist:

```ts
export const RESEARCH_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  'competitorResearch'
  // existing display and support tools remain unchanged
]
```

Update `lib/agents/chat/toolset.ts` to include:

```ts
competitorResearch: ReturnType<typeof createCompetitorResearchTool>
```

- [ ] **Step 3: Add a dedicated result component**

Create `components/tool-ui/competitor-research-result.tsx` that renders:

- summary text;
- one compact card per competitor;
- a comparison matrix table;
- no special cases in `components/render-message.tsx`.

Register it in `components/tool-ui/registry.tsx` for `competitorResearch`.

- [ ] **Step 4: Update prompts**

In `lib/agents/prompts/search-mode-prompts.ts`, add a research-mode instruction that competitor analysis requests should call `competitorResearch` when the user asks for structured market, vendor, company, or product comparisons.

- [ ] **Step 5: Add specialist tests**

Extend `lib/agents/chat/__tests__/specialists.test.ts` to assert:

- input schema rejects fewer than two competitors;
- output schema requires summary, cards, and matrix;
- research agent active tools include `competitorResearch`;
- search/chat/build agents do not include `competitorResearch`.

Add `components/tool-ui/competitor-research-result.test.tsx` to prove the result component renders summary, cards, and matrix cells.

- [ ] **Step 6: Run specialist verification**

```bash
bun run test -- --run lib/agents/chat/__tests__/specialists.test.ts lib/agents/__tests__/researcher.test.ts components/tool-ui/competitor-research-result.test.tsx components/tool-ui/registry.test.tsx
bun run typecheck
```

Expected: all tests and typecheck pass.

- [ ] **Step 7: Commit Workstream 4**

```bash
git add lib/agents/chat lib/agents/prompts components/tool-ui
git commit -m "feat: add live competitor research specialist"
```

---

## Task 5: Prove Community Portability Without Core Plumbing Edits

**Files:**

- Add: `lib/agents/chat/__tests__/community-portability.test.ts`
- Modify: one migrated tool module or the competitor specialist module from Tasks 2 and 4

- [ ] **Step 1: Pick and record the proof pattern**

Use a simple, documented AI SDK-style pattern: a structured tool with local schema, server execution, and a local renderer adapter. Record the exact source URL or example name in a comment at the top of `lib/agents/chat/__tests__/community-portability.test.ts`.

- [ ] **Step 2: Add a proof test that fails if core plumbing changes are required**

Create `lib/agents/chat/__tests__/community-portability.test.ts` with assertions that the proof registers by editing only local module exports and the agent registry/toolset:

```ts
import { describe, expect, it } from 'vitest'

import { createResearchAgentDefinition } from '@/lib/agents/chat/research'

describe('community portability proof', () => {
  it('ports a structured tool through local adapters without route or persistence edits', () => {
    const definition = createResearchAgentDefinition({ writer: {} as any })

    expect(definition.activeTools).toContain('competitorResearch')
    expect(definition.activeTools).not.toContain('unknownCommunityGlue')
  })
})
```

- [ ] **Step 3: Verify no core files changed after the proof**

After adding the proof, run:

```bash
git diff --name-only HEAD~1..HEAD
```

Expected: no changes to `app/api/chat/route.ts`, `lib/streaming/create-chat-stream-response.ts`, `lib/streaming/create-ephemeral-chat-stream-response.ts`, or persistence internals from the portability proof commit.

- [ ] **Step 4: Commit Workstream 5**

```bash
git add lib/agents/chat/__tests__/community-portability.test.ts lib/agents/chat components/tool-ui
git commit -m "test: prove chat tool portability through local adapters"
```

---

## Task 6: Update Architecture Docs After Runtime Behavior Exists

**Files:**

- Modify: `docs/architecture/GENERATIVE-UI.md`
- Modify: `docs/architecture/STREAMING.md`
- Modify: `docs/architecture/RESEARCH-AGENT.md`
- Modify: `docs/reference/FILE-INDEX.md`

- [ ] **Step 1: Update `GENERATIVE-UI.md`**

Document:

- migrated tool module shape;
- module-local interactive behavior for `displayOptionList` and `displayQuestionWizard`;
- dedicated result rendering for `competitorResearch`;
- compatibility facade role for `components/tool-ui/registry.tsx`.

- [ ] **Step 2: Update `STREAMING.md`**

Document:

- route delegation to `handleChatAgentRoute`;
- injected `agentFactory` in authenticated and guest stream primitives;
- stream primitives owning cross-cutting concerns only.

- [ ] **Step 3: Update `RESEARCH-AGENT.md`**

Document:

- `search`, `research`, and `build` agent modules;
- registry selection from `userMode`, `searchMode`, and `intent`;
- live `competitorResearch` specialist in research mode;
- canonical `messages.ui_message` persistence and legacy `parts` fallback.

- [ ] **Step 4: Update `FILE-INDEX.md`**

Add or update entries for every new folder and file created in Tasks 2 through 5.

- [ ] **Step 5: Verify doc claims against code**

Run:

```bash
rg -n "competitorResearch|agentFactory|ui_message|display-option-list|display-question-wizard" docs/architecture docs/reference/FILE-INDEX.md
rg -n "competitorResearch|agentFactory|uiMessage|display-option-list|display-question-wizard" lib components scripts
```

Expected: doc claims have matching source-code references.

- [ ] **Step 6: Commit docs**

```bash
git add docs/architecture/GENERATIVE-UI.md docs/architecture/STREAMING.md docs/architecture/RESEARCH-AGENT.md docs/reference/FILE-INDEX.md
git commit -m "docs: describe phase 2 chat contract path"
```

---

## Task 7: Final Acceptance Verification

**Files:**

- Modify: PR body only after all commands pass.

- [ ] **Step 1: Run static verification**

```bash
bun run lint
bun run typecheck
```

Expected: both pass.

- [ ] **Step 2: Run focused Phase 2 tests**

```bash
bun run test -- --run app/api/chat/__tests__/route.test.ts lib/agents/chat/__tests__/message-contract.test.ts lib/agents/chat/__tests__/registry.test.ts lib/agents/chat/__tests__/route-handler.test.ts lib/agents/chat/__tests__/specialists.test.ts lib/agents/chat/__tests__/community-portability.test.ts lib/streaming/__tests__/create-chat-stream-response.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts lib/streaming/helpers/__tests__/prepare-messages.test.ts lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/utils/__tests__/message-mapping-ui-message.test.ts lib/utils/__tests__/message-mapping-display-tools.test.ts lib/db/__tests__/chat-ui-message-load.test.ts scripts/__tests__/backfill-chat-ui-message.test.ts components/tool-ui/competitor-research-result.test.tsx components/tool-ui/registry.test.tsx components/render-message.test.tsx lib/agents/__tests__/researcher.test.ts lib/streaming/__tests__/eval-chat-runner.test.ts
```

Expected: all selected suites pass.

- [ ] **Step 3: Run full root test suite**

```bash
bun run test
```

Expected: full root test suite passes.

- [ ] **Step 4: Verify package-local evals if touched**

If any `services/evals` file changed, run:

```bash
cd services/evals
bun install --frozen-lockfile
bun run test
```

Expected: package-local eval tests pass.

- [ ] **Step 5: Produce acceptance matrix**

Create a final PR comment or PR body section with this matrix:

```md
| Acceptance criterion                                                 | Evidence                                                         |
| -------------------------------------------------------------------- | ---------------------------------------------------------------- |
| `app/api/chat/route.ts` delegates after auth, limits, and validation | route tests for auth, guest, build, and rate-limit short-circuit |
| Stream primitives do not select prompts or active tools              | injected `agentFactory` tests for auth, guest, and tool-result   |
| `researcher.ts` is a compatibility shim                              | researcher shim tests and no hot-path route import               |
| Migrated tools follow per-tool module shape                          | `lib/tools/__tests__/module-contract.test.ts`                    |
| Tool part registry is a dispatcher                                   | interactive module tests and render-message tests                |
| `messages.ui_message` is canonical                                   | DB load, mapper, persist, and backfill tests                     |
| Backfill path exists and is exercised                                | `scripts/__tests__/backfill-chat-ui-message.test.ts`             |
| Live competitor specialist is reachable and rendered                 | specialist and component tests                                   |
| Community pattern ports without core plumbing edits                  | `community-portability.test.ts` plus proof commit diff           |
| Architecture docs describe the new default path                      | docs updated and `rg` cross-checks                               |
```

- [ ] **Step 6: Update PR 173 body**

The PR body must no longer say Workstream 1 only if this plan is fully implemented. Use this structure:

```md
## Summary

- Completed Phase 2 Workstream 1 agent ownership and route delegation.
- Migrated high-friction tools to per-tool module contracts with compatibility re-exports.
- Made `messages.ui_message` the canonical read/write path with legacy `parts` fallback and backfill coverage.
- Added the live competitor-research specialist and dedicated renderer.
- Added a community-portability proof that did not require route, streaming, or persistence changes after the architecture landed.

## Verification

- `bun run lint`
- `bun run typecheck`
- `bun run test`
- focused Phase 2 test command from the acceptance matrix

## Phase 3 Gate

No detailed Phase 3 plan was written. Phase 3 remains blocked until this PR is merged or explicitly accepted as the Phase 2 merge candidate.
```

- [ ] **Step 7: Check GitHub status**

```bash
gh pr checks 173 --watch
```

Expected: all required checks pass.

---

## Stop Conditions

- If the decision is to keep PR 173 as Workstream 1 only, stop after Task 1 and update the PR body to say it is not a Phase 2 completion PR.
- If any Workstream 2 migration requires repeated edits to route, streaming, or persistence internals, stop and fix the local tool contract before continuing.
- If the live specialist cannot be reached through the research agent's normal tool path, stop and fix the agent/toolset contract before writing docs.
- If docs are updated before runtime behavior exists, revert the docs change and finish the runtime implementation first.

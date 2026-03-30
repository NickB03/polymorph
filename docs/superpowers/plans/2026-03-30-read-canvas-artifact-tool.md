# `readCanvasArtifact` Tool Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the LLM an on-demand tool to fetch the latest persisted canvas artifact source files, so it can make accurate edits without relying on conversation context.

**Architecture:** A new read-only AI SDK `tool()` that calls the existing `loadCanvasArtifactState` service function and returns the source files + metadata. Registered alongside `createCanvasArtifact` / `updateCanvasArtifact` in the researcher agent. The system prompt is updated to tell the LLM to call it before updating when source isn't in context.

**Tech Stack:** Vercel AI SDK (`tool` from `'ai'`), Zod, Vitest

---

## File Map

| File                                        | Action | Responsibility                                                        |
| ------------------------------------------- | ------ | --------------------------------------------------------------------- |
| `lib/tools/read-canvas-artifact.ts`         | Create | Tool factory, schema, output type, execute logic                      |
| `lib/types/agent.ts`                        | Modify | Add `readCanvasArtifact` to `ResearcherTools`, invocation type, union |
| `lib/canvas/constants.ts`                   | Modify | Add `'readCanvasArtifact'` to `CANVAS_TOOL_NAMES`                     |
| `lib/agents/researcher.ts`                  | Modify | Import + register tool, update instructions hint                      |
| `lib/agents/prompts/search-mode-prompts.ts` | Modify | Document tool, update MODIFY/UPDATE routing guidance                  |
| `lib/tools/__tests__/canvas-tools.test.ts`  | Modify | Add test suite for `readCanvasArtifactTool`                           |
| `lib/agents/__tests__/researcher.test.ts`   | Modify | Add mock, update registration assertions                              |

---

### Task 1: Create the tool file with tests

**Files:**

- Create: `lib/tools/read-canvas-artifact.ts`
- Modify: `lib/tools/__tests__/canvas-tools.test.ts`

- [ ] **Step 1: Write the failing tests**

Add the import and test suite to the bottom of `lib/tools/__tests__/canvas-tools.test.ts`:

```ts
// At the top imports section, add:
import {
  ReadCanvasArtifactSchema,
  readCanvasArtifactTool
} from '../read-canvas-artifact'

// At the bottom of the file, add:

// ── readCanvasArtifact ──────────────────────────────────────────────

describe('readCanvasArtifactTool', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts a valid artifactId', () => {
    const result = ReadCanvasArtifactSchema.safeParse({
      artifactId: 'art-1'
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty artifactId', () => {
    const result = ReadCanvasArtifactSchema.safeParse({
      artifactId: ''
    })
    expect(result.success).toBe(false)
  })

  it('returns source files and metadata on success', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)

    const toolInstance = readCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      { artifactId: 'art-1' },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      artifactId: 'art-1',
      chatId: 'chat-1',
      title: 'Test App',
      status: 'ready',
      draftRevision: 2,
      files: { 'App.tsx': 'export default () => <div/>' }
    })
    expect(result.error).toBeUndefined()
  })

  it('returns not-found when artifact does not exist', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(null)

    const toolInstance = readCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      { artifactId: 'art-missing' },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      error: 'Artifact not found',
      errorCode: 'not-found',
      files: {}
    })
  })

  it('does not emit any events (read-only)', async () => {
    const ctx = createCtx()
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)

    const toolInstance = readCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      { artifactId: 'art-1' },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(ctx.emitter.emitCanvasArtifact).not.toHaveBeenCalled()
    expect(ctx.emitter.emitCanvasArtifactStatus).not.toHaveBeenCalled()
    expect(ctx.emitter.emitCanvasArtifactEvent).not.toHaveBeenCalled()
    expect(ctx.emitter.emitCanvasDiagnostics).not.toHaveBeenCalled()
  })

  it('passes userId from context to service', async () => {
    const ctx = createCtx({ userId: 'user-42' })
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)

    const toolInstance = readCanvasArtifactTool(ctx)
    await toolInstance.execute!(
      { artifactId: 'art-1' },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(mockLoadCanvasArtifactState).toHaveBeenCalledWith({
      artifactId: 'art-1',
      userId: 'user-42'
    })
  })

  it('works for guest flow', async () => {
    const ctx = createCtx({ isGuest: true, userId: 'guest' })
    mockLoadCanvasArtifactState.mockResolvedValue(READY_ARTIFACT)

    const toolInstance = readCanvasArtifactTool(ctx)
    const result = await toolInstance.execute!(
      { artifactId: 'art-1' },
      { toolCallId: 'tc-1', messages: [] }
    )

    expect(result).toMatchObject({
      artifactId: 'art-1',
      status: 'ready',
      files: { 'App.tsx': 'export default () => <div/>' }
    })
    // No guest token rotation for reads
    expect(mockRefreshGuestCanvasToken).not.toHaveBeenCalled()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `bun run test -- lib/tools/__tests__/canvas-tools.test.ts`
Expected: FAIL — `Cannot find module '../read-canvas-artifact'`

- [ ] **Step 3: Write the tool implementation**

Create `lib/tools/read-canvas-artifact.ts`:

```ts
import { tool } from 'ai'
import { z } from 'zod'

import { loadCanvasArtifactState } from '@/lib/canvas/service'
import type { CanvasToolContext } from '@/lib/canvas/tool-context'

export const ReadCanvasArtifactSchema = z.object({
  artifactId: z.string().min(1).describe('ID of the artifact to read')
})

export type ReadCanvasArtifactInput = z.infer<typeof ReadCanvasArtifactSchema>

export type ReadCanvasArtifactOutput = {
  artifactId: string
  chatId: string
  title: string
  status: string
  draftRevision: number
  currentVersionId: string | null
  files: Record<string, string>
  error?: string
  errorCode?: string
}

/**
 * Read-only tool that returns the current canvas artifact source files.
 * No side effects — no emitter events, no guest token rotation.
 */
export function readCanvasArtifactTool(ctx: CanvasToolContext) {
  return tool({
    description:
      'Read the current source files of the existing canvas artifact. Returns the full file set and metadata. Use this before updating when the artifact source is not in the conversation context.',
    inputSchema: ReadCanvasArtifactSchema,
    execute: async ({ artifactId }) => {
      console.log(
        `[readCanvasArtifact] Tool invoked: chatId=${ctx.chatId}, artifactId=${artifactId}`
      )

      const state = await loadCanvasArtifactState({
        artifactId,
        userId: ctx.userId
      })

      if (!state) {
        return {
          artifactId,
          chatId: ctx.chatId,
          title: '',
          status: 'not_found',
          draftRevision: 0,
          currentVersionId: null,
          files: {} as Record<string, string>,
          error: 'Artifact not found',
          errorCode: 'not-found'
        } satisfies ReadCanvasArtifactOutput
      }

      return {
        artifactId: state.artifactId,
        chatId: state.chatId,
        title: state.title,
        status: state.status,
        draftRevision: state.draftRevision,
        currentVersionId: state.currentVersionId,
        files: state.draftSource as Record<string, string>
      } satisfies ReadCanvasArtifactOutput
    }
  })
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `bun run test -- lib/tools/__tests__/canvas-tools.test.ts`
Expected: All tests PASS (existing + new)

- [ ] **Step 5: Commit**

```bash
git add lib/tools/read-canvas-artifact.ts lib/tools/__tests__/canvas-tools.test.ts
git commit -m "feat(canvas): add readCanvasArtifact tool with tests"
```

---

### Task 2: Register in type system and constants

**Files:**

- Modify: `lib/types/agent.ts:9-106`
- Modify: `lib/canvas/constants.ts:32-35`

- [ ] **Step 1: Add to `ResearcherTools` type**

In `lib/types/agent.ts`, add the import (after line 22):

```ts
import type { readCanvasArtifactTool } from '../tools/read-canvas-artifact'
```

Add to the `ResearcherTools` type (after line 38):

```ts
readCanvasArtifact: ReturnType<typeof readCanvasArtifactTool>
```

Add the invocation type (after line 90, below the closing `>` of `UpdateCanvasArtifactToolInvocation`):

```ts
export type ReadCanvasArtifactToolInvocation = UIToolInvocation<
  ResearcherTools['readCanvasArtifact']
>
```

Add to the `ResearcherToolInvocation` union (after `UpdateCanvasArtifactToolInvocation`):

```ts
  | ReadCanvasArtifactToolInvocation
```

- [ ] **Step 2: Add to `CANVAS_TOOL_NAMES`**

In `lib/canvas/constants.ts`, update lines 32-35:

```ts
export const CANVAS_TOOL_NAMES = [
  'createCanvasArtifact',
  'updateCanvasArtifact',
  'readCanvasArtifact'
] as const
```

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: No new errors (the tool isn't registered in researcher yet, but types are structurally compatible)

- [ ] **Step 4: Commit**

```bash
git add lib/types/agent.ts lib/canvas/constants.ts
git commit -m "feat(canvas): add readCanvasArtifact to type system and constants"
```

---

### Task 3: Register in researcher agent

**Files:**

- Modify: `lib/agents/researcher.ts:13,169-185`
- Modify: `lib/agents/__tests__/researcher.test.ts:5-14,240-300`

- [ ] **Step 1: Update researcher test expectations**

In `lib/agents/__tests__/researcher.test.ts`:

Add mock (after line 13):

```ts
vi.mock('@/lib/tools/read-canvas-artifact', () => ({
  readCanvasArtifactTool: vi
    .fn()
    .mockReturnValue({ name: 'readCanvasArtifact' })
}))
```

Update test `'registers canvas tools when canvasToolContext is provided'` (line 240) — add assertions:

```ts
expect(Object.keys(config.tools)).toContain('readCanvasArtifact')
expect(config.activeTools).toContain('readCanvasArtifact')
```

Update test `'does not register canvas tools when canvasToolContext is absent'` (line 256) — add assertions:

```ts
expect(Object.keys(config.tools)).not.toContain('readCanvasArtifact')
expect(config.activeTools).not.toContain('readCanvasArtifact')
```

Update test `'registers canvas tools in both chat and research modes'` (line 271) — add assertion inside the loop:

```ts
expect(config.activeTools).toContain('readCanvasArtifact')
```

Update test `'includes current canvas artifact state in instructions when available'` (line 209) — add assertion for the new hint:

```ts
expect(config.instructions).toContain(
  'call readCanvasArtifact to fetch the latest source before updating'
)
```

- [ ] **Step 2: Run researcher tests to verify they fail**

Run: `bun run test -- lib/agents/__tests__/researcher.test.ts`
Expected: FAIL — `readCanvasArtifact` not found in tools/activeTools

- [ ] **Step 3: Wire up the tool in researcher.ts**

In `lib/agents/researcher.ts`:

Add import (after line 13):

```ts
import { readCanvasArtifactTool } from '../tools/read-canvas-artifact'
```

Update canvas tools object (lines 174-179):

```ts
const canvasTools = canvasToolContext
  ? {
      createCanvasArtifact: createCanvasArtifactTool(canvasToolContext),
      updateCanvasArtifact: updateCanvasArtifactTool(canvasToolContext),
      readCanvasArtifact: readCanvasArtifactTool(canvasToolContext)
    }
  : {}
```

Update activeToolsList push (lines 182-185):

```ts
if (canvasToolContext) {
  activeToolsList.push(
    'createCanvasArtifact' as keyof ResearcherTools,
    'updateCanvasArtifact' as keyof ResearcherTools,
    'readCanvasArtifact' as keyof ResearcherTools
  )
}
```

Update instructions injection (lines 169-171) — add hint for the LLM:

```ts
if (canvasToolContext?.currentArtifact) {
  instructions += `\n\nCurrent canvas artifact state:\n- artifactId: ${canvasToolContext.currentArtifact.artifactId}\n- baseRevision: ${canvasToolContext.currentArtifact.draftRevision}\nIf the artifact source code is not in the conversation above, call readCanvasArtifact to fetch the latest source before updating.`
}
```

- [ ] **Step 4: Run researcher tests to verify they pass**

Run: `bun run test -- lib/agents/__tests__/researcher.test.ts`
Expected: All tests PASS

- [ ] **Step 5: Commit**

```bash
git add lib/agents/researcher.ts lib/agents/__tests__/researcher.test.ts
git commit -m "feat(canvas): register readCanvasArtifact in researcher agent"
```

---

### Task 4: Update system prompts

**Files:**

- Modify: `lib/agents/prompts/search-mode-prompts.ts:57-108,119-124,336-344`

- [ ] **Step 1: Add tool documentation to `getCanvasArtifactsPrompt()`**

In `lib/agents/prompts/search-mode-prompts.ts`, inside `getCanvasArtifactsPrompt()`, after the `updateCanvasArtifact` block (after line 79), add:

```
**readCanvasArtifact** — Read the current source files of the existing artifact:
- Use BEFORE updating when the artifact code is not in the conversation context
- Returns the latest persisted source files, title, status, and draftRevision
- Call this first, then use the returned files and draftRevision to call updateCanvasArtifact
```

- [ ] **Step 2: Update MODIFY/UPDATE routing in chat mode prompt**

In the `getChatModePrompt()` function, update the MODIFY/UPDATE intent routing line (line 122). Change:

```
- **MODIFY/UPDATE request** — the user wants to change, fix, improve, or add to an existing artifact → **Skip search.** CALL the \`updateCanvasArtifact\` tool with the current artifact state.
```

To:

```
- **MODIFY/UPDATE request** — the user wants to change, fix, improve, or add to an existing artifact → **Skip search.** If the artifact source code is not in the conversation context, CALL \`readCanvasArtifact\` first. Then CALL \`updateCanvasArtifact\` with the full replacement file set.
```

- [ ] **Step 3: Update MODIFY/UPDATE routing in research mode prompt**

In the `getResearchModePrompt()` function, update the MODIFY/UPDATE intent routing line (line 339). Change:

```
- **MODIFY/UPDATE request** — the user wants to change, fix, improve, or add to an existing artifact → **Skip search.** CALL the \`updateCanvasArtifact\` tool with the current artifact state.
```

To:

```
- **MODIFY/UPDATE request** — the user wants to change, fix, improve, or add to an existing artifact → **Skip search.** If the artifact source code is not in the conversation context, CALL \`readCanvasArtifact\` first. Then CALL \`updateCanvasArtifact\` with the full replacement file set.
```

- [ ] **Step 4: Commit**

```bash
git add lib/agents/prompts/search-mode-prompts.ts
git commit -m "feat(canvas): document readCanvasArtifact in system prompts"
```

---

### Task 5: Verify everything

- [ ] **Step 1: Run full test suite**

Run: `bun run test`
Expected: All tests PASS

- [ ] **Step 2: Run lint**

Run: `bun lint`
Expected: No errors or warnings

- [ ] **Step 3: Run typecheck**

Run: `bun typecheck`
Expected: No errors

- [ ] **Step 4: Fix any issues found in steps 1-3**

If any lint/type/test issues, fix them before proceeding.

- [ ] **Step 5: Final commit (if fixes were needed)**

```bash
git add -A
git commit -m "fix(canvas): resolve lint/type issues from readCanvasArtifact"
```

# AI SDK Phase 3 — Display Tool Directory Migration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the five remaining flat-file display tools (`display-callout`, `display-plan`, `display-timeline`, `display-table`, `display-chart`) from single `.ts` files to the established directory pattern, satisfying Workstream 3 of `docs/superpowers/plans/2026-04-27-ai-sdk-contract-standardization-phase-3.md`.

**Architecture:** Each migrated tool becomes a directory `lib/tools/<name>/{schema,server,result,index}.ts` exporting `{ toolName, inputSchema, outputSchema, serverTool, ResultComponent, tryRenderResult }`. The original flat file `lib/tools/<name>.ts` is replaced by a pure re-export shim that mirrors `lib/tools/display-question-wizard.ts`, keeping the named export `display<Name>Tool` intact. Three callers move from inline rendering to the shared shim: `lib/agents/chat/toolset.ts` (import `serverTool` from the new path), `components/tool-ui/registry.tsx` (replace inline `tryRender` with the directory's `tryRenderResult`), and `lib/tools/__tests__/module-contract.test.ts` (add an entry for each migrated tool, which is the TDD parity gate). `display-geo-map` is explicitly out of scope for this slice.

**Tech Stack:** TypeScript (strict), Vitest, Zod, AI SDK `tool()`, React 19 (`result.tsx` is a `'use client'` module wrapping existing client components).

---

## File Structure

For each of the five tools, the migration creates four files under a new directory and converts the flat file into a shim.

| Tool     | New directory                 | Existing flat → becomes shim    | UI schema (unchanged)                     |
| -------- | ----------------------------- | ------------------------------- | ----------------------------------------- |
| Callout  | `lib/tools/display-callout/`  | `lib/tools/display-callout.ts`  | `components/tool-ui/callout/schema.ts`    |
| Plan     | `lib/tools/display-plan/`     | `lib/tools/display-plan.ts`     | `components/tool-ui/plan/schema.ts`       |
| Timeline | `lib/tools/display-timeline/` | `lib/tools/display-timeline.ts` | `components/tool-ui/timeline/schema.ts`   |
| Table    | `lib/tools/display-table/`    | `lib/tools/display-table.ts`    | `components/tool-ui/data-table/schema.ts` |
| Chart    | `lib/tools/display-chart/`    | `lib/tools/display-chart.ts`    | `components/tool-ui/chart/schema.ts`      |

### Files modified per tool (same shape every time)

- **Create:** `lib/tools/<name>/schema.ts` — exports `toolName`, `inputSchema`, `outputSchema`, types
- **Create:** `lib/tools/<name>/server.ts` — exports `serverTool` (the `tool()` factory)
- **Create:** `lib/tools/<name>/result.tsx` — exports `ResultComponent`, `tryRenderResult`; imports the existing UI component and `safeParseSerializable*` from `components/tool-ui/<name>/`
- **Create:** `lib/tools/<name>/index.ts` — barrel re-export
- **Modify:** `lib/tools/<name>.ts` — replace the entire file with a pure re-export shim
- **Modify:** `lib/agents/chat/toolset.ts` — switch the `display<Name>Tool` import to `import { serverTool as display<Name>Tool } from '@/lib/tools/<name>/server'`
- **Modify:** `components/tool-ui/registry.tsx` — import `tryRender<Name>Result` from `@/lib/tools/<name>/result` and replace the inline `tryRender` body with it
- **Modify:** `lib/tools/__tests__/module-contract.test.ts` — append a row to the `modules` array

### Order of execution (smallest → largest)

1. `display-callout` (28 lines, simplest schema)
2. `display-plan` (31 lines, nested todos)
3. `display-timeline` (40 lines, nested events)
4. `display-table` (74 lines, format + column schemas)
5. `display-chart` (114 lines, includes `superRefine`)

Each migration is a self-contained commit and must leave `bun typecheck` and `bun run test -- --run lib/tools/__tests__/module-contract.test.ts` green before the next begins.

---

## Task 1: Create branch + verify clean baseline

**Files:** none modified — just bookkeeping.

- [ ] **Step 1: Confirm clean working tree on `main`**

Run: `git status`
Expected: `On branch main` and `nothing to commit, working tree clean`. If not clean, stop and resolve before continuing.

- [ ] **Step 2: Create feature branch**

Run: `git checkout -b ai-sdk-phase-3-display-tools`
Expected: `Switched to a new branch 'ai-sdk-phase-3-display-tools'`

- [ ] **Step 3: Verify baseline tests pass**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: all tests pass (the four already-migrated tools — `display-citations`, `display-link-preview`, `display-option-list`, `display-question-wizard` — plus the canvas/fetch/search/generate-image entries).

- [ ] **Step 4: Verify baseline typecheck passes**

Run: `bun typecheck`
Expected: exit 0, no errors.

---

## Task 2: Migrate `display-callout`

**Files:**

- Create: `lib/tools/display-callout/schema.ts`
- Create: `lib/tools/display-callout/server.ts`
- Create: `lib/tools/display-callout/result.tsx`
- Create: `lib/tools/display-callout/index.ts`
- Modify: `lib/tools/display-callout.ts` (replace contents with shim)
- Modify: `lib/agents/chat/toolset.ts:5` (import path)
- Modify: `components/tool-ui/registry.tsx:13-14, 148-160` (replace inline render)
- Modify: `lib/tools/__tests__/module-contract.test.ts` (add modules entry)

- [ ] **Step 1: Add `display-callout` row to module-contract test (failing test)**

Edit `lib/tools/__tests__/module-contract.test.ts`. Find the `modules` array (around line 15). Append a new tuple after the `display-link-preview` entry:

```ts
  [
    'display-link-preview',
    () => import('@/lib/tools/display-link-preview'),
    () => import('@/lib/tools/display-link-preview/index')
  ],
  [
    'display-callout',
    () => import('@/lib/tools/display-callout'),
    () => import('@/lib/tools/display-callout/index')
  ],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: FAIL on `display-callout exposes a folder index module contract` with module-not-found for `@/lib/tools/display-callout/index`. The compatibility-module test will also fail because the flat file currently exports `displayCalloutTool` rather than `serverTool`/`toolName`/`inputSchema`/`outputSchema`.

- [ ] **Step 3: Create `lib/tools/display-callout/schema.ts`**

```ts
import { z } from 'zod'

export const toolName = 'displayCallout' as const

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this callout'),
  variant: z
    .enum(['info', 'warning', 'tip', 'success', 'error', 'definition'])
    .describe(
      'Visual style: "info" for general highlights, "warning" for cautions/deprecations, "tip" for pro tips/best practices, "success" for confirmations, "error" for critical issues, "definition" for key term definitions'
    ),
  title: z
    .string()
    .optional()
    .describe(
      'Short heading for the callout (omit for simple single-line notes)'
    ),
  content: z
    .string()
    .min(1)
    .describe('The callout body text. Keep to 1-3 sentences')
})

export const outputSchema = inputSchema

export type DisplayCalloutInput = z.infer<typeof inputSchema>
export type DisplayCalloutOutput = z.infer<typeof outputSchema>
```

- [ ] **Step 4: Create `lib/tools/display-callout/server.ts`**

```ts
import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a styled callout box to highlight critical information. Use for warnings (deprecated APIs, breaking changes), tips (best practices, pro tips), definitions (key term explanations), success confirmations, error alerts, or important notes that should stand out from the main text. Keep content concise — one to three sentences.',
  inputSchema,
  execute: async params => params
})
```

- [ ] **Step 5: Create `lib/tools/display-callout/result.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { Callout } from '@/components/tool-ui/callout/callout'
import { safeParseSerializableCallout } from '@/components/tool-ui/callout/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Callout

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableCallout(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Callout">
      <ToolCardMount partId={partId}>
        <Callout {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
```

- [ ] **Step 6: Create `lib/tools/display-callout/index.ts`**

```ts
export { ResultComponent, tryRenderResult } from './result'
export type { DisplayCalloutInput, DisplayCalloutOutput } from './schema'
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

- [ ] **Step 7: Replace `lib/tools/display-callout.ts` with a pure re-export shim**

Overwrite the entire file contents with:

```ts
export type {
  DisplayCalloutInput,
  DisplayCalloutOutput
} from './display-callout/schema'
export {
  inputSchema as displayCalloutInputSchema,
  outputSchema as displayCalloutOutputSchema,
  toolName as displayCalloutToolName,
  inputSchema,
  outputSchema,
  toolName
} from './display-callout/schema'
export {
  serverTool as displayCalloutTool,
  serverTool
} from './display-callout/server'
```

This is required by the `remains a pure compatibility re-export` assertion in `lib/tools/__tests__/module-contract.test.ts` — the file must contain no `function`, `async`, `const`, or `tool(` tokens, and must start with `export `.

- [ ] **Step 8: Update `lib/agents/chat/toolset.ts` callout import**

Find line 5:

```ts
import { displayCalloutTool } from '@/lib/tools/display-callout'
```

Replace with:

```ts
import { serverTool as displayCalloutTool } from '@/lib/tools/display-callout/server'
```

This matches the pattern already used for `displayCitationsTool`, `displayLinkPreviewTool`, etc. (lines 7, 9, 10, 12).

- [ ] **Step 9: Update `components/tool-ui/registry.tsx` to use `tryRenderResult`**

In the imports block at the top of the file (currently lines 5-9), append:

```ts
import { tryRenderResult as tryRenderDisplayCalloutResult } from '@/lib/tools/display-callout/result'
```

Then remove the inline `Callout`/`safeParseSerializableCallout` imports (currently lines 13-14):

```ts
import { Callout } from './callout/callout'
import { safeParseSerializableCallout } from './callout/schema'
```

Then replace the `displayCallout` registry entry (currently lines 148-160) with the simpler form:

```ts
  {
    name: 'displayCallout',
    tryRender: tryRenderDisplayCalloutResult
  },
```

This mirrors the `displayCitations` (line 112-114) and `displayLinkPreview` (line 116-118) entries.

- [ ] **Step 10: Run module-contract test to verify it passes**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: all tests pass — including the three new assertions for `display-callout` (compatibility module, folder index, pure compatibility re-export).

- [ ] **Step 11: Run typecheck**

Run: `bun typecheck`
Expected: exit 0, no errors.

- [ ] **Step 12: Run registry tests**

Run: `bun run test -- --run components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx`
Expected: all tests pass. The registry behavior is unchanged — only the source of `tryRender` has moved.

- [ ] **Step 13: Commit**

```bash
git add lib/tools/display-callout lib/tools/display-callout.ts lib/agents/chat/toolset.ts components/tool-ui/registry.tsx lib/tools/__tests__/module-contract.test.ts
git commit -m "$(cat <<'EOF'
refactor(tools): migrate display-callout to directory pattern

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate `display-plan`

**Files:**

- Create: `lib/tools/display-plan/schema.ts`
- Create: `lib/tools/display-plan/server.ts`
- Create: `lib/tools/display-plan/result.tsx`
- Create: `lib/tools/display-plan/index.ts`
- Modify: `lib/tools/display-plan.ts` (replace contents with shim)
- Modify: `lib/agents/chat/toolset.ts:11` (import path)
- Modify: `components/tool-ui/registry.tsx` (replace `displayPlan` inline render)
- Modify: `lib/tools/__tests__/module-contract.test.ts` (add modules entry)

- [ ] **Step 1: Add `display-plan` row to module-contract test (failing test)**

Edit `lib/tools/__tests__/module-contract.test.ts`. Append a new tuple after the `display-callout` entry:

```ts
  [
    'display-callout',
    () => import('@/lib/tools/display-callout'),
    () => import('@/lib/tools/display-callout/index')
  ],
  [
    'display-plan',
    () => import('@/lib/tools/display-plan'),
    () => import('@/lib/tools/display-plan/index')
  ],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: FAIL on `display-plan exposes a folder index module contract` (module not found).

- [ ] **Step 3: Create `lib/tools/display-plan/schema.ts`**

```ts
import { z } from 'zod'

export const toolName = 'displayPlan' as const

const PlanTodoSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this step'),
  label: z.string().min(1).describe('Short description of the step'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .describe('Current status of the step'),
  description: z
    .string()
    .optional()
    .describe('Detailed description (shown on expand)')
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this plan'),
  title: z.string().min(1).describe('Plan title'),
  description: z.string().optional().describe('Brief plan description'),
  todos: z
    .array(PlanTodoSchema)
    .min(1)
    .describe('Steps in the plan with their statuses')
})

export const outputSchema = inputSchema

export type DisplayPlanInput = z.infer<typeof inputSchema>
export type DisplayPlanOutput = z.infer<typeof outputSchema>
```

- [ ] **Step 4: Create `lib/tools/display-plan/server.ts`**

```ts
import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a visual step-by-step guide or how-to checklist for the user to follow. Use ONLY for instructional content like tutorials, guides, or learning paths — NOT for research planning or task tracking. Each step has a status indicator.',
  inputSchema,
  execute: async params => params
})
```

- [ ] **Step 5: Create `lib/tools/display-plan/result.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { Plan } from '@/components/tool-ui/plan/plan'
import { safeParseSerializablePlan } from '@/components/tool-ui/plan/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Plan

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializablePlan(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Plan">
      <ToolCardMount partId={partId}>
        <Plan {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
```

- [ ] **Step 6: Create `lib/tools/display-plan/index.ts`**

```ts
export { ResultComponent, tryRenderResult } from './result'
export type { DisplayPlanInput, DisplayPlanOutput } from './schema'
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

- [ ] **Step 7: Replace `lib/tools/display-plan.ts` with a pure re-export shim**

Overwrite the entire file with:

```ts
export type { DisplayPlanInput, DisplayPlanOutput } from './display-plan/schema'
export {
  inputSchema as displayPlanInputSchema,
  outputSchema as displayPlanOutputSchema,
  toolName as displayPlanToolName,
  inputSchema,
  outputSchema,
  toolName
} from './display-plan/schema'
export {
  serverTool as displayPlanTool,
  serverTool
} from './display-plan/server'
```

- [ ] **Step 8: Update `lib/agents/chat/toolset.ts` plan import**

Find line 11:

```ts
import { displayPlanTool } from '@/lib/tools/display-plan'
```

Replace with:

```ts
import { serverTool as displayPlanTool } from '@/lib/tools/display-plan/server'
```

- [ ] **Step 9: Update `components/tool-ui/registry.tsx` to use `tryRenderResult`**

In the imports block, append (alongside the callout import added in Task 2):

```ts
import { tryRenderResult as tryRenderDisplayPlanResult } from '@/lib/tools/display-plan/result'
```

Remove the inline imports for `Plan` and `safeParseSerializablePlan`:

```ts
import { Plan } from './plan/plan'
import { safeParseSerializablePlan } from './plan/schema'
```

Replace the `displayPlan` entry in the `entries` array (currently lines 41-54) with:

```ts
  {
    name: 'displayPlan',
    tryRender: tryRenderDisplayPlanResult
  },
```

- [ ] **Step 10: Run module-contract test to verify it passes**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: all tests pass — including the three new assertions for `display-plan`.

- [ ] **Step 11: Run typecheck**

Run: `bun typecheck`
Expected: exit 0.

- [ ] **Step 12: Run registry tests**

Run: `bun run test -- --run components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add lib/tools/display-plan lib/tools/display-plan.ts lib/agents/chat/toolset.ts components/tool-ui/registry.tsx lib/tools/__tests__/module-contract.test.ts
git commit -m "$(cat <<'EOF'
refactor(tools): migrate display-plan to directory pattern

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Migrate `display-timeline`

**Files:**

- Create: `lib/tools/display-timeline/schema.ts`
- Create: `lib/tools/display-timeline/server.ts`
- Create: `lib/tools/display-timeline/result.tsx`
- Create: `lib/tools/display-timeline/index.ts`
- Modify: `lib/tools/display-timeline.ts` (replace contents with shim)
- Modify: `lib/agents/chat/toolset.ts:14` (import path)
- Modify: `components/tool-ui/registry.tsx` (replace `displayTimeline` inline render)
- Modify: `lib/tools/__tests__/module-contract.test.ts` (add modules entry)

- [ ] **Step 1: Add `display-timeline` row to module-contract test (failing test)**

Edit `lib/tools/__tests__/module-contract.test.ts`. Append after the `display-plan` entry:

```ts
  [
    'display-timeline',
    () => import('@/lib/tools/display-timeline'),
    () => import('@/lib/tools/display-timeline/index')
  ],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: FAIL on `display-timeline exposes a folder index module contract` (module not found).

- [ ] **Step 3: Create `lib/tools/display-timeline/schema.ts`**

```ts
import { z } from 'zod'

export const toolName = 'displayTimeline' as const

const TimelineEventSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this event'),
  date: z
    .string()
    .min(1)
    .describe(
      'Date or time period label. Flexible format: "2024", "March 2024", "2024-03-15", "Q3 2023", "1990s", etc.'
    ),
  title: z.string().min(1).describe('Short headline for this event'),
  description: z
    .string()
    .optional()
    .describe('Brief supporting detail (1-2 sentences)'),
  category: z
    .enum(['milestone', 'event', 'release', 'announcement', 'default'])
    .optional()
    .describe(
      'Visual category: "milestone" for major turning points, "release" for product/version launches, "announcement" for news/reveals, "event" for notable occurrences, "default" for general entries'
    )
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this timeline'),
  title: z.string().min(1).describe('Timeline heading'),
  description: z.string().optional().describe('Brief context for the timeline'),
  events: z
    .array(TimelineEventSchema)
    .min(1)
    .describe('Chronologically ordered events to display')
})

export const outputSchema = inputSchema

export type DisplayTimelineInput = z.infer<typeof inputSchema>
export type DisplayTimelineOutput = z.infer<typeof outputSchema>
```

- [ ] **Step 4: Create `lib/tools/display-timeline/server.ts`**

```ts
import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a vertical timeline of chronological events. Use for histories ("history of X"), event sequences ("what happened with Y"), version histories, project milestones, biographical timelines, or any temporal progression. Events should be in chronological order. Keep to 3-10 events for readability.',
  inputSchema,
  execute: async params => params
})
```

- [ ] **Step 5: Create `lib/tools/display-timeline/result.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { safeParseSerializableTimeline } from '@/components/tool-ui/timeline/schema'
import { Timeline } from '@/components/tool-ui/timeline/timeline'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Timeline

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableTimeline(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Timeline">
      <ToolCardMount partId={partId}>
        <Timeline {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
```

- [ ] **Step 6: Create `lib/tools/display-timeline/index.ts`**

```ts
export { ResultComponent, tryRenderResult } from './result'
export type { DisplayTimelineInput, DisplayTimelineOutput } from './schema'
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

- [ ] **Step 7: Replace `lib/tools/display-timeline.ts` with a pure re-export shim**

Overwrite the entire file with:

```ts
export type {
  DisplayTimelineInput,
  DisplayTimelineOutput
} from './display-timeline/schema'
export {
  inputSchema as displayTimelineInputSchema,
  outputSchema as displayTimelineOutputSchema,
  toolName as displayTimelineToolName,
  inputSchema,
  outputSchema,
  toolName
} from './display-timeline/schema'
export {
  serverTool as displayTimelineTool,
  serverTool
} from './display-timeline/server'
```

- [ ] **Step 8: Update `lib/agents/chat/toolset.ts` timeline import**

Find line 14:

```ts
import { displayTimelineTool } from '@/lib/tools/display-timeline'
```

Replace with:

```ts
import { serverTool as displayTimelineTool } from '@/lib/tools/display-timeline/server'
```

- [ ] **Step 9: Update `components/tool-ui/registry.tsx` to use `tryRenderResult`**

Append to imports:

```ts
import { tryRenderResult as tryRenderDisplayTimelineResult } from '@/lib/tools/display-timeline/result'
```

Remove the inline imports:

```ts
import { safeParseSerializableTimeline } from './timeline/schema'
import { Timeline } from './timeline/timeline'
```

Replace the `displayTimeline` registry entry (currently lines 162-174) with:

```ts
  {
    name: 'displayTimeline',
    tryRender: tryRenderDisplayTimelineResult
  },
```

- [ ] **Step 10: Run module-contract test to verify it passes**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: all tests pass.

- [ ] **Step 11: Run typecheck**

Run: `bun typecheck`
Expected: exit 0.

- [ ] **Step 12: Run registry tests**

Run: `bun run test -- --run components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add lib/tools/display-timeline lib/tools/display-timeline.ts lib/agents/chat/toolset.ts components/tool-ui/registry.tsx lib/tools/__tests__/module-contract.test.ts
git commit -m "$(cat <<'EOF'
refactor(tools): migrate display-timeline to directory pattern

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Migrate `display-table`

**Files:**

- Create: `lib/tools/display-table/schema.ts`
- Create: `lib/tools/display-table/server.ts`
- Create: `lib/tools/display-table/result.tsx`
- Create: `lib/tools/display-table/index.ts`
- Modify: `lib/tools/display-table.ts` (replace contents with shim)
- Modify: `lib/agents/chat/toolset.ts:13` (import path)
- Modify: `components/tool-ui/registry.tsx` (replace `displayTable` inline render)
- Modify: `lib/tools/__tests__/module-contract.test.ts` (add modules entry)

- [ ] **Step 1: Add `display-table` row to module-contract test (failing test)**

Edit `lib/tools/__tests__/module-contract.test.ts`. Append after the `display-timeline` entry:

```ts
  [
    'display-table',
    () => import('@/lib/tools/display-table'),
    () => import('@/lib/tools/display-table/index')
  ],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: FAIL on `display-table exposes a folder index module contract`.

- [ ] **Step 3: Create `lib/tools/display-table/schema.ts`**

```ts
import { z } from 'zod'

export const toolName = 'displayTable' as const

const FormatSchema = z
  .object({
    kind: z
      .string()
      .describe(
        'Format type: text | number | currency | percent | date | delta | boolean | link | badge | status | array'
      )
  })
  .passthrough()

const ColumnSchema = z.object({
  key: z.string().describe('Key in row data to display'),
  label: z.string().describe('Column header label'),
  sortable: z.boolean().optional().describe('Whether column is sortable'),
  align: z.enum(['left', 'right', 'center']).optional(),
  hidden: z
    .boolean()
    .optional()
    .describe(
      'Hide this column from the rendered table. Use for helper columns whose values are referenced by a sibling link column via format.hrefKey.'
    ),
  format: FormatSchema.optional().describe('Value formatting configuration')
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this table'),
  columns: z
    .array(ColumnSchema)
    .min(1)
    .describe('Column definitions with keys and labels'),
  data: z
    .array(
      z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()])
      )
    )
    .describe('Row data as array of objects'),
  rowIdKey: z
    .string()
    .optional()
    .describe(
      'Key in row data to use as unique row identifier for stable rendering (e.g. "id", "name")'
    ),
  defaultSort: z
    .object({
      by: z.string().optional(),
      direction: z.enum(['asc', 'desc']).optional()
    })
    .optional()
    .describe('Default sort configuration')
})

export const outputSchema = inputSchema

export type DisplayTableInput = z.infer<typeof inputSchema>
export type DisplayTableOutput = z.infer<typeof outputSchema>
```

> The permissive `FormatSchema` (`.passthrough()`) is preserved verbatim. The AI often produces format configs that don't match strict schemas; the UI layer handles graceful degradation. Do not tighten this here.

- [ ] **Step 4: Create `lib/tools/display-table/server.ts`**

```ts
import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display data in a rich, sortable table with formatted columns. Use when presenting structured/tabular data like comparisons, statistics, prices, or lists with multiple attributes.',
  inputSchema,
  execute: async params => params
})
```

- [ ] **Step 5: Create `lib/tools/display-table/result.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { DataTable } from '@/components/tool-ui/data-table/data-table'
import { safeParseSerializableDataTable } from '@/components/tool-ui/data-table/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = DataTable

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableDataTable(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="DataTable">
      <ToolCardMount partId={partId}>
        <DataTable {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
```

- [ ] **Step 6: Create `lib/tools/display-table/index.ts`**

```ts
export { ResultComponent, tryRenderResult } from './result'
export type { DisplayTableInput, DisplayTableOutput } from './schema'
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

- [ ] **Step 7: Replace `lib/tools/display-table.ts` with a pure re-export shim**

Overwrite the entire file with:

```ts
export type {
  DisplayTableInput,
  DisplayTableOutput
} from './display-table/schema'
export {
  inputSchema as displayTableInputSchema,
  outputSchema as displayTableOutputSchema,
  toolName as displayTableToolName,
  inputSchema,
  outputSchema,
  toolName
} from './display-table/schema'
export {
  serverTool as displayTableTool,
  serverTool
} from './display-table/server'
```

- [ ] **Step 8: Update `lib/agents/chat/toolset.ts` table import**

Find line 13:

```ts
import { displayTableTool } from '@/lib/tools/display-table'
```

Replace with:

```ts
import { serverTool as displayTableTool } from '@/lib/tools/display-table/server'
```

- [ ] **Step 9: Update `components/tool-ui/registry.tsx` to use `tryRenderResult`**

Append to imports:

```ts
import { tryRenderResult as tryRenderDisplayTableResult } from '@/lib/tools/display-table/result'
```

Remove the inline imports:

```ts
import { DataTable } from './data-table/data-table'
import { safeParseSerializableDataTable } from './data-table/schema'
```

Replace the `displayTable` registry entry (currently lines 56-68) with:

```ts
  {
    name: 'displayTable',
    tryRender: tryRenderDisplayTableResult
  },
```

- [ ] **Step 10: Run module-contract test to verify it passes**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: all tests pass.

- [ ] **Step 11: Run typecheck**

Run: `bun typecheck`
Expected: exit 0.

- [ ] **Step 12: Run registry and data-table tests**

Run: `bun run test -- --run components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx components/tool-ui/data-table/data-table.test.tsx`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add lib/tools/display-table lib/tools/display-table.ts lib/agents/chat/toolset.ts components/tool-ui/registry.tsx lib/tools/__tests__/module-contract.test.ts
git commit -m "$(cat <<'EOF'
refactor(tools): migrate display-table to directory pattern

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Migrate `display-chart`

**Files:**

- Create: `lib/tools/display-chart/schema.ts`
- Create: `lib/tools/display-chart/server.ts`
- Create: `lib/tools/display-chart/result.tsx`
- Create: `lib/tools/display-chart/index.ts`
- Modify: `lib/tools/display-chart.ts` (replace contents with shim)
- Modify: `lib/agents/chat/toolset.ts:6` (import path)
- Modify: `components/tool-ui/registry.tsx` (replace `displayChart` inline render)
- Modify: `lib/tools/__tests__/module-contract.test.ts` (add modules entry)

- [ ] **Step 1: Add `display-chart` row to module-contract test (failing test)**

Edit `lib/tools/__tests__/module-contract.test.ts`. Append after the `display-table` entry:

```ts
  [
    'display-chart',
    () => import('@/lib/tools/display-chart'),
    () => import('@/lib/tools/display-chart/index')
  ],
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: FAIL on `display-chart exposes a folder index module contract`.

- [ ] **Step 3: Create `lib/tools/display-chart/schema.ts`**

```ts
import { z } from 'zod'

export const toolName = 'displayChart' as const

const ChartSeriesSchema = z.object({
  key: z.string().min(1).describe('Key in each data row for the Y-axis value'),
  label: z
    .string()
    .min(1)
    .describe('Human-readable label shown in legend/tooltip'),
  color: z.string().optional().describe('CSS color override for this series')
})

export const inputSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this chart'),
    type: z
      .enum(['bar', 'line'])
      .describe(
        'Chart type: "bar" for comparisons/categories, "line" for trends over time'
      ),
    title: z.string().optional().describe('Chart title'),
    description: z.string().optional().describe('Brief chart description'),
    data: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .describe(
        'Array of data rows, each row is an object with keys for xKey and series keys'
      ),
    xKey: z
      .string()
      .min(1)
      .describe('Key in each data row for the X-axis category/time value'),
    series: z
      .array(ChartSeriesSchema)
      .min(1)
      .describe('One or more data series to plot'),
    colors: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe('Color palette applied to series in order'),
    showLegend: z
      .boolean()
      .optional()
      .describe('Show legend below the chart (default false)'),
    showGrid: z
      .boolean()
      .optional()
      .describe('Show horizontal grid lines (default true)')
  })
  .superRefine((value, ctx) => {
    const seenSeriesKeys = new Set<string>()
    value.series.forEach((series, index) => {
      if (seenSeriesKeys.has(series.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['series', index, 'key'],
          message: `Duplicate series key "${series.key}".`
        })
        return
      }
      seenSeriesKeys.add(series.key)
    })

    value.data.forEach((row, rowIndex) => {
      if (!(value.xKey in row)) {
        ctx.addIssue({
          code: 'custom',
          path: ['data', rowIndex, value.xKey],
          message: `Missing xKey "${value.xKey}" in data row.`
        })
      } else {
        const xVal = row[value.xKey]
        const isValidX = typeof xVal === 'string' || typeof xVal === 'number'
        if (!isValidX) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', rowIndex, value.xKey],
            message: `Expected "${value.xKey}" to be a string or number.`
          })
        }
      }

      value.series.forEach(series => {
        if (!(series.key in row)) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', rowIndex, series.key],
            message: `Missing series key "${series.key}" in data row.`
          })
          return
        }

        const yVal = row[series.key]
        if (yVal === null) {
          return
        }
        if (typeof yVal !== 'number' || !Number.isFinite(yVal)) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', rowIndex, series.key],
            message: `Expected "${series.key}" to be a finite number (or null).`
          })
        }
      })
    })
  })

export const outputSchema = inputSchema

export type DisplayChartInput = z.infer<typeof inputSchema>
export type DisplayChartOutput = z.infer<typeof outputSchema>
```

> Preserve `superRefine` verbatim — it enforces unique series keys and that each data row contains the declared `xKey` plus every series key with a finite number (or null). Tightening this can break in-flight chart payloads.

- [ ] **Step 4: Create `lib/tools/display-chart/server.ts`**

```ts
import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display data as a bar or line chart. Use for visualizing trends over time, comparisons between categories, distributions, or any numeric data that benefits from visual representation. Prefer line charts for time series and bar charts for categorical comparisons.',
  inputSchema,
  execute: async params => params
})
```

- [ ] **Step 5: Create `lib/tools/display-chart/result.tsx`**

```tsx
'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { Chart } from '@/components/tool-ui/chart/chart'
import { safeParseSerializableChart } from '@/components/tool-ui/chart/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = Chart

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableChart(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="Chart">
      <ToolCardMount partId={partId}>
        <Chart {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
```

- [ ] **Step 6: Create `lib/tools/display-chart/index.ts`**

```ts
export { ResultComponent, tryRenderResult } from './result'
export type { DisplayChartInput, DisplayChartOutput } from './schema'
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

- [ ] **Step 7: Replace `lib/tools/display-chart.ts` with a pure re-export shim**

Overwrite the entire file with:

```ts
export type {
  DisplayChartInput,
  DisplayChartOutput
} from './display-chart/schema'
export {
  inputSchema as displayChartInputSchema,
  outputSchema as displayChartOutputSchema,
  toolName as displayChartToolName,
  inputSchema,
  outputSchema,
  toolName
} from './display-chart/schema'
export {
  serverTool as displayChartTool,
  serverTool
} from './display-chart/server'
```

- [ ] **Step 8: Update `lib/agents/chat/toolset.ts` chart import**

Find line 6:

```ts
import { displayChartTool } from '@/lib/tools/display-chart'
```

Replace with:

```ts
import { serverTool as displayChartTool } from '@/lib/tools/display-chart/server'
```

- [ ] **Step 9: Update `components/tool-ui/registry.tsx` to use `tryRenderResult`**

Append to imports:

```ts
import { tryRenderResult as tryRenderDisplayChartResult } from '@/lib/tools/display-chart/result'
```

Remove the inline imports:

```ts
import { Chart } from './chart/chart'
import { safeParseSerializableChart } from './chart/schema'
```

Replace the `displayChart` registry entry (currently lines 84-96) with:

```ts
  {
    name: 'displayChart',
    tryRender: tryRenderDisplayChartResult
  },
```

- [ ] **Step 10: Run module-contract test to verify it passes**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: all tests pass.

- [ ] **Step 11: Run typecheck**

Run: `bun typecheck`
Expected: exit 0.

- [ ] **Step 12: Run registry tests**

Run: `bun run test -- --run components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx`
Expected: all pass.

- [ ] **Step 13: Commit**

```bash
git add lib/tools/display-chart lib/tools/display-chart.ts lib/agents/chat/toolset.ts components/tool-ui/registry.tsx lib/tools/__tests__/module-contract.test.ts
git commit -m "$(cat <<'EOF'
refactor(tools): migrate display-chart to directory pattern

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Final validation

**Files:** none modified — verification only.

- [ ] **Step 1: Inspect `components/tool-ui/registry.tsx` for orphaned imports**

Run: `grep -n "from './callout/\|from './plan/\|from './timeline/\|from './data-table/\|from './chart/'" components/tool-ui/registry.tsx`
Expected: no matches. After all five migrations, every `Plan`/`Callout`/`Timeline`/`DataTable`/`Chart` and `safeParseSerializable*` import in this file should be gone — they all moved to the per-tool `result.tsx`. If any remain, return to the relevant task and remove the orphaned import.

- [ ] **Step 2: Inspect `lib/agents/chat/toolset.ts` for old-style imports**

Run: `grep -n "from '@/lib/tools/display-callout'\|from '@/lib/tools/display-plan'\|from '@/lib/tools/display-table'\|from '@/lib/tools/display-chart'\|from '@/lib/tools/display-timeline'" lib/agents/chat/toolset.ts`
Expected: no matches. All five should now import from `<name>/server`. The flat `.ts` files are no longer imported anywhere except the module-contract test (intentional).

- [ ] **Step 3: Run the full module-contract test one more time**

Run: `bun run test -- --run lib/tools/__tests__/module-contract.test.ts`
Expected: 27 passing assertions (9 tools × 3 assertions: compatibility module, folder index, pure compatibility re-export). Specifically, `display-callout`, `display-plan`, `display-timeline`, `display-table`, and `display-chart` all appear three times each in the test output.

- [ ] **Step 4: Run lint**

Run: `bun lint`
Expected: exit 0, no errors. Fix any new warnings introduced by the migration before proceeding (per CLAUDE.md "Fix every warning and error you encounter").

- [ ] **Step 5: Run format check**

Run: `bun format:check`
Expected: exit 0. If files are mis-formatted, run `bun format` and stage the result as a follow-up commit.

- [ ] **Step 6: Run typecheck**

Run: `bun typecheck`
Expected: exit 0.

- [ ] **Step 7: Run the full root test suite**

Run: `bun run test`
Expected: all suites pass. Pay particular attention to:

- `lib/tools/__tests__/module-contract.test.ts`
- `components/tool-ui/registry.test.tsx`
- `components/tool-ui/registry.server.test.tsx`
- `components/tool-ui/data-table/data-table.test.tsx`
- `lib/agents/chat/__tests__/registry.test.ts`

If `lib/agents/chat/__tests__/registry.test.ts` fails because of the `vi.mock('@/lib/tools/display-X', …)` calls (it currently mocks the flat path), update those mocks to reference the new server path (`'@/lib/tools/display-X/server'`) and use `serverTool` instead of `display<Name>Tool`. Re-run.

- [ ] **Step 8: Run package-local evals tests**

Run: `cd services/evals && bun run typecheck && bun run test && cd -`
Expected: exit 0 for both. The evals package does not import display tools directly, but typecheck still has to pass against the chat registry surface.

- [ ] **Step 9: Browser QA — display tools render correctly**

Start the dev server: `bun dev` (port 43100).

In an authenticated chat, prompt the model to exercise each migrated tool and visually confirm rendering matches `main`:

1. Callout — prompt: "Give me a callout warning about deprecated React class components."
2. Plan — prompt: "Show me a step-by-step plan for setting up a Postgres database."
3. Timeline — prompt: "Show a timeline of major React versions."
4. Table — prompt: "Compare React, Vue, and Svelte in a table."
5. Chart — prompt: "Show a bar chart of US population by decade from 1950 to 2020."

For each: confirm the card renders, animates in via `ToolCardMount`, and looks identical to the pre-migration version (compare against a `main` tab if needed).

If any tool fails to render: open browser devtools, check the console for `safeParseSerializable*` parse failures or runtime errors. The most likely cause is a typo in the component import path inside `result.tsx` — verify against the existing `display-link-preview/result.tsx`.

- [ ] **Step 10: Push branch and open PR**

```bash
git push -u origin ai-sdk-phase-3-display-tools
gh pr create --title "refactor(tools): migrate 5 display tools to directory pattern" --body "$(cat <<'EOF'
## Summary

- Migrates `display-callout`, `display-plan`, `display-timeline`, `display-table`, `display-chart` from flat single-file modules to the established `<name>/{schema,server,result,index}` directory pattern (matching `display-citations`, `display-link-preview`, `display-option-list`, `display-question-wizard`).
- Each flat `lib/tools/display-<name>.ts` is now a pure re-export shim; the contract test `lib/tools/__tests__/module-contract.test.ts` was extended with a row per migrated tool to lock parity.
- `components/tool-ui/registry.tsx` no longer contains inline render bodies for these five tools — it imports `tryRenderResult` from each tool's `result.tsx`.
- Closes Workstream 3 of `docs/superpowers/plans/2026-04-27-ai-sdk-contract-standardization-phase-3.md`. `display-geo-map` remains a separate later slice.

## Test plan

- [ ] `bun run test -- --run lib/tools/__tests__/module-contract.test.ts` — 27 passing assertions
- [ ] `bun run test` — full root suite green
- [ ] `bun typecheck` and `bun lint` clean
- [ ] `cd services/evals && bun run test && bun run typecheck` clean
- [ ] Browser QA: callout, plan, timeline, table, chart all render in an authenticated chat at `localhost:43100`

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

Return the PR URL.

---

## Acceptance Criteria

- All five display tools live at `lib/tools/<name>/{schema,server,result,index}.{ts,tsx}` and follow the link-preview directory pattern.
- The corresponding flat `.ts` files exist as pure re-export shims (no `function`, `async`, `const`, or `tool(` tokens) and pass `module-contract.test.ts`.
- `lib/agents/chat/toolset.ts` imports each `serverTool` from `<name>/server` and aliases it to the original `display<Name>Tool` name.
- `components/tool-ui/registry.tsx` no longer contains inline `safeParseSerializable*` calls or component imports for any of the five migrated tools — every entry uses the directory's `tryRenderResult`.
- `lib/tools/__tests__/module-contract.test.ts` has nine entries (the existing four plus the five migrated tools) and is the parity gate.
- `bun lint`, `bun typecheck`, `bun run test`, `bun format:check`, and `services/evals` package-local typecheck + tests all pass.
- Manual browser QA confirms each tool renders identically to pre-migration on `main`.
- `display-geo-map` is **untouched** — its 237-line schema is a separate later slice per the parent Phase 3 plan.

## Self-Review Checklist (run before announcing the plan complete)

- [x] Spec coverage: all five tools enumerated in the parent plan's "Migrate the next small display-tool batch" todo are migrated. `display-geo-map` is explicitly excluded as the parent plan dictates.
- [x] No placeholders — every step contains concrete code or commands.
- [x] Type and identifier consistency: `toolName` literals (`'displayCallout'`, `'displayPlan'`, `'displayTimeline'`, `'displayTable'`, `'displayChart'`) match exactly what's expected by the existing `entries` array in `components/tool-ui/registry.tsx` and the `ChatAgentTools` keys in `lib/agents/chat/toolset.ts`. The shim files preserve the original `display<Name>Tool` named export so any future direct importer would still resolve.
- [x] Each migration is one self-contained commit, leaving the tree green between commits — bisect-friendly.

# Tool UI Manifest Runtime Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI SDK-standardized community UI components from assistant-ui, Agent Kit, Tool UI, and similar projects repeatable to integrate into Polymorph by centralizing local tool metadata, source provenance, server registration, renderer registration, active-agent exposure, and interactive continuation wiring.

**Architecture:** Keep one main Polymorph AI SDK v6 chat runtime, including canvas behavior, persistence, stream data parts, and the bespoke message renderer. Add a manifest-driven local adapter layer around it: a server/client-safe metadata catalog, a community-source inventory, a server tool catalog, a client renderer catalog, an interactive renderer catalog, and component-local adapters for community UI integrations. AI SDK-compatible npm packages are the preferred source path: consume documented public exports, keep Polymorph-specific mapping outside the package, and fall back to copied/ported source only when no usable package/API surface exists. This makes community component onboarding deliberate without introducing parallel assistant-ui, Tool UI, or Agent Kit runtimes in this slice.

**Tech Stack:** Next.js 16 App Router, React 19, Vercel AI SDK v6, `@ai-sdk/react`, public npm packages for community UI sources when available, Zod 4, Vitest, Testing Library.

---

## Current State And Decision

The current implementation is not pure slop: the repo has real local requirements that official Tool UI runtimes do not know about, including canvas artifact state, guest canvas tokens, research activity behavior, canonical `UIMessage` persistence, and custom stream data parts. The remaining friction is convenience debt: adding a display tool currently requires coordinated edits across `lib/agents/chat/toolset.ts`, `lib/agents/chat/search.ts`, `lib/agents/chat/research.ts`, `components/tool-ui/registry.tsx`, `components/tool-ui/tool-part-registry.tsx`, `lib/types/dynamic-tools.ts`, prompt text, docs, and tests.

This plan keeps the custom runtime but removes the scattered registration model. The project is personal/non-commercial, so source-separated reimplementation is not required for this work. The preferred repeatable path is npm-first, license-aware community integration: when a component is available from an npm package with documented public AI SDK/React APIs, install the package, import only public exports, record the package/version/license, and put Polymorph-specific mapping in local adapters. If the source is shadcn-style copy/paste or lacks an npm/public export surface, record the upstream URL, license, dependencies, copied/adapted files, and runtime deviations, then adapt the serializable schema and component into Polymorph's local AI SDK manifest contract. Use a source-separated rewrite only if future commercial, relicensing, or upstream-license constraints require it.

After this work, a passive display tool should require:

1. A component/schema folder under `components/tool-ui/<component>/`.
2. A tool module under `lib/tools/display-<component>/`.
3. One community-source row in `lib/tools/tool-ui/community-sources.ts` when the source is not purely local.
4. One metadata row in `lib/tools/tool-ui/metadata.ts`.
5. One server-catalog row and one renderer-catalog row.
6. Focused schema/registry/prompt tests.

Interactive tools still need a client renderer, but the allowlist and dispatch rules become catalog-driven rather than hand-coded inside core request plumbing.

`displayGeoMap` remains an intentional legacy exception in this plan. It is already integrated through the older module shape (`lib/tools/display-geo-map.ts` plus `components/tool-ui/geo-map/*`) and should be documented/test-covered as the exception while the manifest layer is introduced. Do not migrate it into the folder-module pattern unless a later task explicitly chooses that larger cleanup.

## Npm-First Community Source Policy

The manifest adapter honors original upstream source when implementation follows these rules:

1. For AI SDK-compatible npm packages, import the package through documented public exports such as `@assistant-ui/react` or `@assistant-ui/react-ai-sdk`; do not copy package internals into `components/tool-ui/*`.
2. Keep all Polymorph behavior in local adapters, manifests, schemas, prompt guidance, and renderer rows. Do not patch `node_modules`, do not vendor package files, and do not deep import paths such as `dist/*`, `internal/*`, private source files, or generated build artifacts.
3. Record one community-source entry for every non-local component source. The record must say whether the source is `npm`, `ported`, or `local`, and for npm sources it must include `packageName`, `packageVersion`, `license`, `publicImports`, and `adapterFiles`.
4. Treat package upgrades as a supported workflow: update the npm dependency, run the adapter/renderer contract tests first, then run the broader Tool UI suite. Adapter changes are acceptable when the upstream public API changes; editing upstream package source is not.
5. The adapter layer is AI SDK-centered, not assistant-ui-centered. If a community package already speaks AI SDK messages, tools, or `useChat`-style state, the adapter should be thin and should not create a second runtime. If the package offers its own runtime, use only its public component/adapter APIs needed for rendering unless a later plan explicitly chooses a runtime migration.

## Required Startup For Implementers

This plan file is currently untracked on a detached HEAD in the worker worktree. Before following any commit steps, implementers must create/switch to a real branch or explicitly stage this plan first so the plan does not disappear from the eventual PR.

- [ ] **Step 1: Inspect repo state before code edits**

Run:

```bash
git status --short --branch
```

Expected in the current worker state: `## HEAD (no branch)` and `?? docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime.md`.

- [ ] **Step 2: Create a branch before implementation commits**

Run from the implementation worktree:

```bash
git switch -c codex/tool-ui-manifest-runtime
```

Expected: branch switch succeeds. If another worker already created the branch, coordinate with the owner instead of forcing checkout.

- [ ] **Step 3: Preserve this plan in Git before code tasks**

Run:

```bash
git add docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime.md
git status --short
```

Expected: the plan file is staged as `A  docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime.md`. Commit it with Task 1 or as a docs-only checkpoint before pushing.

## File Structure

- Create `lib/tools/tool-ui/community-sources.ts`: server/client-safe source inventory for community UI packages and ports, including npm package/version/license/public import boundaries.
- Create `lib/tools/tool-ui/metadata.ts`: server/client-safe source of truth for Tool UI tool names, tool kind, interactive tool names, `tool-*` part types, and agent mode availability.
- Create `lib/tools/tool-ui/server.ts`: small helpers for AI SDK display-tool server definitions, including `outputSchema` for client-resolved tools.
- Create `lib/tools/tool-ui/server-catalog.ts`: server-only catalog mapping metadata tool names to AI SDK server tools.
- Create `lib/tools/tool-ui/client-output-validation.ts`: server-safe validator that parses client-resolved interactive outputs with the matched tool's `outputSchema` before persistence.
- Create `lib/tools/tool-ui/__tests__/community-sources.test.ts`: verifies npm source records use public package imports and reject deep/internal import paths.
- Create `lib/tools/tool-ui/__tests__/metadata.test.ts`: verifies metadata mode membership and interactive part-type derivation.
- Create `lib/tools/tool-ui/__tests__/server-catalog.test.ts`: verifies every metadata tool has a registered server tool.
- Modify `lib/agents/chat/toolset.ts`: consume the server catalog instead of importing every display tool directly.
- Modify `lib/agents/chat/search.ts`: derive display active tools from metadata for search mode and export shared geo utility tool names.
- Modify `lib/agents/chat/research.ts`: derive display active tools from metadata for research mode.
- Modify `lib/agents/chat/build.ts`: define `BUILD_AGENT_ACTIVE_TOOLS` with `getToolUiToolNamesForMode('build')` instead of reusing search metadata by accident.
- Modify `lib/agents/chat/factory.ts`: derive eval-mode interactive tool filtering from metadata instead of hard-coded `displayOptionList` / `displayQuestionWizard`.
- Modify `lib/streaming/helpers/prepare-tool-result-messages.ts`: call the shared client-output validator and persist only parsed client-resolved interactive outputs.
- Modify `lib/types/agent.ts`: derive the tool invocation union from `ResearcherTools` so manifest-managed tools cannot drift out of the union.
- Create `components/tool-ui/renderer-catalog.tsx`: client-only renderer catalog for display tool outputs.
- Modify `components/tool-ui/registry.tsx`: keep the public facade, including `isRegisteredToolUI`, but delegate display tools to the renderer catalog and additional result renderers.
- Test `components/tool-ui/registry.server.test.tsx`: keep server-import coverage for the registry split so browser-only map code does not evaluate on the server.
- Create `components/tool-ui/interactive-renderer-catalog.tsx`: client-only renderer catalog for frontend-resolved interactive tools.
- Modify `components/tool-ui/tool-part-registry.tsx`: delegate interactive rendering through the interactive renderer catalog.
- Modify `lib/types/dynamic-tools.ts`: derive interactive `tool-*` continuation types from metadata.
- Modify `lib/tools/display-option-list/server.ts`: use the local helper and pass the AI SDK `outputSchema` for client-resolved results.
- Modify `lib/tools/display-question-wizard/server.ts`: use the local helper and pass the AI SDK `outputSchema` for client-resolved results.
- Modify `lib/agents/chat/__tests__/community-portability.test.ts`: prove build has its own metadata-derived display tools.
- Modify `components/chat-request.test.ts`: prove metadata-driven interactive tools become tool-result continuations and passive tools do not.
- Modify `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`: prove invalid client outputs are rejected before persistence.
- Modify `lib/utils/__tests__/message-mapping-ui-message.test.ts`: prove new manifest display and interactive output parts round-trip through canonical `uiMessage` mapping.
- Modify `lib/db/__tests__/chat-ui-message-load.test.ts`: prove DB reload preserves new manifest display and interactive output parts from canonical `uiMessage`.
- Modify `components/tool-ui/registry.test.tsx`: prove metadata and renderer catalogs stay in sync.
- Modify `components/render-message.test.tsx`: prove `isRegisteredToolUI` remains available for migrated Tool UI and additional result renderers.
- Modify `components/tool-ui/tool-part-registry.test.tsx`: prove interactive catalog rendering still submits results.
- Modify `docs/architecture/GENERATIVE-UI.md`: replace manual onboarding instructions with the manifest-driven path and local `addToolResult` wording.
- Modify `docs/reference/FILE-INDEX.md`: record the manifest/runtime files; Task 7 adds proof component entries after the component exists.
- Modify `docs/architecture/RESEARCH-AGENT.md`: update active tool lists and display-tool onboarding references.
- Modify `docs/architecture/OVERVIEW.md`: update mode tool lists if build/search/research display tools change.
- Modify `GEMINI.md`: update the agent-facing chat/research active tool lists once `displayAgentArtifact` is registered.
- Modify `components/tool-ui/index.ts`: export the proof component and serializable types from the public Tool UI barrel.
- Create `components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md`: retain the upstream Agent Kit copyright and permission notice for the ported component.
- Proof task in this plan: add a license-aware `displayAgentArtifact` community port using the new local adapter path, with provenance recorded in `community-sources.ts` and the component README. Future assistant-ui or other AI SDK-standardized npm components should use the same manifest shape with `sourceType: 'npm'` and public package imports instead of vendored source.

---

### Task 1: Add Tool UI Metadata And Server Helpers

**Files:**

- Create: `lib/tools/tool-ui/community-sources.ts`
- Create: `lib/tools/tool-ui/metadata.ts`
- Create: `lib/tools/tool-ui/server.ts`
- Create: `lib/tools/tool-ui/__tests__/community-sources.test.ts`
- Create: `lib/tools/tool-ui/__tests__/metadata.test.ts`

- [ ] **Step 1: Write the failing community source and metadata tests**

Create `lib/tools/tool-ui/__tests__/community-sources.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  isPublicPackageImport,
  TOOL_UI_COMMUNITY_SOURCES
} from '../community-sources'

describe('Tool UI community sources', () => {
  it('starts with no non-local community sources before the proof port lands', () => {
    expect(TOOL_UI_COMMUNITY_SOURCES).toEqual([])
  })

  it('accepts public package imports and rejects deep or internal imports', () => {
    expect(isPublicPackageImport('@assistant-ui/react')).toBe(true)
    expect(isPublicPackageImport('@assistant-ui/react-ai-sdk')).toBe(true)
    expect(isPublicPackageImport('@tool-ui/geo-map')).toBe(true)

    expect(isPublicPackageImport('@assistant-ui/react/dist/thread')).toBe(false)
    expect(isPublicPackageImport('@assistant-ui/react/internal/thread')).toBe(
      false
    )
    expect(isPublicPackageImport('@tool-ui/geo-map/src/geo-map')).toBe(false)
    expect(
      isPublicPackageImport('@/components/community/assistant-ui/thread')
    ).toBe(false)
    expect(isPublicPackageImport('../vendor/assistant-ui/thread')).toBe(false)
  })

  it('keeps npm source records on public import boundaries', () => {
    for (const source of TOOL_UI_COMMUNITY_SOURCES) {
      if (source.sourceType !== 'npm') continue

      for (const publicImport of source.publicImports) {
        expect(isPublicPackageImport(publicImport)).toBe(true)
      }
    }
  })
})
```

Create `lib/tools/tool-ui/__tests__/metadata.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import {
  getInteractiveToolPartTypes,
  getInteractiveToolUiToolNames,
  getToolUiToolNamesForMode,
  TOOL_UI_TOOL_METADATA
} from '../metadata'

describe('Tool UI metadata', () => {
  it('keeps tool names unique', () => {
    const names = TOOL_UI_TOOL_METADATA.map(tool => tool.name)

    expect(new Set(names).size).toBe(names.length)
  })

  it('derives search display tools from metadata', () => {
    expect(getToolUiToolNamesForMode('search')).toEqual([
      'displayPlan',
      'displayTable',
      'displayChart',
      'displayGeoMap',
      'displayCitations',
      'displayLinkPreview',
      'displayOptionList',
      'displayQuestionWizard',
      'displayCallout',
      'displayTimeline'
    ])
  })

  it('keeps displayPlan out of research mode', () => {
    expect(getToolUiToolNamesForMode('research')).toEqual([
      'displayTable',
      'displayChart',
      'displayGeoMap',
      'displayCitations',
      'displayLinkPreview',
      'displayOptionList',
      'displayQuestionWizard',
      'displayCallout',
      'displayTimeline'
    ])
  })

  it('derives build display tools from build metadata', () => {
    expect(getToolUiToolNamesForMode('build')).toEqual([
      'displayPlan',
      'displayTable',
      'displayChart',
      'displayGeoMap',
      'displayCitations',
      'displayLinkPreview',
      'displayOptionList',
      'displayQuestionWizard',
      'displayCallout',
      'displayTimeline'
    ])
  })

  it('derives interactive tool names from metadata', () => {
    expect(getInteractiveToolUiToolNames()).toEqual([
      'displayOptionList',
      'displayQuestionWizard'
    ])
  })

  it('derives interactive tool part types from metadata', () => {
    expect(getInteractiveToolPartTypes()).toEqual([
      'tool-displayOptionList',
      'tool-displayQuestionWizard'
    ])
  })
})
```

- [ ] **Step 2: Run the community source and metadata tests to verify they fail**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/community-sources.test.ts lib/tools/tool-ui/__tests__/metadata.test.ts
```

Expected: FAIL with module resolution errors for `../community-sources` and `../metadata`.

- [ ] **Step 3: Add community source inventory**

Create `lib/tools/tool-ui/community-sources.ts`:

```ts
export type ToolUiCommunitySourceType = 'npm' | 'ported' | 'local'

type BaseCommunitySource = {
  id: string
  sourceType: ToolUiCommunitySourceType
  upstreamProject: string
  license: string
  adapterFiles: readonly string[]
  runtimeNotes: string
}

export type ToolUiNpmCommunitySource = BaseCommunitySource & {
  sourceType: 'npm'
  packageName: string
  packageVersion: string
  publicImports: readonly string[]
  docsUrl: string
}

export type ToolUiUpstreamFileReference = {
  path: string
  blobSha: string
  url: string
}

export type ToolUiPortedCommunitySource = BaseCommunitySource & {
  sourceType: 'ported'
  upstreamUrl: string
  upstreamCommit: string
  upstreamFiles: readonly ToolUiUpstreamFileReference[]
  copiedFiles: readonly string[]
  adaptedFiles: readonly string[]
  attributionNotice: string
  localNoticeFile?: string
}

export type ToolUiLocalCommunitySource = BaseCommunitySource & {
  sourceType: 'local'
}

export type ToolUiCommunitySource =
  | ToolUiNpmCommunitySource
  | ToolUiPortedCommunitySource
  | ToolUiLocalCommunitySource

export const TOOL_UI_COMMUNITY_SOURCES: readonly ToolUiCommunitySource[] = []

export type ToolUiCommunitySourceId = ToolUiCommunitySource['id']

const forbiddenImportSegments = new Set(['dist', 'internal', 'src', 'build'])

export function isPublicPackageImport(importPath: string): boolean {
  if (importPath.startsWith('.') || importPath.startsWith('@/')) return false

  const segments = importPath.split('/').filter(Boolean)
  if (segments.length === 0) return false
  if (importPath.startsWith('@') && segments.length < 2) return false

  const packageSegments = importPath.startsWith('@') ? 2 : 1
  const subpathSegments = segments.slice(packageSegments)

  return !subpathSegments.some(segment => forbiddenImportSegments.has(segment))
}

export function getToolUiCommunitySourceById(
  id: string
): ToolUiCommunitySource | undefined {
  return TOOL_UI_COMMUNITY_SOURCES.find(source => source.id === id)
}
```

- [ ] **Step 4: Add metadata source of truth**

Create `lib/tools/tool-ui/metadata.ts`:

```ts
import type { ToolUiCommunitySourceId } from './community-sources'

export const TOOL_UI_AGENT_MODES = ['search', 'research', 'build'] as const

export type ToolUiAgentMode = (typeof TOOL_UI_AGENT_MODES)[number]

export type ToolUiToolKind = 'passive-display' | 'interactive-display'

export type ToolUiToolMetadata = {
  name: string
  kind: ToolUiToolKind
  activeIn: readonly ToolUiAgentMode[]
  communitySourceId?: ToolUiCommunitySourceId
}

export const TOOL_UI_TOOL_METADATA = [
  {
    name: 'displayPlan',
    kind: 'passive-display',
    activeIn: ['search', 'build']
  },
  {
    name: 'displayTable',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayChart',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayGeoMap',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayCitations',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayLinkPreview',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayOptionList',
    kind: 'interactive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayQuestionWizard',
    kind: 'interactive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayCallout',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  },
  {
    name: 'displayTimeline',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build']
  }
] as const satisfies readonly ToolUiToolMetadata[]

export type ToolUiToolName = (typeof TOOL_UI_TOOL_METADATA)[number]['name']

export type InteractiveToolUiToolName = Extract<
  (typeof TOOL_UI_TOOL_METADATA)[number],
  { kind: 'interactive-display' }
>['name']

export type InteractiveToolUiPartType = `tool-${InteractiveToolUiToolName}`

export function getToolUiToolNamesForMode(
  mode: ToolUiAgentMode
): ToolUiToolName[] {
  return TOOL_UI_TOOL_METADATA.filter(tool => {
    const activeIn = tool.activeIn as readonly ToolUiAgentMode[]
    return activeIn.includes(mode)
  }).map(tool => tool.name)
}

export function getInteractiveToolPartTypes(): InteractiveToolUiPartType[] {
  return TOOL_UI_TOOL_METADATA.filter(
    tool => tool.kind === 'interactive-display'
  ).map(tool => `tool-${tool.name}` as InteractiveToolUiPartType)
}

export function getInteractiveToolUiToolNames(): InteractiveToolUiToolName[] {
  return TOOL_UI_TOOL_METADATA.filter(
    tool => tool.kind === 'interactive-display'
  ).map(tool => tool.name as InteractiveToolUiToolName)
}

export const INTERACTIVE_TOOL_PART_TYPES = getInteractiveToolPartTypes()
export const INTERACTIVE_TOOL_UI_TOOL_NAMES = getInteractiveToolUiToolNames()
```

- [ ] **Step 5: Add server helper functions**

Create `lib/tools/tool-ui/server.ts`:

```ts
import { tool } from 'ai'
import type { z } from 'zod'

export function createPassthroughDisplayTool<TInput>({
  description,
  inputSchema
}: {
  description: string
  inputSchema: z.ZodType<TInput>
}) {
  return tool({
    description,
    inputSchema,
    execute: async params => params
  })
}

export function createClientResolvedDisplayTool<TInput, TOutput>({
  description,
  inputSchema,
  outputSchema
}: {
  description: string
  inputSchema: z.ZodType<TInput>
  outputSchema: z.ZodType<TOutput>
}) {
  return tool({
    description,
    inputSchema,
    outputSchema
  })
}
```

- [ ] **Step 6: Run the community source and metadata tests to verify they pass**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/community-sources.test.ts lib/tools/tool-ui/__tests__/metadata.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit metadata, community source inventory, and helpers**

Run:

```bash
git add lib/tools/tool-ui/community-sources.ts lib/tools/tool-ui/metadata.ts lib/tools/tool-ui/server.ts lib/tools/tool-ui/__tests__/community-sources.test.ts lib/tools/tool-ui/__tests__/metadata.test.ts
git commit -m "feat: add tool ui metadata contract"
```

---

### Task 2: Add Server Catalog For Tool Registration

**Files:**

- Create: `lib/tools/tool-ui/server-catalog.ts`
- Create: `lib/tools/tool-ui/__tests__/server-catalog.test.ts`
- Modify: `lib/tools/display-option-list/server.ts`
- Modify: `lib/tools/display-question-wizard/server.ts`
- Test: `lib/tools/__tests__/module-contract.test.ts`

- [ ] **Step 1: Write the failing server catalog test**

Create `lib/tools/tool-ui/__tests__/server-catalog.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { TOOL_UI_TOOL_METADATA } from '../metadata'
import {
  createToolUiServerTools,
  getToolUiServerToolNames
} from '../server-catalog'

describe('Tool UI server catalog', () => {
  it('registers one server tool per metadata row', () => {
    expect(getToolUiServerToolNames()).toEqual(
      TOOL_UI_TOOL_METADATA.map(tool => tool.name)
    )
  })

  it('exposes AI SDK server tools with input schemas', () => {
    const tools = createToolUiServerTools()

    for (const metadata of TOOL_UI_TOOL_METADATA) {
      expect(tools[metadata.name]).toEqual(
        expect.objectContaining({
          inputSchema: expect.any(Object)
        })
      )
    }
  })

  it('keeps client-resolved tools registered with output schemas', () => {
    const tools = createToolUiServerTools()

    expect(tools.displayOptionList).toEqual(
      expect.objectContaining({
        inputSchema: expect.any(Object),
        outputSchema: expect.any(Object),
        execute: undefined
      })
    )
    expect(tools.displayQuestionWizard).toEqual(
      expect.objectContaining({
        inputSchema: expect.any(Object),
        outputSchema: expect.any(Object),
        execute: undefined
      })
    )
  })
})
```

- [ ] **Step 2: Run the server catalog test to verify it fails**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/server-catalog.test.ts
```

Expected: FAIL with a module resolution error for `../server-catalog`.

- [ ] **Step 3: Update existing client-resolved tools to pass AI SDK output schemas**

Replace `lib/tools/display-option-list/server.ts` with:

```ts
import { createClientResolvedDisplayTool } from '@/lib/tools/tool-ui/server'

import { inputSchema, outputSchema } from './schema'

export const serverTool = createClientResolvedDisplayTool({
  description:
    'Display an interactive option list for the user to select from. Use when presenting choices that require user input, such as preferences, configuration options, or decision points.',
  inputSchema,
  outputSchema
  // No execute: frontend resolves via addToolResult.
})
```

Replace `lib/tools/display-question-wizard/server.ts` with:

```ts
import { createClientResolvedDisplayTool } from '@/lib/tools/tool-ui/server'

import { inputSchema, outputSchema } from './schema'

export const serverTool = createClientResolvedDisplayTool({
  description:
    'Display an interactive multi-step question wizard that guides the user through a sequence of related selections. Each step is a page with its own options. The user navigates through all steps and submits once. Use when collecting 2+ related pieces of input that feed into a single decision, such as artifact intake (features + style).',
  inputSchema,
  outputSchema
  // No execute: frontend resolves via addToolResult.
})
```

- [ ] **Step 4: Add the server catalog**

Create `lib/tools/tool-ui/server-catalog.ts`:

```ts
import type { Tool } from 'ai'

import { serverTool as displayCalloutTool } from '@/lib/tools/display-callout/server'
import { serverTool as displayChartTool } from '@/lib/tools/display-chart/server'
import { serverTool as displayCitationsTool } from '@/lib/tools/display-citations/server'
import { displayGeoMapTool } from '@/lib/tools/display-geo-map'
import { serverTool as displayLinkPreviewTool } from '@/lib/tools/display-link-preview/server'
import { serverTool as displayOptionListTool } from '@/lib/tools/display-option-list/server'
import { serverTool as displayPlanTool } from '@/lib/tools/display-plan/server'
import { serverTool as displayQuestionWizardTool } from '@/lib/tools/display-question-wizard/server'
import { serverTool as displayTableTool } from '@/lib/tools/display-table/server'
import { serverTool as displayTimelineTool } from '@/lib/tools/display-timeline/server'

import type { ToolUiToolName } from './metadata'

const SERVER_TOOLS_BY_NAME = {
  displayPlan: displayPlanTool,
  displayTable: displayTableTool,
  displayChart: displayChartTool,
  displayGeoMap: displayGeoMapTool,
  displayCitations: displayCitationsTool,
  displayLinkPreview: displayLinkPreviewTool,
  displayOptionList: displayOptionListTool,
  displayQuestionWizard: displayQuestionWizardTool,
  displayCallout: displayCalloutTool,
  displayTimeline: displayTimelineTool
} satisfies Record<ToolUiToolName, Tool>

export type ToolUiServerTools = typeof SERVER_TOOLS_BY_NAME

export function createToolUiServerTools(): ToolUiServerTools {
  return SERVER_TOOLS_BY_NAME
}

export function getToolUiServerToolNames(): ToolUiToolName[] {
  return Object.keys(SERVER_TOOLS_BY_NAME) as ToolUiToolName[]
}
```

`displayGeoMap` intentionally imports from `@/lib/tools/display-geo-map` in this task. That flat module is the legacy exception documented by this plan; keep it covered in catalog/registry tests instead of forcing a folder migration here.

- [ ] **Step 5: Run the server catalog and module contract tests**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/server-catalog.test.ts lib/tools/__tests__/module-contract.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit the server catalog**

Run:

```bash
git add lib/tools/tool-ui/server-catalog.ts lib/tools/tool-ui/__tests__/server-catalog.test.ts lib/tools/display-option-list/server.ts lib/tools/display-question-wizard/server.ts
git commit -m "feat: centralize tool ui server tools"
```

---

### Task 3: Route Agent Tool Registration Through The Catalog

**Files:**

- Modify: `lib/agents/chat/toolset.ts`
- Modify: `lib/agents/chat/search.ts`
- Modify: `lib/agents/chat/research.ts`
- Modify: `lib/agents/chat/build.ts`
- Test: `lib/agents/chat/__tests__/registry.test.ts`
- Test: `lib/agents/chat/__tests__/community-portability.test.ts`
- Test: `lib/agents/__tests__/researcher.test.ts`

- [ ] **Step 1: Run current agent wiring tests before changes**

Run:

```bash
bun run test -- --run lib/agents/chat/__tests__/registry.test.ts lib/agents/__tests__/researcher.test.ts
```

Expected: PASS before edits.

- [ ] **Step 2: Update toolset imports**

In `lib/agents/chat/toolset.ts`, remove these display-tool imports:

```ts
import { serverTool as displayCalloutTool } from '@/lib/tools/display-callout/server'
import { serverTool as displayChartTool } from '@/lib/tools/display-chart/server'
import { serverTool as displayCitationsTool } from '@/lib/tools/display-citations/server'
import { displayGeoMapTool } from '@/lib/tools/display-geo-map'
import { serverTool as displayLinkPreviewTool } from '@/lib/tools/display-link-preview/server'
import { serverTool as displayOptionListTool } from '@/lib/tools/display-option-list/server'
import { serverTool as displayPlanTool } from '@/lib/tools/display-plan/server'
import { serverTool as displayQuestionWizardTool } from '@/lib/tools/display-question-wizard/server'
import { serverTool as displayTableTool } from '@/lib/tools/display-table/server'
import { serverTool as displayTimelineTool } from '@/lib/tools/display-timeline/server'
```

Add this import near the other tool imports:

```ts
import {
  createToolUiServerTools,
  type ToolUiServerTools
} from '@/lib/tools/tool-ui/server-catalog'
```

- [ ] **Step 3: Replace display tool members in `ChatAgentTools`**

In `lib/agents/chat/toolset.ts`, replace the current `ChatAgentTools` type block with:

```ts
export type ChatAgentTools = {
  search: ReturnType<typeof createSearchTool>
  fetch: typeof fetchTool
  getDirections: typeof getDirectionsTool
  geocodeAddress: typeof geocodeAddressTool
  getIsochrone: typeof getIsochroneTool
  getStaticMapImage: typeof getStaticMapImageTool
  createCanvasArtifact: ReturnType<typeof createCanvasArtifactTool>
  updateCanvasArtifact: ReturnType<typeof updateCanvasArtifactTool>
  readCanvasArtifact: ReturnType<typeof readCanvasArtifactTool>
  generateImage: ReturnType<typeof createGenerateImageTool>
  competitorResearch: ReturnType<typeof createCompetitorResearchTool>
} & ToolUiServerTools &
  ReturnType<typeof createTodoTools>
```

- [ ] **Step 4: Spread catalog tools into `createChatAgentTools`**

In `createChatAgentTools()`, add this line after `const todoTools = createTodoTools()`:

```ts
const toolUiTools = createToolUiServerTools()
```

Then replace the display tool entries in the returned object:

```ts
    displayPlan: displayPlanTool,
    displayTable: displayTableTool,
    displayChart: displayChartTool,
    displayGeoMap: displayGeoMapTool,
    displayCitations: displayCitationsTool,
    displayLinkPreview: displayLinkPreviewTool,
    displayOptionList: displayOptionListTool,
    displayQuestionWizard: displayQuestionWizardTool,
    displayCallout: displayCalloutTool,
    displayTimeline: displayTimelineTool,
```

with:

```ts
    ...toolUiTools,
```

- [ ] **Step 5: Derive search active display tools from metadata**

In `lib/agents/chat/search.ts`, add this import:

```ts
import { getToolUiToolNamesForMode } from '@/lib/tools/tool-ui/metadata'
```

Replace `SEARCH_AGENT_ACTIVE_TOOLS` with:

```ts
export const GEO_UTILITY_TOOLS = [
  'getDirections',
  'geocodeAddress',
  'getIsochrone',
  'getStaticMapImage'
] satisfies (keyof ChatAgentTools)[]

export const SEARCH_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  ...getToolUiToolNamesForMode('search'),
  ...GEO_UTILITY_TOOLS
]
```

- [ ] **Step 6: Derive research active display tools from metadata**

In `lib/agents/chat/research.ts`, add this import:

```ts
import { getToolUiToolNamesForMode } from '@/lib/tools/tool-ui/metadata'
```

Replace `RESEARCH_AGENT_ACTIVE_TOOLS` with:

```ts
const GEO_UTILITY_TOOLS = [
  'getDirections',
  'geocodeAddress',
  'getIsochrone',
  'getStaticMapImage'
] satisfies (keyof ChatAgentTools)[]

export const RESEARCH_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  'competitorResearch',
  ...getToolUiToolNamesForMode('research'),
  ...GEO_UTILITY_TOOLS
]
```

- [ ] **Step 7: Add build-specific active tools from build metadata**

In `lib/agents/chat/build.ts`, change the imports from `./search` to include `GEO_UTILITY_TOOLS` and stop importing `SEARCH_AGENT_ACTIVE_TOOLS`:

```ts
import { getToolUiToolNamesForMode } from '@/lib/tools/tool-ui/metadata'

import {
  GEO_UTILITY_TOOLS,
  wrapSearchToolForChatMode,
  wrapSearchToolWithPacing
} from './search'
import type { ChatAgentTools } from './toolset'
```

Add `BUILD_AGENT_ACTIVE_TOOLS` above `createBuildAgentDefinition()`:

```ts
export const BUILD_AGENT_ACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'search',
  'fetch',
  ...getToolUiToolNamesForMode('build'),
  ...GEO_UTILITY_TOOLS
]
```

Then replace:

```ts
    activeTools: SEARCH_AGENT_ACTIVE_TOOLS,
```

with:

```ts
    activeTools: BUILD_AGENT_ACTIVE_TOOLS,
```

In `lib/agents/chat/__tests__/community-portability.test.ts`, import `getToolUiToolNamesForMode` and add assertions inside `activates the ported specialist through the research agent only`:

```ts
expect(createBuildAgentDefinition().activeTools).toEqual(
  expect.arrayContaining(getToolUiToolNamesForMode('build'))
)
expect(createBuildAgentDefinition().activeTools).not.toContain(
  competitorResearchToolName
)
```

- [ ] **Step 8: Run agent wiring tests**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/server-catalog.test.ts lib/agents/chat/__tests__/registry.test.ts lib/agents/chat/__tests__/community-portability.test.ts lib/agents/__tests__/researcher.test.ts
```

Expected: PASS. If a test asserts exact ordering, replace the exact-order assertion with this set-membership assertion:

```ts
expect(new Set(definition.activeTools)).toEqual(
  new Set([
    'search',
    'fetch',
    ...getToolUiToolNamesForMode('search'),
    'getDirections',
    'geocodeAddress',
    'getIsochrone',
    'getStaticMapImage'
  ])
)
```

- [ ] **Step 9: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit agent catalog wiring**

Run:

```bash
git add lib/agents/chat/toolset.ts lib/agents/chat/search.ts lib/agents/chat/research.ts lib/agents/chat/build.ts lib/agents/chat/__tests__/community-portability.test.ts
git commit -m "refactor: derive agent display tools from tool ui catalog"
```

---

### Task 4: Add Client Renderer Catalog And Simplify The Registry Facade

**Files:**

- Create: `components/tool-ui/renderer-catalog.tsx`
- Modify: `components/tool-ui/registry.tsx`
- Modify: `components/tool-ui/registry.test.tsx`
- Modify: `components/render-message.test.tsx`
- Test: `components/tool-ui/registry.server.test.tsx`

- [ ] **Step 1: Add renderer catalog parity test**

In `components/tool-ui/registry.test.tsx`, add this import:

```ts
import { TOOL_UI_TOOL_METADATA } from '@/lib/tools/tool-ui/metadata'

import { toolUiRendererEntries } from './renderer-catalog'
```

If the test currently imports only `tryRenderToolUIByName`, expand it to keep the facade coverage:

```ts
import { isRegisteredToolUI, tryRenderToolUIByName } from './registry'
```

Add this test inside `describe('tool UI registry', () => { ... })`:

```tsx
it('keeps renderer catalog names aligned with Tool UI metadata', () => {
  expect(toolUiRendererEntries.map(entry => entry.name)).toEqual(
    TOOL_UI_TOOL_METADATA.map(tool => tool.name)
  )
})

it('reports registered Tool UI and additional result renderers', () => {
  expect(isRegisteredToolUI('displayTable')).toBe(true)
  expect(isRegisteredToolUI('displayGeoMap')).toBe(true)
  expect(isRegisteredToolUI('competitorResearch')).toBe(true)
  expect(isRegisteredToolUI('generateImage')).toBe(true)
  expect(isRegisteredToolUI('readCanvasArtifact')).toBe(false)
  expect(isRegisteredToolUI('unknownTool')).toBe(false)
})
```

In `components/render-message.test.tsx`, add or keep the registered non-display regression (`renders completed registered non-display tool output through the tool UI registry instead of the research process buffer`) and update the mocked `./tool-ui/registry` export so `isRegisteredToolUI` still returns `true` for additional result renderers such as `competitorResearch`, `generateImage`, `createCanvasArtifact`, and `updateCanvasArtifact`. That render-message test is the proof that the facade still backs additional renderers after the catalog split.

- [ ] **Step 2: Run registry test to verify it fails**

Run:

```bash
bun run test -- --run components/tool-ui/registry.test.tsx
```

Expected: FAIL with a module resolution error for `./renderer-catalog`.

- [ ] **Step 3: Create the renderer catalog**

Create `components/tool-ui/renderer-catalog.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import type { ToolUiToolName } from '@/lib/tools/tool-ui/metadata'
import { tryRenderResult as tryRenderDisplayCalloutResult } from '@/lib/tools/display-callout/result'
import { tryRenderResult as tryRenderDisplayChartResult } from '@/lib/tools/display-chart/result'
import { tryRenderResult as tryRenderDisplayCitationsResult } from '@/lib/tools/display-citations/result'
import { tryRenderResult as tryRenderDisplayLinkPreviewResult } from '@/lib/tools/display-link-preview/result'
import { tryRenderResult as tryRenderDisplayPlanResult } from '@/lib/tools/display-plan/result'
import { tryRenderResult as tryRenderDisplayTableResult } from '@/lib/tools/display-table/result'
import { tryRenderResult as tryRenderDisplayTimelineResult } from '@/lib/tools/display-timeline/result'

import { ToolCardMount } from '@/components/motion/tool-card-mount'

import { GeoMap } from './geo-map/geo-map'
import { safeParseSerializableGeoMap } from './geo-map/schema'
import { OptionList } from './option-list/option-list'
import { safeParseSerializableOptionList } from './option-list/schema'
import { QuestionWizard } from './question-wizard/question-wizard'
import { safeParseSerializableQuestionWizard } from './question-wizard/schema'
import { ToolErrorBoundary } from './tool-error-boundary'

export type ToolUiRendererEntry = {
  name: ToolUiToolName
  tryRender: (output: unknown, partId: string) => ReactNode | null
}

export const toolUiRendererEntries = [
  {
    name: 'displayPlan',
    tryRender: tryRenderDisplayPlanResult
  },
  {
    name: 'displayTable',
    tryRender: tryRenderDisplayTableResult
  },
  {
    name: 'displayChart',
    tryRender: tryRenderDisplayChartResult
  },
  {
    name: 'displayGeoMap',
    tryRender: (output, partId) => {
      const parsed = safeParseSerializableGeoMap(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="GeoMap">
          <ToolCardMount partId={partId}>
            <GeoMap {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayCitations',
    tryRender: tryRenderDisplayCitationsResult
  },
  {
    name: 'displayLinkPreview',
    tryRender: tryRenderDisplayLinkPreviewResult
  },
  {
    name: 'displayOptionList',
    tryRender: (output, partId) => {
      const parsed = safeParseSerializableOptionList(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="OptionList">
          <ToolCardMount partId={partId}>
            <OptionList {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayQuestionWizard',
    tryRender: (output, partId) => {
      const parsed = safeParseSerializableQuestionWizard(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="QuestionWizard">
          <ToolCardMount partId={partId}>
            <QuestionWizard {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'displayCallout',
    tryRender: tryRenderDisplayCalloutResult
  },
  {
    name: 'displayTimeline',
    tryRender: tryRenderDisplayTimelineResult
  }
] as const satisfies readonly ToolUiRendererEntry[]

const toolUiRendererByName = new Map(
  toolUiRendererEntries.map(entry => [entry.name, entry])
)

export function tryRenderRegisteredToolUiResult(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  return (
    toolUiRendererByName
      .get(toolName as ToolUiToolName)
      ?.tryRender(output, partId) ?? null
  )
}

export function tryRenderAnyRegisteredToolUiResult(
  output: unknown,
  partId: string
): ReactNode | null {
  for (const entry of toolUiRendererEntries) {
    const rendered = entry.tryRender(output, partId)
    if (rendered) return rendered
  }

  return null
}

export function isRegisteredToolUiRenderer(toolName: string): boolean {
  return toolUiRendererByName.has(toolName as ToolUiToolName)
}
```

- [ ] **Step 4: Replace display entries in the registry facade**

Replace the body of `components/tool-ui/registry.tsx` with:

```tsx
'use client'

import type { ReactNode } from 'react'

import { tryRenderResult as tryRenderCreateCanvasArtifactResult } from '@/lib/tools/create-canvas-artifact/result'
import { tryRenderResult as tryRenderGenerateImageResult } from '@/lib/tools/generate-image/result'
import { tryRenderResult as tryRenderUpdateCanvasArtifactResult } from '@/lib/tools/update-canvas-artifact/result'

import { ToolCardMount } from '@/components/motion/tool-card-mount'

import {
  isRegisteredToolUiRenderer,
  tryRenderAnyRegisteredToolUiResult,
  tryRenderRegisteredToolUiResult
} from './renderer-catalog'
import {
  CompetitorResearchResult,
  safeParseCompetitorResearchResult
} from './competitor-research-result'
import { ToolErrorBoundary } from './tool-error-boundary'

type ResultRendererEntry = {
  name: string
  tryRender: (output: unknown, partId: string) => ReactNode | null
}

const additionalResultRendererEntries: ResultRendererEntry[] = [
  {
    name: 'competitorResearch',
    tryRender: (output, partId) => {
      const parsed = safeParseCompetitorResearchResult(output)
      if (!parsed) return null
      return (
        <ToolErrorBoundary toolName="CompetitorResearch">
          <ToolCardMount partId={partId}>
            <CompetitorResearchResult {...parsed} />
          </ToolCardMount>
        </ToolErrorBoundary>
      )
    }
  },
  {
    name: 'generateImage',
    tryRender: tryRenderGenerateImageResult
  },
  {
    name: 'canvasArtifactCard',
    tryRender: tryRenderCreateCanvasArtifactResult
  },
  {
    name: 'createCanvasArtifact',
    tryRender: tryRenderCreateCanvasArtifactResult
  },
  {
    name: 'updateCanvasArtifact',
    tryRender: tryRenderUpdateCanvasArtifactResult
  }
]

const additionalResultRendererByName = new Map(
  additionalResultRendererEntries.map(entry => [entry.name, entry])
)

const nonRenderableToolNames = new Set(['readCanvasArtifact'])

function isRegisteredAdditionalResultRenderer(toolName: string): boolean {
  return additionalResultRendererByName.has(toolName)
}

function tryRenderAdditionalResultByName(
  toolName: string,
  output: unknown,
  partId: string
) {
  return (
    additionalResultRendererByName.get(toolName)?.tryRender(output, partId) ??
    null
  )
}

function tryRenderAnyAdditionalResult(
  output: unknown,
  partId: string
): ReactNode | null {
  for (const entry of additionalResultRendererEntries) {
    const rendered = entry.tryRender(output, partId)
    if (rendered) return rendered
  }

  return null
}

/**
 * Try to render tool output using a named Tool UI component.
 * Falls back to matching all registered schemas if no name match renders.
 */
export function tryRenderToolUIByName(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  const namedToolUi = tryRenderRegisteredToolUiResult(toolName, output, partId)
  if (namedToolUi) return namedToolUi

  const namedAdditional = tryRenderAdditionalResultByName(
    toolName,
    output,
    partId
  )
  if (namedAdditional) return namedAdditional

  if (nonRenderableToolNames.has(toolName)) {
    return null
  }

  return tryRenderToolUI(output, partId)
}

/**
 * Try to render tool output by testing against all registered schemas.
 * Returns the first successful match or null.
 */
export function tryRenderToolUI(
  output: unknown,
  partId: string
): ReactNode | null {
  return (
    tryRenderAnyRegisteredToolUiResult(output, partId) ??
    tryRenderAnyAdditionalResult(output, partId)
  )
}

/**
 * Check if a tool name has a rich renderer. Includes manifest Tool UI
 * renderers plus additional result renderers that still use this facade.
 */
export function isRegisteredToolUI(toolName: string): boolean {
  return (
    isRegisteredToolUiRenderer(toolName) ||
    isRegisteredAdditionalResultRenderer(toolName)
  )
}
```

- [ ] **Step 5: Run registry tests**

Run:

```bash
bun run test -- --run components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Run render-message regression tests**

Run:

```bash
bun run test -- --run components/render-message.test.tsx components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit renderer catalog wiring**

Run:

```bash
git add components/tool-ui/renderer-catalog.tsx components/tool-ui/registry.tsx components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx components/render-message.test.tsx
git commit -m "refactor: centralize tool ui result renderers"
```

---

### Task 5: Derive Interactive Continuation From Metadata

**Files:**

- Create: `components/tool-ui/interactive-renderer-catalog.tsx`
- Create: `lib/tools/tool-ui/client-output-validation.ts`
- Modify: `components/tool-ui/tool-part-registry.tsx`
- Modify: `lib/types/dynamic-tools.ts`
- Modify: `lib/streaming/helpers/prepare-tool-result-messages.ts`
- Modify: `lib/agents/chat/factory.ts`
- Modify: `components/chat-request.test.ts`
- Modify: `components/tool-ui/tool-part-registry.test.tsx`
- Modify: `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`
- Test: `lib/agents/chat/__tests__/registry.test.ts`
- Test: `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`

- [ ] **Step 1: Add chat request coverage for both interactive tools**

In `components/chat-request.test.ts`, add this test after the existing interactive continuation test:

```ts
it('maps displayQuestionWizard output to a tool-result continuation', () => {
  const request = buildChatRequestBody({
    messages: [
      {
        id: 'user-1',
        role: 'user',
        parts: [{ type: 'text', text: 'choose project settings' }]
      },
      {
        id: 'assistant-1',
        role: 'assistant',
        parts: [
          {
            type: 'tool-displayQuestionWizard',
            toolCallId: 'wizard-1',
            state: 'output-available',
            input: {
              id: 'project-settings',
              steps: [
                {
                  id: 'style',
                  title: 'Style',
                  options: [{ id: 'minimal', label: 'Minimal' }]
                },
                {
                  id: 'density',
                  title: 'Density',
                  options: [{ id: 'compact', label: 'Compact' }]
                }
              ]
            },
            output: { style: 'minimal', density: 'compact' }
          }
        ]
      }
    ] as any,
    trigger: 'submit-message',
    messageId: 'assistant-1',
    chatId: 'chat-1',
    isGuest: false,
    savedMessagesCount: 2
  })

  expect(request.body).toEqual(
    expect.objectContaining({
      trigger: 'tool-result',
      toolResult: {
        toolCallId: 'wizard-1',
        output: { style: 'minimal', density: 'compact' }
      }
    })
  )
})
```

Also update the existing `displayOptionList` continuation fixture so it is AI SDK v6-shaped and schema-valid:

```ts
            {
              type: 'tool-displayOptionList',
              toolCallId: 'tool-1',
              state: 'output-available',
              input: {
                id: 'theme',
                options: [
                  { id: 'dark', label: 'Dark' },
                  { id: 'light', label: 'Light' }
                ]
              },
              output: 'dark'
            }
```

- [ ] **Step 2: Add interactive renderer catalog parity coverage**

In `components/tool-ui/tool-part-registry.test.tsx`, add these imports:

```ts
import { getInteractiveToolPartTypes } from '@/lib/tools/tool-ui/metadata'

import { interactiveToolRendererEntries } from './interactive-renderer-catalog'
```

Add this test inside `describe('tool part registry interactive display tools', () => { ... })`:

```tsx
it('keeps interactive renderer names aligned with metadata', () => {
  expect(
    interactiveToolRendererEntries.map(entry => `tool-${entry.name}`)
  ).toEqual(getInteractiveToolPartTypes())
})
```

- [ ] **Step 3: Run interactive tests to verify they fail**

Run:

```bash
bun run test -- --run components/chat-request.test.ts components/tool-ui/tool-part-registry.test.tsx
```

Expected: FAIL with a module resolution error for `./interactive-renderer-catalog`.

- [ ] **Step 4: Create the interactive renderer catalog**

Create `components/tool-ui/interactive-renderer-catalog.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { renderToolPart as renderDisplayOptionListToolPart } from '@/lib/tools/display-option-list/client'
import { toolName as displayOptionListToolName } from '@/lib/tools/display-option-list/schema'
import { renderToolPart as renderDisplayQuestionWizardToolPart } from '@/lib/tools/display-question-wizard/client'
import { toolName as displayQuestionWizardToolName } from '@/lib/tools/display-question-wizard/schema'

type ToolPartState =
  | 'input-streaming'
  | 'input-available'
  | 'output-available'
  | 'output-error'

export type DisplayToolPart = {
  state?: ToolPartState
  input?: unknown
  output?: unknown
  toolCallId?: string
  errorText?: string
}

export type RenderInteractiveToolPartArgs = {
  toolName: string
  toolPart: DisplayToolPart
  messageId: string
  partIndex: number
  status?: string
  addToolResult?: (params: { toolCallId: string; result: any }) => void
}

export type InteractiveToolRendererEntry = {
  name: string
  render: (args: RenderInteractiveToolPartArgs) => ReactNode | null
}

export const interactiveToolRendererEntries = [
  {
    name: displayOptionListToolName,
    render: args => renderDisplayOptionListToolPart(args)
  },
  {
    name: displayQuestionWizardToolName,
    render: args => renderDisplayQuestionWizardToolPart(args)
  }
] as const satisfies readonly InteractiveToolRendererEntry[]

const interactiveToolRendererByName = new Map(
  interactiveToolRendererEntries.map(entry => [entry.name, entry])
)

export function tryRenderInteractiveToolPart(
  args: RenderInteractiveToolPartArgs
): ReactNode | null {
  return interactiveToolRendererByName.get(args.toolName)?.render(args) ?? null
}
```

- [ ] **Step 5: Replace interactive special cases in tool-part registry**

In `components/tool-ui/tool-part-registry.tsx`, remove these imports:

```ts
import { renderToolPart as renderDisplayOptionListToolPart } from '@/lib/tools/display-option-list/client'
import { toolName as displayOptionListToolName } from '@/lib/tools/display-option-list/schema'
import { renderToolPart as renderDisplayQuestionWizardToolPart } from '@/lib/tools/display-question-wizard/client'
import { toolName as displayQuestionWizardToolName } from '@/lib/tools/display-question-wizard/schema'
```

Add this import:

```ts
import {
  type DisplayToolPart,
  tryRenderInteractiveToolPart
} from './interactive-renderer-catalog'
```

Remove the local `ToolPartState` and `DisplayToolPart` type declarations from `components/tool-ui/tool-part-registry.tsx`, because the shared type now comes from the interactive catalog.

Replace the two `if (toolName === ...)` blocks with:

```tsx
const interactiveRendered = tryRenderInteractiveToolPart({
  toolName,
  toolPart,
  messageId,
  partIndex,
  status,
  addToolResult
})
if (interactiveRendered) {
  return interactiveRendered
}
```

- [ ] **Step 6: Derive dynamic interactive tool types from metadata**

In `lib/types/dynamic-tools.ts`, add this import at the top:

```ts
import { INTERACTIVE_TOOL_PART_TYPES } from '@/lib/tools/tool-ui/metadata'
```

Replace:

```ts
const INTERACTIVE_TOOL_TYPES = new Set([
  'tool-displayOptionList',
  'tool-displayQuestionWizard'
])
```

with:

```ts
const INTERACTIVE_TOOL_TYPES = new Set<string>(INTERACTIVE_TOOL_PART_TYPES)
```

- [ ] **Step 7: Derive eval-mode interactive tool filtering from metadata**

In `lib/agents/chat/factory.ts`, add this import near the other imports:

```ts
import { INTERACTIVE_TOOL_UI_TOOL_NAMES } from '@/lib/tools/tool-ui/metadata'
```

In `lib/agents/chat/factory.ts`, replace the hard-coded interactive tool list:

```ts
const INTERACTIVE_TOOLS: (keyof ChatAgentTools)[] = [
  'displayOptionList',
  'displayQuestionWizard'
]
```

with:

```ts
const INTERACTIVE_TOOLS = new Set<keyof ChatAgentTools>(
  INTERACTIVE_TOOL_UI_TOOL_NAMES as readonly (keyof ChatAgentTools)[]
)
```

Then replace:

```ts
activeTools = activeTools.filter(tool => !INTERACTIVE_TOOLS.includes(tool))
```

with:

```ts
activeTools = activeTools.filter(tool => !INTERACTIVE_TOOLS.has(tool))
```

In `lib/agents/chat/__tests__/registry.test.ts`, add a factory regression test that would fail if the list drifts back to hard-coded strings:

```ts
it('removes metadata-defined interactive tools in eval mode', () => {
  const definition: ChatAgentDefinition = {
    agentId: 'search',
    systemPrompt: 'Search agent',
    activeTools: [
      'search',
      'displayTable',
      'displayOptionList',
      'displayQuestionWizard'
    ],
    maxSteps: 20,
    configureSearchTool: vi.fn(
      () => toolWiringMocks.configuredSearchTool as any
    )
  }

  createConfiguredChatAgent(
    {
      model: 'gateway:google/gemini-3-flash',
      experimentalContext: { executionMode: 'eval' }
    },
    definition
  )

  const agentConfig = toolWiringMocks.ToolLoopAgent.mock.calls[0]?.[0] as any

  expect(agentConfig.activeTools).toEqual(['search', 'displayTable'])
})
```

- [ ] **Step 8: Add negative output validation tests**

In `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts`, update the successful option-list case so the assistant part has v6 `input` and the submitted output matches `displayOptionList`'s schema:

```ts
          {
            type: 'tool-displayOptionList',
            toolCallId: TOOL_CALL_ID,
            state: 'input-available',
            input: {
              id: 'theme',
              options: [
                { id: 'dark', label: 'Dark' },
                { id: 'light', label: 'Light' }
              ]
            }
          } as never
```

and:

```ts
        { toolCallId: TOOL_CALL_ID, output: 'dark' }
```

Then add these validation tests inside `describe('validation errors', () => { ... })`:

```ts
it('rejects invalid displayOptionList output before persistence', async () => {
  const assistantMessage: UIMessage = {
    id: 'msg-2',
    role: 'assistant',
    parts: [
      {
        type: 'tool-displayOptionList',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'theme',
          options: [
            { id: 'dark', label: 'Dark' },
            { id: 'light', label: 'Light' }
          ]
        }
      } as never
    ]
  }

  const chat = makeChat([
    { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Pick' }] },
    assistantMessage
  ])

  await expect(
    prepareToolResultMessages(makeContext({ initialChat: chat }), {
      toolCallId: TOOL_CALL_ID,
      output: { value: 'dark' }
    })
  ).rejects.toThrow(/Invalid output for displayOptionList/)

  expect(upsertMessage).not.toHaveBeenCalled()
})

it('rejects invalid displayQuestionWizard output before persistence', async () => {
  const assistantMessage: UIMessage = {
    id: 'msg-2',
    role: 'assistant',
    parts: [
      {
        type: 'tool-displayQuestionWizard',
        toolCallId: TOOL_CALL_ID,
        state: 'input-available',
        input: {
          id: 'project-settings',
          steps: [
            {
              id: 'style',
              title: 'Style',
              options: [{ id: 'minimal', label: 'Minimal' }]
            },
            {
              id: 'density',
              title: 'Density',
              options: [{ id: 'compact', label: 'Compact' }]
            }
          ]
        }
      } as never
    ]
  }

  const chat = makeChat([
    { id: 'msg-1', role: 'user', parts: [{ type: 'text', text: 'Pick' }] },
    assistantMessage
  ])

  await expect(
    prepareToolResultMessages(makeContext({ initialChat: chat }), {
      toolCallId: TOOL_CALL_ID,
      output: { style: 42 }
    })
  ).rejects.toThrow(/Invalid output for displayQuestionWizard/)

  expect(upsertMessage).not.toHaveBeenCalled()
})
```

- [ ] **Step 9: Validate interactive outputs before persistence**

Create `lib/tools/tool-ui/client-output-validation.ts`:

```ts
import type { UIMessage } from '@/lib/types/ai'

import { createToolUiServerTools } from '@/lib/tools/tool-ui/server-catalog'

type ToolPart = NonNullable<UIMessage['parts']>[number]

type ToolWithOptionalOutputSchema = {
  outputSchema?: {
    safeParse: (
      value: unknown
    ) =>
      | { success: true; data: unknown }
      | { success: false; error: { message: string } }
  }
}

const toolUiServerTools = createToolUiServerTools() as Record<
  string,
  ToolWithOptionalOutputSchema
>

export type ClientOutputValidationResult =
  | { success: true; output: unknown }
  | { success: false; toolName: string; message: string }

export function getClientResolvedToolName(part: ToolPart): string | null {
  if (
    typeof (part as { type?: unknown }).type === 'string' &&
    (part as { type: string }).type.startsWith('tool-')
  ) {
    return (part as { type: string }).type.slice('tool-'.length)
  }

  if (typeof (part as { toolName?: unknown }).toolName === 'string') {
    return (part as { toolName: string }).toolName
  }

  return null
}

export function validateClientResolvedToolOutput(
  matchedPart: ToolPart,
  output: unknown
): ClientOutputValidationResult {
  const toolName = getClientResolvedToolName(matchedPart)
  const outputSchema = toolName
    ? toolUiServerTools[toolName]?.outputSchema
    : null

  if (!toolName || !outputSchema) {
    return { success: true, output }
  }

  const parsed = outputSchema.safeParse(output)
  if (!parsed.success) {
    return {
      success: false,
      toolName,
      message: parsed.error.message
    }
  }

  return { success: true, output: parsed.data }
}
```

In `lib/streaming/helpers/prepare-tool-result-messages.ts`, add this import:

```ts
import { validateClientResolvedToolOutput } from '@/lib/tools/tool-ui/client-output-validation'
```

Then, immediately before cloning `updatedParts`, validate once:

```ts
const outputValidation = validateClientResolvedToolOutput(
  matchedPart,
  toolResult.output
)

if (!outputValidation.success) {
  throw new ToolResultValidationError(
    `Invalid output for ${outputValidation.toolName}: ${outputValidation.message}`
  )
}

const validatedOutput = outputValidation.output
```

and write `validatedOutput` into the updated part:

```ts
output: validatedOutput
```

- [ ] **Step 10: Run interactive continuation tests**

Run:

```bash
bun run test -- --run components/chat-request.test.ts components/tool-ui/tool-part-registry.test.tsx lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/agents/chat/__tests__/registry.test.ts
```

Expected: PASS.

- [ ] **Step 11: Commit interactive catalog wiring**

Run:

```bash
git add components/tool-ui/interactive-renderer-catalog.tsx components/tool-ui/tool-part-registry.tsx lib/types/dynamic-tools.ts lib/tools/tool-ui/client-output-validation.ts lib/streaming/helpers/prepare-tool-result-messages.ts lib/agents/chat/factory.ts components/chat-request.test.ts components/tool-ui/tool-part-registry.test.tsx lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts lib/agents/chat/__tests__/registry.test.ts
git commit -m "refactor: derive interactive tool ui routing from metadata"
```

---

### Task 6: Document The Repeatable Onboarding Path

**Files:**

- Modify: `docs/architecture/GENERATIVE-UI.md`
- Modify: `docs/reference/FILE-INDEX.md`
- Modify: `docs/architecture/RESEARCH-AGENT.md`

- [ ] **Step 1: Replace manual onboarding guidance**

In `docs/architecture/GENERATIVE-UI.md`, replace the section starting at `### Adding a New Display Tool` with:

````md
### Adding a New Display Tool

Polymorph uses one local AI SDK v6 + Tool UI manifest contract. It does not use `assistant-ui` `Toolkit`, Agent Kit runtime, or upstream Tool UI runtime wiring for the main chat runtime.

For passive display tools, add:

1. `components/tool-ui/<component>/schema.ts`
2. `components/tool-ui/<component>/<component>.tsx`
3. `components/tool-ui/<component>/index.tsx`
4. `lib/tools/display-<component>/schema.ts`
5. `lib/tools/display-<component>/server.ts`
6. `lib/tools/display-<component>/result.tsx`
7. `lib/tools/display-<component>/index.ts`
8. `lib/tools/display-<component>.ts`
9. One community-source row in `lib/tools/tool-ui/community-sources.ts` when the component source is not purely local
10. One metadata row in `lib/tools/tool-ui/metadata.ts`
11. One server row in `lib/tools/tool-ui/server-catalog.ts`
12. One renderer row in `components/tool-ui/renderer-catalog.tsx`
13. Prompt guidance in `lib/agents/prompts/search-mode-prompts.ts`
14. Focused tests for schema, module contract, registry rendering, prompt usage, and agent availability

For interactive tools, also add:

1. `lib/tools/display-<component>/client.tsx`
2. One renderer row in `components/tool-ui/interactive-renderer-catalog.tsx`
3. A result schema that represents the value passed from the module-local renderer to `addToolResult`
4. Request and continuation tests covering `components/chat-request.ts` and `lib/streaming/helpers/prepare-tool-result-messages.ts`

The core rule: if a tool requires user input before the model continues, it is an `interactive-display` tool in `lib/tools/tool-ui/metadata.ts`. If the model can emit the final payload directly and the server tool returns that payload, it is a `passive-display` tool.

#### Npm-First Source Boundary

Do not start by adding a second runtime (`assistant-ui`, `tool-agent`, Agent Kit runtime, or direct shadcn registry installation) unless the feature explicitly calls for an official runtime migration.

For community components with npm packages and documented public exports:

1. Add the npm package to `package.json` and `bun.lock`.
2. Import only public package exports, for example `@assistant-ui/react`, `@assistant-ui/react-ai-sdk`, or another documented package entrypoint.
3. Put Polymorph mapping in local files such as `components/tool-ui/<component>/_adapter.tsx`, `lib/tools/display-<component>/result.tsx`, metadata rows, schemas, and prompt guidance.
4. Add a `sourceType: 'npm'` entry in `lib/tools/tool-ui/community-sources.ts` with `packageName`, `packageVersion`, `license`, `publicImports`, `docsUrl`, `adapterFiles`, and `runtimeNotes`.
5. Add or update tests that fail if an adapter imports package internals such as `dist/*`, `internal/*`, `src/*`, or vendored component paths.

For community components without a usable npm/public export surface, inspect upstream files and licenses first, then adapt the serializable schema and component into the local manifest contract. Those ports must be recorded with `sourceType: 'ported'` and explicit copied/adapted file lists.

#### License-Aware Community Porting Record

For any community component port, record this information in the component folder README or the architecture docs:

- Upstream project and source URL.
- Upstream license and whether the current personal/non-commercial usage is allowed.
- Upstream runtime dependencies and which ones were adopted, replaced, or avoided.
- Files copied as-is, files adapted, and files rewritten for the local runtime.
- Runtime deviations from upstream behavior.
- Adapter dependencies provided by `components/tool-ui/<component>/_adapter.tsx` or module-local imports.

Use a source-separated rewrite only if future commercial use, relicensing, or upstream license terms make copying/adaptation inappropriate.

#### Npm Upgrade Workflow

When a source entry has `sourceType: 'npm'`, upgrades should use this sequence:

```bash
bun outdated <package-name>
bun update <package-name>
bun run test -- --run lib/tools/tool-ui/__tests__/community-sources.test.ts components/tool-ui/registry.test.tsx lib/tools/tool-ui/__tests__/server-catalog.test.ts
bun run typecheck
```
````

Expected: package update succeeds, adapter/renderer tests pass, and typecheck passes. If upstream changed its public API, update only the local adapter files named in the community-source record and keep package source untouched.

````

- [ ] **Step 2: Add repeatability acceptance criteria**

In the same section, add:

```md
#### Repeatability Acceptance Criteria

A new passive display tool is repeatable when:

- The model-facing Zod schema lives in `lib/tools/display-<component>/schema.ts`.
- The render-facing serializable schema lives in `components/tool-ui/<component>/schema.ts`.
- The two schemas intentionally match or have a documented adapter in `result.tsx`.
- Any non-local source has a `lib/tools/tool-ui/community-sources.ts` entry. Npm entries import public package exports only; ported entries name copied and adapted files.
- `TOOL_UI_TOOL_METADATA` contains exactly one row for the tool.
- `createToolUiServerTools()` exposes the server tool.
- `toolUiRendererEntries` exposes the result renderer.
- `getToolUiToolNamesForMode(mode)` controls agent availability.
- `components/tool-ui/registry.tsx` does not need direct edits for the tool.
- Passive tools use `execute: async params => params`.
- Interactive tools have a `client.tsx` renderer and pass user output through the local `addToolResult` prop; `components/chat.tsx` bridges that callback to AI SDK `addToolOutput({ tool, toolCallId, output })`, and `components/chat-request.ts` / server continuation handle the resulting `toolResult`.
````

- [ ] **Step 3: Update docs inventory and active-tool surfaces**

Update `docs/reference/FILE-INDEX.md` to include:

```md
| `lib/tools/tool-ui/metadata.ts` | Tool UI manifest metadata for tool names, mode availability, and interactive continuation types |
| `lib/tools/tool-ui/community-sources.ts` | Community source inventory for npm packages, ported components, licenses, public imports, and local adapter ownership |
| `lib/tools/tool-ui/server.ts` | Helpers for passive and client-resolved AI SDK display tools |
| `lib/tools/tool-ui/server-catalog.ts` | Server-only catalog mapping manifest display tools to AI SDK server tools |
| `components/tool-ui/renderer-catalog.tsx` | Client renderer catalog for manifest display tools |
| `components/tool-ui/interactive-renderer-catalog.tsx` | Client renderer catalog for interactive display tool parts |
```

Update `docs/architecture/RESEARCH-AGENT.md` so the search/research active tool lists match `getToolUiToolNamesForMode('search')` and `getToolUiToolNamesForMode('research')`. Keep the `displayOptionList` wording local: module-local renderers receive `addToolResult`; `components/chat.tsx` bridges to AI SDK `addToolOutput` and the server continuation receives `toolResult`.

Do not add `displayAgentArtifact` to `docs/architecture/OVERVIEW.md` or `GEMINI.md` in this task. Those active-tool docs must wait until Task 7 registers the tool.

- [ ] **Step 4: Run docs grep to verify old guidance is gone**

Run:

```bash
rg -n 'Do \*\*not\*\* start with `tool-agent`|registry registration is not enough|schema.ts` -> `server.ts`|pass user output through `addToolOutput`|strict source-separated reimplementation is required|@assistant-ui/[^` ]+/(dist|internal|src)|@tool-ui/[^` ]+/(dist|internal|src)|components/community/assistant-ui|vendor/assistant-ui' docs/architecture/GENERATIVE-UI.md docs/architecture/RESEARCH-AGENT.md docs/reference/FILE-INDEX.md
```

Expected: no stale matches for the removed manual section, no local-module `addToolOutput` wording, no source-separated rewrite requirement, and no guidance that endorses assistant-ui or Tool UI deep/internal imports. The new section may still mention `tool-agent` only in the sentence that says not to start there for this runtime.

- [ ] **Step 5: Commit documentation update**

Run:

```bash
git add docs/architecture/GENERATIVE-UI.md docs/reference/FILE-INDEX.md docs/architecture/RESEARCH-AGENT.md
git commit -m "docs: document manifest-driven tool ui onboarding"
```

---

### Task 7: Prove The Path With A License-Aware Agent Artifact Display Tool

**Files:**

- Create: `components/tool-ui/agent-artifact/schema.ts`
- Create: `components/tool-ui/agent-artifact/schema.test.ts`
- Create: `components/tool-ui/agent-artifact/_adapter.tsx`
- Create: `components/tool-ui/agent-artifact/agent-artifact.tsx`
- Create: `components/tool-ui/agent-artifact/agent-artifact.test.tsx`
- Create: `components/tool-ui/agent-artifact/index.tsx`
- Create: `components/tool-ui/agent-artifact/README.md`
- Create: `components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md`
- Modify: `components/tool-ui/index.ts`
- Create: `lib/tools/display-agent-artifact/schema.ts`
- Create: `lib/tools/display-agent-artifact/server.ts`
- Create: `lib/tools/display-agent-artifact/result.tsx`
- Create: `lib/tools/display-agent-artifact/index.ts`
- Create: `lib/tools/display-agent-artifact.ts`
- Modify: `lib/types/agent.ts`
- Modify: `lib/tools/tool-ui/community-sources.ts`
- Modify: `lib/tools/tool-ui/__tests__/community-sources.test.ts`
- Modify: `lib/tools/tool-ui/metadata.ts`
- Modify: `lib/tools/tool-ui/server-catalog.ts`
- Modify: `components/tool-ui/renderer-catalog.tsx`
- Modify: `lib/tools/__tests__/module-contract.test.ts`
- Modify: `lib/utils/__tests__/message-mapping-ui-message.test.ts`
- Modify: `lib/db/__tests__/chat-ui-message-load.test.ts`
- Modify: `components/render-message.test.tsx`
- Modify: `components/tool-ui/registry.test.tsx`
- Modify: `lib/agents/prompts/search-mode-prompts.ts`
- Modify: `lib/agents/prompts/search-mode-prompts.test.ts`
- Modify: `docs/architecture/OVERVIEW.md`
- Modify: `docs/reference/FILE-INDEX.md`
- Modify: `GEMINI.md`

**Community porting note:** This project is personal/non-commercial, so the plan can port or adapt Agent Kit behavior when the upstream license permits that use. This proof component is intentionally recorded as `sourceType: 'ported'` because the v1 code below uses local React and local shadcn primitives instead of consuming an npm public export. The upstream source must be pinned to commit `03c55476a3e03a4f7ac90211f00a6a6d19706dac`, source file `components/agents-ui/agent-artifact.tsx` blob `c2e6265ed9ed2c219499c6a70ffa9e886e57e58d`, docs file `app/docs/agent-artifact/page.mdx` blob `e44d7184fa1e69e655fe32e659e46fe1776804bf`, and license file `LICENSE.md` blob `3c9d400a8904c040338ec6bbc982fd21b759765b`. The component README and `UPSTREAM-LICENSE.md` must preserve the upstream copyright and permission notice required by the non-commercial license. The upstream package metadata currently names `agents-ui-kit` `0.1.0` with `SEE LICENSE IN LICENSE.md`, and npm-name checks found no usable public package for this component, so this proof uses a local port. The `_adapter.tsx` file is a provenance and local-import boundary, not a runtime blocker; Agent Artifact should import `Button` and `cn` through it so the ported component stays distinguishable from Polymorph-specific primitives. For future assistant-ui or other AI SDK-standardized packages, use `sourceType: 'npm'`, install the package, and import only public package exports. The local behavior contract is: artifact title, type, content, optional versions, active version, metadata, preview/code/raw tabs, copy action, and download-friendly content. Keep it inside Polymorph's AI SDK runtime rather than adopting Agent Kit's runtime.

- [ ] **Step 1: Add failing module, schema, component, registry, and prompt tests**

In `lib/tools/__tests__/module-contract.test.ts`, add this row to `modules`:

```ts
  [
    'display-agent-artifact',
    () => import('@/lib/tools/display-agent-artifact'),
    () => import('@/lib/tools/display-agent-artifact/index')
  ],
```

In `lib/tools/tool-ui/__tests__/community-sources.test.ts`, replace the first test with:

```ts
it('records the proof community port with copied/adapted file ownership', () => {
  expect(
    getToolUiCommunitySourceById('agent-kit-agent-artifact')
  ).toMatchObject({
    id: 'agent-kit-agent-artifact',
    sourceType: 'ported',
    upstreamProject: 'Agent Kit / agents-ui artifact UI',
    upstreamUrl: 'https://github.com/agents-ui/agents-kit',
    upstreamCommit: '03c55476a3e03a4f7ac90211f00a6a6d19706dac',
    upstreamFiles: [
      {
        path: 'components/agents-ui/agent-artifact.tsx',
        blobSha: 'c2e6265ed9ed2c219499c6a70ffa9e886e57e58d',
        url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/components/agents-ui/agent-artifact.tsx'
      },
      {
        path: 'app/docs/agent-artifact/page.mdx',
        blobSha: 'e44d7184fa1e69e655fe32e659e46fe1776804bf',
        url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/app/docs/agent-artifact/page.mdx'
      },
      {
        path: 'LICENSE.md',
        blobSha: '3c9d400a8904c040338ec6bbc982fd21b759765b',
        url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/LICENSE.md'
      }
    ],
    license:
      'non-commercial; personal and internal evaluation allowed, commercial use requires permission',
    attributionNotice: expect.stringContaining(
      'Copyright (c) 2025 Abhishek Gahlot'
    ),
    localNoticeFile: 'components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md',
    copiedFiles: [],
    adaptedFiles: [
      'components/tool-ui/agent-artifact/agent-artifact.tsx',
      'components/tool-ui/agent-artifact/schema.ts',
      'lib/tools/display-agent-artifact/result.tsx'
    ],
    adapterFiles: [
      'components/tool-ui/agent-artifact/_adapter.tsx',
      'components/tool-ui/agent-artifact/agent-artifact.tsx',
      'lib/tools/display-agent-artifact/result.tsx'
    ]
  })
})
```

Also update the import at the top of `lib/tools/tool-ui/__tests__/community-sources.test.ts`:

```ts
import { readFileSync } from 'node:fs'

import {
  getToolUiCommunitySourceById,
  isPublicPackageImport,
  TOOL_UI_COMMUNITY_SOURCES
} from '../community-sources'
```

Also add this test so the local notice file cannot stay as a placeholder:

```ts
it('retains the upstream notice in the local notice file', () => {
  const source = getToolUiCommunitySourceById('agent-kit-agent-artifact')

  expect(source?.sourceType).toBe('ported')
  if (source?.sourceType !== 'ported') return

  const noticeFile = source.localNoticeFile

  expect(noticeFile).toBe(
    'components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md'
  )
  if (!noticeFile) throw new Error('missing Agent Artifact notice file')

  const notice = readFileSync(noticeFile, 'utf8')

  expect(notice).toContain('Copyright (c) 2025 Abhishek Gahlot')
  expect(notice).not.toContain('Retain the exact copyright')
})
```

In `components/tool-ui/registry.test.tsx`, add this test:

```tsx
it('renders displayAgentArtifact output through the artifact component', () => {
  const node = tryRenderToolUIByName(
    'displayAgentArtifact',
    {
      id: 'artifact-1',
      title: 'API Schema',
      artifactType: 'code',
      content: 'export const schema = z.object({ name: z.string() })',
      language: 'typescript',
      metadata: {
        model: 'test-model',
        tokens: 42,
        size: '1 KB'
      }
    },
    'artifact-part'
  )

  render(<>{node}</>)

  expect(screen.getByText('API Schema')).toBeInTheDocument()
  expect(screen.getByText('typescript')).toBeInTheDocument()
  expect(screen.getByText(/schema = z.object/)).toBeInTheDocument()
})

it('returns null for invalid displayAgentArtifact output', () => {
  const node = tryRenderToolUIByName(
    'displayAgentArtifact',
    { id: 'artifact-1', content: 'missing title' },
    'artifact-part'
  )

  expect(node).toBeNull()
})
```

Create `components/tool-ui/agent-artifact/schema.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { safeParseSerializableAgentArtifact } from '..'

describe('SerializableAgentArtifactSchema', () => {
  it('accepts a minimal inline artifact', () => {
    expect(
      safeParseSerializableAgentArtifact({
        id: 'artifact-1',
        title: 'API Schema',
        artifactType: 'code',
        content: 'export const schema = {}'
      })
    ).toEqual(
      expect.objectContaining({
        id: 'artifact-1',
        title: 'API Schema'
      })
    )
  })

  it('rejects invalid artifact shape and version edges', () => {
    expect(
      safeParseSerializableAgentArtifact({
        id: 'artifact-1',
        title: '',
        artifactType: 'image',
        content: 'x',
        versions: [{ id: '', label: 'v1', timestamp: 'now', content: 'x' }]
      })
    ).toBeNull()
  })
})
```

Create `components/tool-ui/agent-artifact/agent-artifact.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { AgentArtifact } from '..'

const writeText = vi.fn()

beforeEach(() => {
  writeText.mockReset()
  Object.assign(navigator, {
    clipboard: { writeText }
  })
})

describe('AgentArtifact', () => {
  it('switches tabs, copies active version content, and shows metadata', () => {
    render(
      <AgentArtifact
        id="artifact-1"
        title="Component Spec"
        artifactType="document"
        content="old content"
        currentVersion="v2"
        versions={[
          {
            id: 'v1',
            label: 'Version 1',
            timestamp: '2026-05-01',
            content: 'old content'
          },
          {
            id: 'v2',
            label: 'Version 2',
            timestamp: '2026-05-02',
            content: 'current version content'
          }
        ]}
        metadata={{ model: 'test-model', tokens: 120, size: '2 KB' }}
      />
    )

    expect(screen.getByText('Component Spec')).toBeInTheDocument()
    expect(screen.getByText('current version content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /code/i }))
    expect(screen.getByText('current version content')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: /raw/i }))
    fireEvent.click(
      screen.getByRole('button', { name: 'Copy artifact content' })
    )

    expect(writeText).toHaveBeenCalledWith('current version content')
    expect(screen.getByText('test-model')).toBeInTheDocument()
    expect(screen.getByText('120 tokens')).toBeInTheDocument()
  })
})
```

In `lib/agents/prompts/search-mode-prompts.test.ts`, add:

```ts
it('teaches displayAgentArtifact as inline output distinct from canvas artifacts', () => {
  for (const prompt of [CHAT_MODE_PROMPT, RESEARCH_MODE_PROMPT]) {
    expect(prompt).toContain('displayAgentArtifact')
    expect(prompt).toContain('inline agent artifact')
    expect(prompt).toContain('Use createCanvasArtifact instead')
  }
})
```

In `lib/utils/__tests__/message-mapping-ui-message.test.ts`, add canonical round-trip coverage for the new passive tool and a schema-valid interactive output:

```ts
it('round-trips manifest tool parts through canonical uiMessage mapping', () => {
  const parts = [
    {
      type: 'tool-displayAgentArtifact',
      toolCallId: 'artifact-call-1',
      state: 'output-available',
      input: {
        id: 'artifact-1',
        title: 'API Schema',
        artifactType: 'code',
        content: 'export const schema = {}'
      },
      output: {
        id: 'artifact-1',
        title: 'API Schema',
        artifactType: 'code',
        content: 'export const schema = {}'
      }
    },
    {
      type: 'tool-displayQuestionWizard',
      toolCallId: 'wizard-call-1',
      state: 'output-available',
      input: {
        id: 'project-settings',
        steps: [
          {
            id: 'style',
            title: 'Style',
            options: [{ id: 'minimal', label: 'Minimal' }]
          },
          {
            id: 'tone',
            title: 'Tone',
            options: [{ id: 'friendly', label: 'Friendly' }]
          }
        ]
      },
      output: { style: 'minimal', tone: 'friendly' }
    }
  ] as any

  const mapped = mapUIMessageToDBMessage({
    id: 'msg-1',
    chatId: 'chat-1',
    role: 'assistant',
    parts
  })

  const rebuilt = buildUIMessageFromDB({
    id: 'msg-1',
    role: 'assistant',
    uiMessage: mapped.uiMessage
  })

  expect(rebuilt.parts).toEqual(parts)
})
```

In `lib/db/__tests__/chat-ui-message-load.test.ts`, add a `loadChatWithMessages` case that returns the same two parts above from the mocked `uiMessage` row and asserts the loaded message preserves `toolCallId`, `state`, `input`, and `output`.

In `components/render-message.test.tsx`, extend the registry mock so `displayAgentArtifact` is registered and `tryRenderToolUIByName('displayAgentArtifact', ...)` returns `<div data-testid="agent-artifact-tool-ui" />` for a valid artifact output. Add a reload-style test that renders an assistant message containing an `output-available` `tool-displayAgentArtifact` part with valid `input` and `output`, then asserts `screen.getByTestId('agent-artifact-tool-ui')`.

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/community-sources.test.ts lib/tools/__tests__/module-contract.test.ts components/tool-ui/registry.test.tsx components/tool-ui/agent-artifact/schema.test.ts components/tool-ui/agent-artifact/agent-artifact.test.tsx lib/agents/prompts/search-mode-prompts.test.ts lib/utils/__tests__/message-mapping-ui-message.test.ts lib/db/__tests__/chat-ui-message-load.test.ts components/render-message.test.tsx
```

Expected: FAIL because the community source row, `display-agent-artifact` modules, component files, public barrel exports, renderer, prompt guidance, and persistence/rendering fixtures are missing.

- [ ] **Step 3: Add Agent Artifact serializable schema**

Create `components/tool-ui/agent-artifact/schema.ts`:

```ts
import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'
import { ToolUIIdSchema } from '../shared/schema'

export const ArtifactTypeSchema = z.enum(['code', 'table', 'document', 'chart'])

export const ArtifactVersionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  timestamp: z.string().min(1),
  content: z.string()
})

export const ArtifactMetadataSchema = z.object({
  generationTime: z.string().optional(),
  model: z.string().optional(),
  tokens: z.number().int().nonnegative().optional(),
  size: z.string().optional()
})

export const SerializableAgentArtifactSchema = z.object({
  id: ToolUIIdSchema,
  title: z.string().min(1),
  artifactType: ArtifactTypeSchema,
  content: z.string(),
  language: z.string().optional(),
  versions: z.array(ArtifactVersionSchema).optional(),
  currentVersion: z.string().optional(),
  metadata: ArtifactMetadataSchema.optional()
})

export type SerializableAgentArtifact = z.infer<
  typeof SerializableAgentArtifactSchema
>

const contract = defineToolUiContract(
  'AgentArtifact',
  SerializableAgentArtifactSchema
)

export const parseSerializableAgentArtifact = contract.parse
export const safeParseSerializableAgentArtifact = contract.safeParse
```

- [ ] **Step 4: Add license-aware Agent Artifact component**

Create `components/tool-ui/agent-artifact/_adapter.tsx`:

```tsx
export { Button } from '@/components/ui/button'
export { cn } from '@/lib/utils'
```

Create `components/tool-ui/agent-artifact/agent-artifact.tsx`:

```tsx
'use client'

import { useMemo, useState } from 'react'

import { Check, Code2, Copy, FileText, Table2 } from 'lucide-react'

import { Button, cn } from './_adapter'
import type { SerializableAgentArtifact } from './schema'

const artifactIcons = {
  code: Code2,
  table: Table2,
  document: FileText,
  chart: Code2
}

function parseTable(content: string) {
  const rows = content
    .trim()
    .split('\n')
    .map(row => row.split(',').map(cell => cell.trim()))

  return {
    headers: rows[0] ?? [],
    body: rows.slice(1)
  }
}

export function AgentArtifact({
  id,
  title,
  artifactType,
  content,
  language,
  versions,
  currentVersion,
  metadata
}: SerializableAgentArtifact) {
  const [tab, setTab] = useState<'preview' | 'code' | 'raw'>('preview')
  const [copied, setCopied] = useState(false)

  const activeContent = useMemo(() => {
    if (!versions?.length || !currentVersion) return content
    return (
      versions.find(version => version.id === currentVersion)?.content ??
      content
    )
  }, [content, currentVersion, versions])

  const Icon = artifactIcons[artifactType]

  function copyContent() {
    void navigator.clipboard?.writeText(activeContent)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  const table = artifactType === 'table' ? parseTable(activeContent) : null

  return (
    <section
      className="overflow-hidden rounded-lg border bg-background text-sm shadow-sm"
      data-tool-ui-id={id}
      data-slot="agent-artifact"
    >
      <header className="flex items-center justify-between gap-3 border-b px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Icon className="size-4 shrink-0 text-muted-foreground" />
          <div className="min-w-0">
            <h3 className="truncate font-medium">{title}</h3>
            <p className="text-xs text-muted-foreground">
              {language ?? artifactType}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 shrink-0"
          onClick={copyContent}
          aria-label={
            copied ? 'Copied artifact content' : 'Copy artifact content'
          }
        >
          {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
        </Button>
      </header>

      <div className="flex border-b bg-muted/40 px-2 pt-2">
        {(['preview', 'code', 'raw'] as const).map(nextTab => (
          <button
            key={nextTab}
            type="button"
            className={cn(
              'rounded-t-md px-3 py-1.5 text-xs font-medium capitalize',
              tab === nextTab
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => setTab(nextTab)}
          >
            {nextTab}
          </button>
        ))}
      </div>

      <div className="max-h-[420px] overflow-auto p-3">
        {tab === 'preview' && table ? (
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr>
                {table.headers.map(header => (
                  <th key={header} className="border-b px-2 py-1 font-medium">
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {table.body.map((row, rowIndex) => (
                <tr key={`${id}-row-${rowIndex}`}>
                  {row.map((cell, cellIndex) => (
                    <td
                      key={`${id}-cell-${rowIndex}-${cellIndex}`}
                      className="border-b px-2 py-1 text-muted-foreground"
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <pre className="whitespace-pre-wrap break-words rounded-md bg-muted p-3 font-mono text-xs">
            {activeContent}
          </pre>
        )}
      </div>

      <footer className="flex flex-wrap items-center gap-2 border-t px-3 py-2 text-xs text-muted-foreground">
        {currentVersion ? <span>{currentVersion}</span> : null}
        {metadata?.model ? <span>{metadata.model}</span> : null}
        {typeof metadata?.tokens === 'number' ? (
          <span>{metadata.tokens.toLocaleString()} tokens</span>
        ) : null}
        {metadata?.size ? <span>{metadata.size}</span> : null}
        {metadata?.generationTime ? (
          <span>{metadata.generationTime}</span>
        ) : null}
      </footer>
    </section>
  )
}
```

- [ ] **Step 5: Add component indexes**

Create `components/tool-ui/agent-artifact/index.tsx`:

```ts
export { AgentArtifact } from './agent-artifact'
export type { SerializableAgentArtifact } from './schema'
export {
  parseSerializableAgentArtifact,
  safeParseSerializableAgentArtifact,
  SerializableAgentArtifactSchema
} from './schema'
```

Update `components/tool-ui/index.ts` so the public Tool UI barrel exports the proof component and parser types:

```ts
export { AgentArtifact } from './agent-artifact'
export type { SerializableAgentArtifact } from './agent-artifact'
export {
  parseSerializableAgentArtifact,
  safeParseSerializableAgentArtifact,
  SerializableAgentArtifactSchema
} from './agent-artifact'

export {
  isRegisteredToolUI,
  tryRenderToolUI,
  tryRenderToolUIByName
} from './registry'
```

The tests above should import `AgentArtifact` and `safeParseSerializableAgentArtifact` from `..` so the barrel is verified, not only the private component path.

- [ ] **Step 6: Record community source inventory and porting provenance**

In `lib/tools/tool-ui/community-sources.ts`, replace `TOOL_UI_COMMUNITY_SOURCES` with:

```ts
export const TOOL_UI_COMMUNITY_SOURCES = [
  {
    id: 'agent-kit-agent-artifact',
    sourceType: 'ported',
    upstreamProject: 'Agent Kit / agents-ui artifact UI',
    upstreamUrl: 'https://github.com/agents-ui/agents-kit',
    upstreamCommit: '03c55476a3e03a4f7ac90211f00a6a6d19706dac',
    upstreamFiles: [
      {
        path: 'components/agents-ui/agent-artifact.tsx',
        blobSha: 'c2e6265ed9ed2c219499c6a70ffa9e886e57e58d',
        url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/components/agents-ui/agent-artifact.tsx'
      },
      {
        path: 'app/docs/agent-artifact/page.mdx',
        blobSha: 'e44d7184fa1e69e655fe32e659e46fe1776804bf',
        url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/app/docs/agent-artifact/page.mdx'
      },
      {
        path: 'LICENSE.md',
        blobSha: '3c9d400a8904c040338ec6bbc982fd21b759765b',
        url: 'https://github.com/agents-ui/agents-kit/blob/03c55476a3e03a4f7ac90211f00a6a6d19706dac/LICENSE.md'
      }
    ],
    license:
      'non-commercial; personal and internal evaluation allowed, commercial use requires permission',
    attributionNotice:
      'Copyright (c) 2025 Abhishek Gahlot. Permission notice retained for the adapted non-commercial Agent Artifact port.',
    localNoticeFile: 'components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md',
    copiedFiles: [],
    adaptedFiles: [
      'components/tool-ui/agent-artifact/agent-artifact.tsx',
      'components/tool-ui/agent-artifact/schema.ts',
      'lib/tools/display-agent-artifact/result.tsx'
    ],
    adapterFiles: [
      'components/tool-ui/agent-artifact/_adapter.tsx',
      'components/tool-ui/agent-artifact/agent-artifact.tsx',
      'lib/tools/display-agent-artifact/result.tsx'
    ],
    runtimeNotes:
      'Polymorph keeps its local AI SDK v6 chat runtime and renders through the manifest renderer catalog instead of adopting the upstream runtime.'
  }
] as const satisfies readonly ToolUiCommunitySource[]
```

Create `components/tool-ui/agent-artifact/README.md`:

```md
# Agent Artifact Community Port

- Upstream project: Agent Kit / agents-ui artifact UI
- Upstream source URL: https://github.com/agents-ui/agents-kit
- Upstream commit: `03c55476a3e03a4f7ac90211f00a6a6d19706dac`
- Upstream file: `components/agents-ui/agent-artifact.tsx` (`c2e6265ed9ed2c219499c6a70ffa9e886e57e58d`)
- Upstream docs file: `app/docs/agent-artifact/page.mdx` (`e44d7184fa1e69e655fe32e659e46fe1776804bf`)
- Upstream license file: `LICENSE.md` (`3c9d400a8904c040338ec6bbc982fd21b759765b`)
- Source type: ported local component, not npm package consumption.
- Upstream license: non-commercial; personal and internal evaluation allowed, commercial use requires permission. The project owner clarified Polymorph is personal/non-commercial.
- Upstream notice retained: Copyright (c) 2025 Abhishek Gahlot. The exact upstream permission notice is preserved in `UPSTREAM-LICENSE.md` for this adapted port.
- Upstream runtime adopted: none. Polymorph keeps its local AI SDK v6 chat runtime and bespoke Tool UI renderer.
- Dependencies adopted: existing React, `lucide-react`, local shadcn `Button`, and local `cn` utility through `./_adapter`.
- Files copied as-is: none for this v1.
- Files adapted: artifact behavior contract only: title, artifact type, content, versions, active version, metadata, tabs, copy action.
- Adapter files: `components/tool-ui/agent-artifact/_adapter.tsx` re-exports local `Button` and `cn` for the ported component.
- Local runtime deviations: renders through `components/tool-ui/renderer-catalog.tsx`, uses `ToolCardMount` and `ToolErrorBoundary`, and is model-exposed through `lib/tools/display-agent-artifact/*`.
- Future npm path: if Agent Kit or another AI SDK-standardized package exposes an equivalent public npm component, prefer `sourceType: 'npm'`, import that public export, and keep only Polymorph mapping in local adapter files.
```

Create `components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md` with a short provenance header containing the upstream repo, commit, license file path, license blob, and local port status. Below that header, copy the exact upstream copyright and permission notice from the pinned upstream `LICENSE.md`. Do not commit placeholder text in this file; the community-source test above should fail if the notice file is missing or still contains placeholder instructions.

- [ ] **Step 7: Add AI SDK tool module**

Create `lib/tools/display-agent-artifact/schema.ts`:

```ts
import {
  SerializableAgentArtifactSchema,
  type SerializableAgentArtifact
} from '@/components/tool-ui/agent-artifact/schema'

export const toolName = 'displayAgentArtifact' as const
export const inputSchema = SerializableAgentArtifactSchema
export const outputSchema = inputSchema

export type DisplayAgentArtifactInput = SerializableAgentArtifact
export type DisplayAgentArtifactOutput = SerializableAgentArtifact
```

Create `lib/tools/display-agent-artifact/server.ts`:

```ts
import { createPassthroughDisplayTool } from '@/lib/tools/tool-ui/server'

import { inputSchema } from './schema'

export const serverTool = createPassthroughDisplayTool({
  description:
    'Display an AI-generated artifact with preview, code, raw content, optional versions, and generation metadata. Use for static inline artifacts that do not require the canvas workspace.',
  inputSchema
})
```

Create `lib/tools/display-agent-artifact/result.tsx`:

```tsx
'use client'

import type { ReactNode } from 'react'

import { ToolCardMount } from '@/components/motion/tool-card-mount'
import { AgentArtifact } from '@/components/tool-ui/agent-artifact/agent-artifact'
import { safeParseSerializableAgentArtifact } from '@/components/tool-ui/agent-artifact/schema'
import { ToolErrorBoundary } from '@/components/tool-ui/tool-error-boundary'

export const ResultComponent = AgentArtifact

export function tryRenderResult(
  output: unknown,
  partId: string
): ReactNode | null {
  const parsed = safeParseSerializableAgentArtifact(output)
  if (!parsed) return null

  return (
    <ToolErrorBoundary toolName="AgentArtifact">
      <ToolCardMount partId={partId}>
        <AgentArtifact {...parsed} />
      </ToolCardMount>
    </ToolErrorBoundary>
  )
}
```

Create `lib/tools/display-agent-artifact/index.ts`:

```ts
export { ResultComponent, tryRenderResult } from './result'
export type {
  DisplayAgentArtifactInput,
  DisplayAgentArtifactOutput
} from './schema'
export { inputSchema, outputSchema, toolName } from './schema'
export { serverTool } from './server'
```

Create `lib/tools/display-agent-artifact.ts`:

```ts
export type {
  DisplayAgentArtifactInput,
  DisplayAgentArtifactOutput
} from './display-agent-artifact/schema'
export {
  inputSchema as displayAgentArtifactInputSchema,
  outputSchema as displayAgentArtifactOutputSchema,
  toolName as displayAgentArtifactToolName,
  inputSchema,
  outputSchema,
  toolName
} from './display-agent-artifact/schema'
export {
  serverTool as displayAgentArtifactTool,
  serverTool
} from './display-agent-artifact/server'
```

- [ ] **Step 8: Register the new tool in catalogs**

In `lib/tools/tool-ui/metadata.ts`, insert this row before `displayOptionList`:

```ts
  {
    name: 'displayAgentArtifact',
    kind: 'passive-display',
    activeIn: ['search', 'research', 'build'],
    communitySourceId: 'agent-kit-agent-artifact'
  },
```

In `lib/tools/tool-ui/server-catalog.ts`, add this import:

```ts
import { serverTool as displayAgentArtifactTool } from '@/lib/tools/display-agent-artifact/server'
```

Add this property to `SERVER_TOOLS_BY_NAME` in the same order as metadata:

```ts
  displayAgentArtifact: displayAgentArtifactTool,
```

In `components/tool-ui/renderer-catalog.tsx`, add this import:

```ts
import { tryRenderResult as tryRenderDisplayAgentArtifactResult } from '@/lib/tools/display-agent-artifact/result'
```

Add this renderer entry in the same order as metadata:

```ts
  {
    name: 'displayAgentArtifact',
    tryRender: tryRenderDisplayAgentArtifactResult
  },
```

In `lib/types/agent.ts`, keep any useful named invocation aliases, add the new alias, and make the exported union derive from `ResearcherTools` so manifest-managed tools cannot drift out of the type:

```ts
type ResearcherToolInvocationMap = {
  [ToolName in keyof ResearcherTools]: UIToolInvocation<
    ResearcherTools[ToolName]
  >
}

export type DisplayAgentArtifactToolInvocation =
  ResearcherToolInvocationMap['displayAgentArtifact']

export type ResearcherToolInvocation =
  ResearcherToolInvocationMap[keyof ResearcherToolInvocationMap]
```

Do not append `DisplayAgentArtifactToolInvocation` to the old explicit union as the only fix; the point is to remove the hand-maintained union as a drift source.

- [ ] **Step 9: Update metadata test expectations for the proof tool**

In `lib/tools/tool-ui/__tests__/metadata.test.ts`, update the search-mode expectation to:

```ts
expect(getToolUiToolNamesForMode('search')).toEqual([
  'displayPlan',
  'displayTable',
  'displayChart',
  'displayGeoMap',
  'displayCitations',
  'displayLinkPreview',
  'displayAgentArtifact',
  'displayOptionList',
  'displayQuestionWizard',
  'displayCallout',
  'displayTimeline'
])
```

Update the research-mode expectation to:

```ts
expect(getToolUiToolNamesForMode('research')).toEqual([
  'displayTable',
  'displayChart',
  'displayGeoMap',
  'displayCitations',
  'displayLinkPreview',
  'displayAgentArtifact',
  'displayOptionList',
  'displayQuestionWizard',
  'displayCallout',
  'displayTimeline'
])
```

Update the build-mode expectation to include `displayAgentArtifact` in the same position:

```ts
expect(getToolUiToolNamesForMode('build')).toEqual([
  'displayPlan',
  'displayTable',
  'displayChart',
  'displayGeoMap',
  'displayCitations',
  'displayLinkPreview',
  'displayAgentArtifact',
  'displayOptionList',
  'displayQuestionWizard',
  'displayCallout',
  'displayTimeline'
])
```

Add this metadata/source linkage assertion:

```ts
it('links displayAgentArtifact to its community source record', () => {
  expect(
    TOOL_UI_TOOL_METADATA.find(tool => tool.name === 'displayAgentArtifact')
  ).toMatchObject({
    communitySourceId: 'agent-kit-agent-artifact'
  })
})
```

- [ ] **Step 10: Teach the model when to use inline agent artifacts**

In `lib/agents/prompts/search-mode-prompts.ts`, add `displayAgentArtifact` guidance to the shared display-tool guidance used by both chat and research prompts:

```md
**displayAgentArtifact** — Use for inline agent artifacts: static generated code snippets, documents, tables, specs, or artifact versions that should stay inside the chat answer. Use this when the user needs to inspect/copy a self-contained artifact but does not need the canvas workspace.

Do not use `displayAgentArtifact` for app files, multi-file projects, previews, iterative code editing, or anything the user is likely to revise in the canvas. Use createCanvasArtifact instead for canvas artifacts, runnable UI, editable source files, or artifact updates.
```

Keep this distinction explicit anywhere canvas guidance appears: `displayAgentArtifact` is inline chat output, while `createCanvasArtifact` / `updateCanvasArtifact` are canvas workspace artifacts.

After the tool is registered in metadata and agent toolsets, update active-tool docs:

- In `docs/architecture/OVERVIEW.md`, add `displayAgentArtifact` to the build/search/research mode tool lists and any Mermaid nodes that enumerate Tool UI display tools. Place it after `displayLinkPreview` and before the interactive display tools.
- In `docs/reference/FILE-INDEX.md`, add the new `components/tool-ui/agent-artifact/*`, `lib/tools/display-agent-artifact/*`, public barrel, type, persistence-test, and notice-file entries.
- In `GEMINI.md`, add `displayAgentArtifact` to the chat/research active tool lists in the same position.

Verify the docs mention the tool only after this Task 7 registration work:

```bash
rg -n 'displayAgentArtifact' docs/architecture/OVERVIEW.md GEMINI.md
```

- [ ] **Step 11: Run focused proof tests**

Run:

```bash
bun run test -- --run lib/tools/tool-ui/__tests__/community-sources.test.ts lib/tools/tool-ui/__tests__/metadata.test.ts lib/tools/tool-ui/__tests__/server-catalog.test.ts lib/tools/__tests__/module-contract.test.ts components/tool-ui/registry.test.tsx components/tool-ui/registry.server.test.tsx components/tool-ui/agent-artifact/schema.test.ts components/tool-ui/agent-artifact/agent-artifact.test.tsx lib/agents/prompts/search-mode-prompts.test.ts lib/utils/__tests__/message-mapping-ui-message.test.ts lib/db/__tests__/chat-ui-message-load.test.ts components/render-message.test.tsx
```

Expected: PASS.

- [ ] **Step 12: Run typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 13: Commit the proof component**

Run:

```bash
git add -- \
  components/tool-ui/agent-artifact/schema.ts \
  components/tool-ui/agent-artifact/schema.test.ts \
  components/tool-ui/agent-artifact/_adapter.tsx \
  components/tool-ui/agent-artifact/agent-artifact.tsx \
  components/tool-ui/agent-artifact/agent-artifact.test.tsx \
  components/tool-ui/agent-artifact/index.tsx \
  components/tool-ui/agent-artifact/README.md \
  components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md \
  components/tool-ui/index.ts \
  components/tool-ui/renderer-catalog.tsx \
  components/tool-ui/registry.test.tsx \
  components/tool-ui/registry.server.test.tsx \
  components/render-message.test.tsx \
  lib/tools/display-agent-artifact/schema.ts \
  lib/tools/display-agent-artifact/server.ts \
  lib/tools/display-agent-artifact/result.tsx \
  lib/tools/display-agent-artifact/index.ts \
  lib/tools/display-agent-artifact.ts \
  lib/tools/tool-ui/community-sources.ts \
  lib/tools/tool-ui/metadata.ts \
  lib/tools/tool-ui/server-catalog.ts \
  lib/tools/tool-ui/__tests__/community-sources.test.ts \
  lib/tools/tool-ui/__tests__/metadata.test.ts \
  lib/tools/__tests__/module-contract.test.ts \
  lib/types/agent.ts \
  lib/utils/__tests__/message-mapping-ui-message.test.ts \
  lib/db/__tests__/chat-ui-message-load.test.ts \
  lib/agents/prompts/search-mode-prompts.ts \
  lib/agents/prompts/search-mode-prompts.test.ts \
  docs/architecture/OVERVIEW.md \
  docs/reference/FILE-INDEX.md \
  GEMINI.md
git commit -m "feat: add manifest-driven agent artifact display tool"
```

---

### Task 8: Final Verification

**Files:**

- Verify only

- [ ] **Step 1: Run focused Tool UI contract suite**

Run:

```bash
bun run test -- --run \
  lib/tools/tool-ui/__tests__/community-sources.test.ts \
  lib/tools/tool-ui/__tests__/metadata.test.ts \
  lib/tools/tool-ui/__tests__/server-catalog.test.ts \
  lib/tools/__tests__/module-contract.test.ts \
  components/tool-ui/registry.test.tsx \
  components/tool-ui/registry.server.test.tsx \
  components/tool-ui/agent-artifact/schema.test.ts \
  components/tool-ui/agent-artifact/agent-artifact.test.tsx \
  components/tool-ui/tool-part-registry.test.tsx \
  components/chat-request.test.ts \
  lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts \
  lib/utils/__tests__/message-mapping-ui-message.test.ts \
  lib/db/__tests__/chat-ui-message-load.test.ts \
  components/render-message.test.tsx \
  lib/agents/chat/__tests__/registry.test.ts \
  lib/agents/chat/__tests__/community-portability.test.ts \
  lib/agents/prompts/search-mode-prompts.test.ts \
  lib/agents/__tests__/researcher.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run full typecheck**

Run:

```bash
bun run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
bun run test
```

Expected: PASS. If unrelated tests fail, record the failing test names and confirm the focused Tool UI suite still passes.

- [ ] **Step 4: Inspect changed files**

Run:

```bash
git status --short
git diff --stat
```

Expected: only files listed in this plan are changed.

- [ ] **Step 5: Commit final docs or test adjustments**

Run if Step 4 shows uncommitted planned files:

```bash
git diff --name-only
git add -- \
  docs/architecture/GENERATIVE-UI.md \
  docs/architecture/RESEARCH-AGENT.md \
  docs/architecture/OVERVIEW.md \
  docs/reference/FILE-INDEX.md \
  docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime-codex-multi-agent.md \
  docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime.md \
  GEMINI.md \
  lib/tools/tool-ui/community-sources.ts \
  lib/tools/tool-ui/metadata.ts \
  lib/tools/tool-ui/server.ts \
  lib/tools/tool-ui/server-catalog.ts \
  lib/tools/tool-ui/client-output-validation.ts \
  lib/tools/tool-ui/__tests__/community-sources.test.ts \
  lib/tools/tool-ui/__tests__/metadata.test.ts \
  lib/tools/tool-ui/__tests__/server-catalog.test.ts \
  lib/tools/display-agent-artifact/schema.ts \
  lib/tools/display-agent-artifact/server.ts \
  lib/tools/display-agent-artifact/result.tsx \
  lib/tools/display-agent-artifact/index.ts \
  lib/tools/display-agent-artifact.ts \
  lib/tools/display-option-list/server.ts \
  lib/tools/display-question-wizard/server.ts \
  lib/tools/__tests__/module-contract.test.ts \
  components/tool-ui/renderer-catalog.tsx \
  components/tool-ui/interactive-renderer-catalog.tsx \
  components/tool-ui/registry.tsx \
  components/tool-ui/registry.test.tsx \
  components/tool-ui/registry.server.test.tsx \
  components/tool-ui/tool-part-registry.tsx \
  components/tool-ui/tool-part-registry.test.tsx \
  components/tool-ui/index.ts \
  components/tool-ui/agent-artifact/schema.ts \
  components/tool-ui/agent-artifact/schema.test.ts \
  components/tool-ui/agent-artifact/_adapter.tsx \
  components/tool-ui/agent-artifact/agent-artifact.tsx \
  components/tool-ui/agent-artifact/agent-artifact.test.tsx \
  components/tool-ui/agent-artifact/index.tsx \
  components/tool-ui/agent-artifact/README.md \
  components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md \
  components/chat-request.test.ts \
  components/render-message.test.tsx \
  lib/agents/chat/toolset.ts \
  lib/agents/chat/search.ts \
  lib/agents/chat/research.ts \
  lib/agents/chat/build.ts \
  lib/agents/chat/factory.ts \
  lib/agents/chat/__tests__/community-portability.test.ts \
  lib/agents/chat/__tests__/registry.test.ts \
  lib/agents/prompts/search-mode-prompts.ts \
  lib/agents/prompts/search-mode-prompts.test.ts \
  lib/types/dynamic-tools.ts \
  lib/types/agent.ts \
  lib/streaming/helpers/prepare-tool-result-messages.ts \
  lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts \
  lib/utils/__tests__/message-mapping-ui-message.test.ts \
  lib/db/__tests__/chat-ui-message-load.test.ts
git commit -m "test: verify manifest-driven tool ui onboarding"
```

Expected: `git diff --name-only` is reviewed before staging; either a new commit is created for remaining planned files, or Git reports nothing to commit because earlier task commits captured all changes. Do not stage whole directories in this final catch-all command.

---

## Self-Review

**Spec coverage:** The plan centralizes passive display metadata, community source provenance, server tools, renderer registration, active agent exposure, output validation before persistence, and interactive continuation. It documents an npm-first path for AI SDK-standardized community components, keeps copied/ported source as a fallback, and proves the path with a license-aware Agent Artifact community port that pins upstream source, docs, and license files.

**Placeholder scan:** No deferred implementation markers are present. Each task names exact files, code blocks, commands, and expected results.

**Type consistency:** Tool names use exact existing names: `displayPlan`, `displayTable`, `displayChart`, `displayGeoMap`, `displayCitations`, `displayLinkPreview`, `displayOptionList`, `displayQuestionWizard`, `displayCallout`, `displayTimeline`, and new `displayAgentArtifact`. Interactive part types are derived as `tool-${tool.name}` and remain `tool-displayOptionList` and `tool-displayQuestionWizard`; agent tool invocation types derive from `ResearcherTools` instead of a hand-maintained union.

**Scope check:** This plan intentionally keeps one Polymorph AI SDK runtime and adds a local manifest/adapter layer for community components. It does not add assistant-ui, Agent Kit, or upstream Tool UI runtimes. For npm community sources, package code remains upstream-owned and Polymorph-specific changes stay in local adapter files.

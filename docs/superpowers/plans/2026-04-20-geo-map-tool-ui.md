# Geo Map Tool UI Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a non-interactive `displayGeoMap` tool that lets the researcher agent render Leaflet-based maps with markers, routes, clustering, and viewport control — wired end-to-end through the repo's bespoke Tool UI registry, not assistant-ui / Toolkit / tool-agent.

**Architecture:** Vendor the current live `@tool-ui/geo-map` registry block into `components/tool-ui/geo-map/` (today that is a multi-file Leaflet shell: `_adapter.tsx`, `geo-map-engine.tsx`, `geo-map-icons.ts`, `geo-map-overlays.tsx`, `geo-map.tsx`, `geo-map-theme.module.css`, `index.tsx`, `schema.ts`, and `README.md`, plus possible rewrites to existing shared Tool UI helpers). Treat `components/tool-ui/geo-map/schema.ts` as the source of truth for render-critical field names and validation rules. The agent-side Zod schema at `lib/tools/display-geo-map.ts` may omit repo-wide optional Tool UI metadata fields such as `role` and `receipt` to match existing `display*` tool precedent, but it must mirror the actual marker/route/viewport/icon constraints used by the renderer. Register the tool in `lib/agents/researcher.ts` (tools map + both `activeToolsList` branches), add a `ToolUIEntry` to `components/tool-ui/registry.tsx`, and load `leaflet/dist/leaflet.css` once from `app/layout.tsx`. Enforce parity with both positive and negative schema cases — not just happy-path payloads.

**Tech Stack:** Next.js 16 (App Router, RSC), React 19, TypeScript strict, Zod, Vitest + React Testing Library, Leaflet, shadcn CLI (as transport only), `ai` SDK `ToolLoopAgent`, Tailwind v4.

---

## File Structure

### Files created

| Path                                                                                                                                  | Responsibility                                                                                                                                                   |
| ------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `components/tool-ui/geo-map/geo-map.tsx`                                                                                              | `GeoMap` React component (installed by shadcn; do not hand-author). `'use client'`.                                                                              |
| `components/tool-ui/geo-map/schema.ts`                                                                                                | `SerializableGeoMapSchema`, `parseSerializableGeoMap`, `safeParseSerializableGeoMap` (installed by shadcn).                                                      |
| `components/tool-ui/geo-map/geo-map-theme.module.css`                                                                                 | Component-scoped styles (installed by shadcn).                                                                                                                   |
| `components/tool-ui/geo-map/_adapter.tsx`, `geo-map-engine.tsx`, `geo-map-icons.ts`, `geo-map-overlays.tsx`, `index.tsx`, `README.md` | Current upstream runtime/support files required by the live `@tool-ui/geo-map` registry block. Keep them unless you intentionally vendor a different equivalent. |
| `components/tool-ui/geo-map/__tests__/schema.test.ts`                                                                                 | Client-side schema parse tests (hand-authored).                                                                                                                  |
| `components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`                                                                          | Positive/negative parity test asserting agent-side + client-side schemas make the same accept/reject decision on render-critical payloads.                       |
| `lib/tools/display-geo-map.ts`                                                                                                        | Agent-side Zod schema + `displayGeoMapTool` registration (`tool({ inputSchema, execute: async p => p })`).                                                       |
| `lib/tools/__tests__/display-geo-map.test.ts`                                                                                         | Agent-side schema parse tests.                                                                                                                                   |

### Files modified

| Path                                                                                                                      | Change                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `app/layout.tsx`                                                                                                          | Add `import 'leaflet/dist/leaflet.css'` (single global import, alongside `./globals.css`).                                                                                                                                                       |
| `lib/types/agent.ts`                                                                                                      | Add `displayGeoMapTool` import, `displayGeoMap` field on `ResearcherTools`, `DisplayGeoMapToolInvocation` alias, add to union.                                                                                                                   |
| `lib/agents/researcher.ts`                                                                                                | Import tool; add `displayGeoMap: displayGeoMapTool` to the `tools` object (line ~310); add `'displayGeoMap'` to both `chat` and `research` `activeToolsList` branches (lines ~201–213 and ~224–235).                                             |
| `lib/agents/prompts/search-mode-prompts.ts`                                                                               | Add a `**displayGeoMap** …` bullet in the DISPLAY TOOLS sections of both `getChatModePrompt()` (inside the string literal around line 244) and `getResearchModePrompt()` (around line 548), matching the `TRIGGER:` + `Examples:` bullet format. |
| `lib/agents/__tests__/researcher.test.ts`                                                                                 | Add `vi.mock('@/lib/tools/display-geo-map', …)` to the mock list (top of file); extend both chat-mode and research-mode test blocks with `expect(config.activeTools).toContain('displayGeoMap')`.                                                |
| `lib/utils/__tests__/message-mapping-display-tools.test.ts`                                                               | Add `'displayGeoMap'` to the `DISPLAY_TOOLS` array at line 11 so the UI ↔ DB round-trip `it.each` coverage picks it up.                                                                                                                          |
| `docs/architecture/RESEARCH-AGENT.md`, `docs/architecture/GENERATIVE-UI.md`, `docs/architecture/OVERVIEW.md`, `GEMINI.md` | Repair the enumerated active-tool sets while adding `displayGeoMap`; if a touched list/table is already stale (for example missing `displayQuestionWizard` where the code already exposes it), fix that drift in the same edit.                  |
| `components/tool-ui/registry.tsx`                                                                                         | Add `import { GeoMap } from './geo-map/geo-map'` + `import { safeParseSerializableGeoMap } from './geo-map/schema'`; append a `ToolUIEntry` with `name: 'displayGeoMap'`.                                                                        |
| `components/tool-ui/registry.test.tsx`                                                                                    | Add a render test for `tryRenderToolUIByName('displayGeoMap', validOutput, ...)` with a Leaflet mock (see Task 6).                                                                                                                               |
| `package.json`                                                                                                            | Add `leaflet`, `react-leaflet`, and `supercluster` deps if the shadcn install did not already add them. Only add `@types/leaflet` if `bun typecheck` proves the installed packages still do not expose the needed types.                         |

### Files explicitly NOT modified

- `lib/streaming/helpers/prepare-tool-result-messages.ts` — tool is non-interactive; no continuation flow needed.
- `components/chat.tsx` / `components/chat-request.ts` — no `addToolResult` path.
- `lib/types/dynamic-tools.ts` — do not add `tool-displayGeoMap` to `INTERACTIVE_TOOL_TYPES`.
- `components/render-message.tsx` — the generic display-tool renderer at lines ~608–625 already routes by `tryRenderToolUIByName(toolName, output, partId)`; the new registry entry wires it automatically.

---

## Non-Obvious Invariants (must hold at end of plan)

1. **Registry name parity.** The entry's `name` in `registry.tsx` must be exactly `'displayGeoMap'` — same as the key in `tools` on `researcher.ts:310` and the export in `lib/types/agent.ts`. A mismatch fails silently (renderer returns `null`, UI shows nothing).
2. **Tool is non-interactive.** `execute: async params => params` passthrough. Do NOT add `'tool-displayGeoMap'` to `INTERACTIVE_TOOL_TYPES` in `lib/types/dynamic-tools.ts`.
3. **Schemas must not drift.** The agent-side schema (`lib/tools/display-geo-map.ts`) must match the client-side schema's render-critical constraints in `components/tool-ui/geo-map/schema.ts` (marker/route IDs, lat/lng bounds, icon URL rules, viewport rules, duplicate checks, etc.). Optional shared Tool UI metadata fields (`role`, `receipt`) may remain client-only to match existing repo precedent. Task 7 enforces parity with both valid and invalid fixtures. If parity fails, move the agent-side schema back toward the client-side contract — do not loosen the client renderer's schema just to make a test green.
4. **CSS loads exactly once, at the root.** `leaflet/dist/leaflet.css` in `app/layout.tsx` — not from the component, not per-message. Importing it inside a `'use client'` module can work but leaks into the client bundle twice if other consumers also import it.
5. **Client boundary holds.** The geo-map component sits behind `registry.tsx`'s `'use client'` pragma. Do not re-export it from any server component.
6. **`bun lint` + `bun typecheck` + `bun run test` all pass before the PR is opened** (CLAUDE.md quality bar).

---

## Task 0: Preflight

**Files:** _(none changed)_

- [ ] **Step 1: Verify tree state and branch before touching anything**

```bash
git status
git branch --show-current
```

Expected: branch state understood before any install. A dirty tree is acceptable if you preserve unrelated work; do **not** blindly restore files just to force cleanliness. If you're on `main`, branch off before making changes:

```bash
git checkout -b feat/geo-map-tool-ui
```

- [ ] **Step 2: Sanity-check the reference tool we're mirroring**

Open these in order so you have the non-interactive tool pattern in your head before you write anything:

- `lib/tools/display-chart.ts` — shape of agent-side Zod schema with `.describe()` and `execute: async p => p`.
- `components/tool-ui/chart/schema.ts` — shape of client-side schema using `defineToolUiContract('Chart', …)`.
- `components/tool-ui/registry.tsx:81-92` — exact shape of a `ToolUIEntry` for a non-interactive tool.
- `lib/agents/researcher.ts:310` and `:206`, `:228` — tool registration points.
- `lib/types/agent.ts:32`, `:67-69`, `:108` — where the type plumbing lives.

Read them, don't skim. This plan only works if each touchpoint is mirrored exactly.

---

## Task 1: Install the component via shadcn CLI

**Files:**

- Create/modify: `components/tool-ui/geo-map/**` (current upstream block is multi-file, not just three files)
- Modify: `package.json` (runtime deps added by installer)
- Modify: `bun.lock`
- Potentially modify: `components/tool-ui/shared/{contract,parse,schema}.ts` only if the installer introduces a **semantic** change you intentionally keep

- [ ] **Step 1: Run the shadcn add command**

```bash
npx shadcn@latest add @tool-ui/geo-map
```

Expected: the current live registry item writes a **full** `components/tool-ui/geo-map/` directory (including engine/icon/overlay/index support files) and installs runtime deps `leaflet`, `react-leaflet`, and `supercluster`. Do NOT accept additions of `@assistant-ui/*`, `assistant-ui`, or `tool-agent` — if prompted, answer **no**. If the installer tries to modify `components/tool-ui/shared/*.ts`, inspect the diff carefully: this repo already has those helpers, and for this integration no semantic shared-helper change is expected. If it tries to modify unrelated app files such as `components/render-message.tsx` or `components/chat.tsx`, reject and re-run interactively with `--yes=false`.

- [ ] **Step 2: Inspect what landed**

```bash
git status
git diff --stat
```

Expected: changes should be limited to `components/tool-ui/geo-map/**`, `package.json`, `bun.lock`, and possibly `components/tool-ui/shared/*.ts` if the installer attempted helper rewrites. Do **not** blanket `git restore` everything else. Compare each unexpected diff, preserve unrelated work already in the tree, and only revert installer-introduced noise you understand.

- [ ] **Step 3: Open the installed files and confirm the live upstream footprint**

Confirm `components/tool-ui/geo-map/geo-map.tsx` starts with `'use client'`. If missing, add it:

```ts
'use client'
```

Confirm `components/tool-ui/geo-map/index.tsx` exists and re-exports `GeoMap`, and `components/tool-ui/geo-map/schema.ts` exports these three symbols (names must match verbatim for the registry wire-up in Task 6):

```ts
export const SerializableGeoMapSchema // zod schema
export const parseSerializableGeoMap
export const safeParseSerializableGeoMap
```

If the upstream package uses slightly different names (e.g. `GeoMapPropsSchema`, `parseGeoMap`), add aliases so the registry-facing API matches:

```ts
export const SerializableGeoMapSchema = GeoMapPropsSchema
export const parseSerializableGeoMap = (input: unknown) =>
  SerializableGeoMapSchema.parse(input)
export const safeParseSerializableGeoMap = (input: unknown) => {
  const r = SerializableGeoMapSchema.safeParse(input)
  return r.success ? r.data : null
}
```

- [ ] **Step 3b: Record the installed schema shape — LOAD-BEARING for Task 3**

Open `components/tool-ui/geo-map/schema.ts` and transcribe every render-critical field on `SerializableGeoMapSchema` (name, Zod type, constraints, optional-ness) into a scratch note. Pay special attention to the live upstream rules the draft frequently drifts on: finite lat/lng bounds, optional `viewport.target`, duplicate marker/route ID rejection, and the `http(s)` + width/height/borderRadius constraints on `icon.type === 'image'`. Task 3's agent-side schema MUST mirror those rules. The upstream client schema is the source of truth for what the renderer actually accepts.

- [ ] **Step 4: Confirm peer deps**

```bash
grep -E '"leaflet"|"react-leaflet"|"supercluster"' package.json
```

Expected: all three runtime deps present. If any are missing:

```bash
bun add leaflet react-leaflet supercluster
```

Only add `@types/leaflet` if `bun typecheck` explicitly complains about missing Leaflet declarations after the runtime deps are installed.

- [ ] **Step 5: Typecheck the fresh files in isolation**

```bash
bun typecheck
```

Expected: no errors from `components/tool-ui/geo-map/**`. If the install rewrote `components/tool-ui/shared/*.ts` with formatting-only churn, revert those hunks before committing. If the component imports a helper that doesn't exist in this repo, replace it with the local equivalent and document the swap in the commit message.

- [ ] **Step 6: Commit**

```bash
git add components/tool-ui/geo-map package.json bun.lock
git commit -m "chore(tool-ui): vendor @tool-ui/geo-map component"
```

If you intentionally kept a semantic diff in `components/tool-ui/shared/*.ts`, stage those files in the same commit. Do **not** stage formatting-only churn there.

---

## Task 2: Wire the Leaflet CSS import

**Files:**

- Modify: `app/layout.tsx`

- [ ] **Step 1: Add the CSS import next to `./globals.css`**

Open `app/layout.tsx` and change the import block near line 13:

```tsx
import './globals.css'
import 'leaflet/dist/leaflet.css'
```

Keep this exact order: `globals.css` first (Tailwind layer resets), Leaflet second (overrides are fine; Leaflet scopes its own selectors).

- [ ] **Step 2: Confirm no build break without stomping an existing dev server**

```bash
lsof -nP -iTCP:43100 -sTCP:LISTEN
```

If this repo already has a dev server listening on `43100`, reuse it. If nothing is listening, run:

```bash
bun dev
```

If `43100` is occupied by an unrelated process, run `bun x next dev -p 43101` instead and use that URL for the manual checks below. Do not kill a long-lived unrelated process by reflex. Open the app in a browser and confirm the home screen renders without errors in the browser console or terminal.

- [ ] **Step 3: Commit**

```bash
git add app/layout.tsx
git commit -m "chore(layout): load leaflet css at root"
```

---

## Task 3: Agent-side tool definition (TDD)

**Files:**

- Create: `lib/tools/__tests__/display-geo-map.test.ts`
- Create: `lib/tools/display-geo-map.ts`

- [ ] **Step 1: Write the failing schema test**

Create `lib/tools/__tests__/display-geo-map.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { displayGeoMapTool } from '../display-geo-map'

const schema = displayGeoMapTool.inputSchema

describe('displayGeoMapTool input schema', () => {
  it('accepts a minimal marker-only payload', () => {
    const r = schema.safeParse({
      id: 'm-1',
      markers: [{ id: 'a', lat: 34.05, lng: -118.24 }]
    })
    expect(r.success).toBe(true)
  })

  it('accepts markers + routes + clustering + fit viewport', () => {
    const r = schema.safeParse({
      id: 'fleet',
      title: 'Fleet',
      markers: [
        {
          id: 'truck-14',
          lat: 34.05,
          lng: -118.24,
          label: 'Truck 14',
          icon: { type: 'emoji', value: '🚚' }
        }
      ],
      routes: [
        {
          id: 'r1',
          points: [
            { lat: 33.94, lng: -118.4 },
            { lat: 34.05, lng: -118.24 }
          ],
          color: '#2563EB'
        }
      ],
      clustering: { enabled: true },
      viewport: {
        mode: 'fit',
        target: 'all',
        padding: 40,
        maxZoom: 11
      }
    })
    expect(r.success).toBe(true)
  })

  it('accepts a center viewport', () => {
    const r = schema.safeParse({
      id: 'm-2',
      markers: [{ id: 'a', lat: 0, lng: 0 }],
      viewport: { mode: 'center', center: { lat: 0, lng: 0 }, zoom: 4 }
    })
    expect(r.success).toBe(true)
  })

  it('rejects out-of-range latitude', () => {
    const r = schema.safeParse({
      id: 'm-3',
      markers: [{ id: 'a', lat: 100, lng: 0 }]
    })
    expect(r.success).toBe(false)
  })

  it('rejects empty markers array', () => {
    const r = schema.safeParse({ id: 'm-4', markers: [] })
    expect(r.success).toBe(false)
  })

  it('rejects a route with fewer than two points', () => {
    const r = schema.safeParse({
      id: 'm-5',
      markers: [{ id: 'a', lat: 0, lng: 0 }],
      routes: [{ id: 'r', points: [{ lat: 0, lng: 0 }] }]
    })
    expect(r.success).toBe(false)
  })

  it('rejects duplicate marker ids', () => {
    const r = schema.safeParse({
      id: 'm-6',
      markers: [
        { id: 'dup', lat: 34.05, lng: -118.24 },
        { id: 'dup', lat: 37.77, lng: -122.42 }
      ]
    })
    expect(r.success).toBe(false)
  })

  it('rejects non-http image icon URLs', () => {
    const r = schema.safeParse({
      id: 'm-7',
      markers: [
        {
          id: 'a',
          lat: 34.05,
          lng: -118.24,
          icon: { type: 'image', url: 'ftp://example.com/icon.png' }
        }
      ]
    })
    expect(r.success).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- lib/tools/__tests__/display-geo-map.test.ts
```

Expected: FAIL with `Cannot find module '../display-geo-map'`.

- [ ] **Step 3: Create the tool**

> **Before writing:** Reconcile the schema below against what you recorded in Task 1 Step 3b from the installed upstream `SerializableGeoMapSchema`. If upstream differs, change this code block to match upstream and only THEN write the file. The agent-side schema is downstream of the client-side schema, not the other way around.
>
> **Validation style note:** this repo already uses both `z.url()` and `z.string().url()` in different places. For this tool, follow the upstream client schema exactly to minimize drift.

Create `lib/tools/display-geo-map.ts`:

```ts
import { tool } from 'ai'
import { z } from 'zod'

const LatitudeSchema = z.number().finite().min(-90).max(90)
const LongitudeSchema = z.number().finite().min(-180).max(180)
const HttpUrlSchema = z
  .string()
  .url()
  .refine(value => /^https?:\/\//i.test(value), {
    message: 'Expected an http or https URL.'
  })

const GeoMapMarkerIconSchema = z.union([
  z.object({
    type: z.literal('dot'),
    color: z.string().optional(),
    borderColor: z.string().optional(),
    radius: z.number().min(3).max(16).optional()
  }),
  z.object({
    type: z.literal('emoji'),
    value: z.string().min(1),
    size: z.number().min(16).max(40).optional(),
    bgColor: z.string().optional(),
    borderColor: z.string().optional()
  }),
  z.object({
    type: z.literal('image'),
    url: HttpUrlSchema,
    width: z.number().min(16).max(64).optional(),
    height: z.number().min(16).max(64).optional(),
    borderRadius: z.number().min(0).max(999).optional(),
    borderColor: z.string().optional()
  })
])

const GeoMapMarkerSchema = z.object({
  id: z.string().min(1).optional().describe('Stable marker id (optional)'),
  lat: LatitudeSchema.describe('Latitude in degrees'),
  lng: LongitudeSchema.describe('Longitude in degrees'),
  label: z.string().optional().describe('Accessible marker label'),
  description: z.string().optional().describe('Popup body text'),
  tooltip: z.enum(['none', 'hover', 'always']).optional(),
  icon: GeoMapMarkerIconSchema.optional()
})

const GeoMapRoutePointSchema = z.object({
  lat: LatitudeSchema,
  lng: LongitudeSchema
})

const GeoMapRouteSchema = z.object({
  id: z.string().min(1).optional(),
  points: z
    .array(GeoMapRoutePointSchema)
    .min(2)
    .describe('Ordered lat/lng waypoints (at least two)'),
  label: z.string().optional(),
  description: z.string().optional(),
  tooltip: z.enum(['none', 'hover', 'always']).optional(),
  color: z.string().optional(),
  weight: z.number().min(1).max(12).optional(),
  opacity: z.number().min(0).max(1).optional(),
  dashArray: z.string().optional()
})

const GeoMapClusteringSchema = z.object({
  enabled: z.boolean().optional(),
  radius: z.number().min(20).max(120).optional(),
  maxZoom: z.number().min(1).max(22).optional(),
  minPoints: z.number().min(2).max(20).optional()
})

const GeoMapViewportSchema = z.discriminatedUnion('mode', [
  z.object({
    mode: z.literal('fit'),
    padding: z.number().nonnegative().optional(),
    maxZoom: z.number().min(1).max(22).optional(),
    target: z.enum(['markers', 'routes', 'all']).optional()
  }),
  z.object({
    mode: z.literal('center'),
    center: z.object({ lat: LatitudeSchema, lng: LongitudeSchema }),
    zoom: z.number().min(1).max(22)
  })
])

const DisplayGeoMapSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this map instance'),
    title: z.string().optional().describe('Accessible region label'),
    description: z.string().optional(),
    markers: z
      .array(GeoMapMarkerSchema)
      .min(1)
      .describe('One or more geographic markers to render'),
    routes: z
      .array(GeoMapRouteSchema)
      .optional()
      .describe('Optional polylines connecting waypoints'),
    clustering: GeoMapClusteringSchema.optional(),
    viewport: GeoMapViewportSchema.optional(),
    showZoomControl: z.boolean().optional(),
    theme: z.enum(['light', 'dark']).optional()
  })
  .superRefine((value, ctx) => {
    const seenMarkerIds = new Set<string>()
    value.markers.forEach((marker, index) => {
      if (!marker.id) return
      if (seenMarkerIds.has(marker.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['markers', index, 'id'],
          message: `Duplicate marker id "${marker.id}".`
        })
        return
      }
      seenMarkerIds.add(marker.id)
    })

    const seenRouteIds = new Set<string>()
    value.routes?.forEach((route, index) => {
      if (!route.id) return
      if (seenRouteIds.has(route.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['routes', index, 'id'],
          message: `Duplicate route id "${route.id}".`
        })
        return
      }
      seenRouteIds.add(route.id)
    })
  })

export const displayGeoMapTool = tool({
  description:
    'Display geographic points, routes, and regions on an interactive map. ' +
    'Use when the user asks to visualize locations, compare places, plot ' +
    'routes, or explore an area. Prefer `viewport.mode="fit"` unless the ' +
    'user specified a center and zoom level.',
  inputSchema: DisplayGeoMapSchema,
  execute: async params => params
})
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
bun run test -- lib/tools/__tests__/display-geo-map.test.ts
```

Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add lib/tools/display-geo-map.ts lib/tools/__tests__/display-geo-map.test.ts
git commit -m "feat(tools): add displayGeoMap tool with Zod input schema"
```

---

## Task 4: Extend `ResearcherTools` types

**Files:**

- Modify: `lib/types/agent.ts`

- [ ] **Step 1: Add the import (alphabetical with sibling tool imports, near line 11)**

After `import type { displayChartTool } from '../tools/display-chart'` add:

```ts
import type { displayGeoMapTool } from '../tools/display-geo-map'
```

- [ ] **Step 2: Add the field to `ResearcherTools` (insert after `displayChart`, matching alphabetical-ish ordering at lines 27–43)**

```ts
displayChart: typeof displayChartTool
displayGeoMap: typeof displayGeoMapTool
```

- [ ] **Step 3: Add the invocation alias (after `DisplayChartToolInvocation` at line 67–69)**

```ts
export type DisplayGeoMapToolInvocation = UIToolInvocation<
  ResearcherTools['displayGeoMap']
>
```

- [ ] **Step 4: Add it to the `ResearcherToolInvocation` union (at line 108)**

Insert a line between `DisplayChartToolInvocation` and `DisplayCitationsToolInvocation`:

```ts
  | DisplayChartToolInvocation
  | DisplayGeoMapToolInvocation
  | DisplayCitationsToolInvocation
```

- [ ] **Step 5: Typecheck**

```bash
bun typecheck
```

Expected: PASS. The file compiles; nothing else breaks yet because no consumer references `displayGeoMap` — Task 5 fixes that.

- [ ] **Step 6: Commit**

```bash
git add lib/types/agent.ts
git commit -m "feat(types): add displayGeoMap to ResearcherTools"
```

---

## Task 5: Register `displayGeoMap` in `researcher.ts`

**Files:**

- Modify: `lib/agents/researcher.ts`

- [ ] **Step 1: Add the import (near line 15 with sibling tool imports)**

```ts
import { displayGeoMapTool } from '../tools/display-geo-map'
```

- [ ] **Step 2: Add `'displayGeoMap'` to both `activeToolsList` branches**

In the `case 'chat':` branch (currently lines 201–213), insert `'displayGeoMap'` after `'displayChart'`:

```ts
activeToolsList = [
  'search',
  'fetch',
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
]
```

In the `case 'research':` branch (currently lines 224–235), insert in the same position:

```ts
activeToolsList = [
  'search',
  'fetch',
  'displayTable',
  'displayChart',
  'displayGeoMap',
  'displayCitations',
  'displayLinkPreview',
  'displayOptionList',
  'displayQuestionWizard',
  'displayCallout',
  'displayTimeline'
]
```

- [ ] **Step 3: Add the entry to the `tools` object (after `displayChart` at line 310)**

```ts
    const tools: ResearcherTools = {
      search: searchTool,
      fetch: fetchTool,
      displayPlan: displayPlanTool,
      displayTable: displayTableTool,
      displayChart: displayChartTool,
      displayGeoMap: displayGeoMapTool,
      displayCitations: displayCitationsTool,
      // … rest unchanged
```

- [ ] **Step 4: Add prompt bullets in both chat and research mode prompts**

The prompts live in `lib/agents/prompts/search-mode-prompts.ts`. There are two functions — `getChatModePrompt()` (around line 141) and `getResearchModePrompt()` (around line 375) — each of which builds a long template literal that includes a "DISPLAY TOOLS" section.

In the chat-mode prompt, the DISPLAY TOOLS block starts at roughly line 244 with `**displayPlan** — …`. Existing bullets follow this exact format (note the `**name** — short use summary` headline followed by `TRIGGER:` and `Examples:` sub-bullets):

```text
**displayTimeline** — Use for chronological event sequences:
- TRIGGER: Questions involving "history of", "timeline of", "what happened with", "evolution of", "when did", event sequences, version histories, or biographical timelines
```

Insert the new bullet adjacent to `**displayChart**` (around line 253 cluster) in BOTH `getChatModePrompt()` and `getResearchModePrompt()` — the research-mode DISPLAY TOOLS section starts around line 548. Use this wording verbatim:

```text
**displayGeoMap** — Use to visualize geography, places, routes, or spatial relationships:
- TRIGGER: Questions involving "map", "where", "near me", "show on a map", "route from X to Y", city/region comparisons, or any answer where lat/lng is load-bearing
- Examples: "map the three largest US cities", "plot a route from SF to Reno", "show earthquake locations in California last week"
- Prefer `viewport.mode="fit"` with `target:"all"` unless the user specified a fixed center and zoom
```

Do NOT duplicate into a new `lib/agents/prompts.ts` — that file does not exist. Both prompts are in the single `search-mode-prompts.ts` file.

- [ ] **Step 5: Update agent docs that enumerate the active-tools set**

These four docs list the tool set verbatim and drift if not updated:

- `docs/architecture/RESEARCH-AGENT.md` (lines ~232 and ~255)
- `docs/architecture/GENERATIVE-UI.md` (lines ~129, ~179, ~261)
- `docs/architecture/OVERVIEW.md` (lines ~118, ~182, ~216)
- `GEMINI.md` (lines ~31–32)

In each, add `displayGeoMap` in the same position relative to `displayChart` as in the code (right after it). While you are there, fix any already-stale tool lists/tables you touch instead of only inserting one token. Today that specifically means preserving `displayQuestionWizard` anywhere the live code already exposes it, including the research-mode active-tools docs that have already drifted from [`lib/agents/researcher.ts`](../lib/agents/researcher.ts).

Optional but recommended if you want the exported/documented Tool UI inventory fully in sync: also update `components/tool-ui/index.ts` and `docs/reference/FILE-INDEX.md` to mention the new geo-map surface.

- [ ] **Step 6: Extend `researcher.test.ts` with mock + assertion**

Open `lib/agents/__tests__/researcher.test.ts`. At the top of the file (around line 23–25 where `vi.mock('@/lib/tools/display-chart', …)` lives), add:

```ts
vi.mock('@/lib/tools/display-geo-map', () => ({
  displayGeoMapTool: { name: 'displayGeoMap' }
}))
```

In the chat-mode test block (around line 117, where `expect(config.activeTools).toContain('displayChart')` lives), add:

```ts
expect(config.activeTools).toContain('displayGeoMap')
```

Repeat in the research-mode block (around line 140). Then run:

```bash
bun run test -- lib/agents
```

Expected: PASS, with the new assertions counted. This is the real tool-registration smoke test — it exercises `createResearcher()` with the mocked tool graph and asserts `displayGeoMap` reaches `activeTools`. Do NOT use `bun run chat` as a smoke test — that script POSTs to the dev server's `/api/chat` endpoint and tells you nothing about tool registration at module-load time.

- [ ] **Step 7: Extend `DISPLAY_TOOLS` coverage array**

Open `lib/utils/__tests__/message-mapping-display-tools.test.ts`. At line 11, the array currently enumerates the display tools covered by the UI ↔ DB round-trip `it.each` tests. Add `'displayGeoMap'` alphabetically (or adjacent to `'displayChart'` — the existing order is mixed). Run:

```bash
bun run test -- lib/utils/__tests__/message-mapping-display-tools.test.ts
```

Expected: PASS. If it fails, the mapping code in `lib/utils/message-mapping.ts` (or wherever the round-trip helper lives) special-cases tool names — you'll need to investigate; it is not safe to skip.

- [ ] **Step 8: Typecheck**

```bash
bun typecheck
```

Expected: PASS. If it errors about `displayGeoMap` not being assignable to `keyof ResearcherTools`, revisit Task 4 — the type union did not save.

- [ ] **Step 9: Commit**

```bash
git add lib/agents/researcher.ts \
        lib/agents/prompts/search-mode-prompts.ts \
        lib/agents/__tests__/researcher.test.ts \
        lib/utils/__tests__/message-mapping-display-tools.test.ts \
        docs/architecture/RESEARCH-AGENT.md \
        docs/architecture/GENERATIVE-UI.md \
        docs/architecture/OVERVIEW.md \
        GEMINI.md
git commit -m "feat(agent): register displayGeoMap in researcher tool loop"
```

---

## Task 6: Registry wire-up (TDD)

**Files:**

- Modify: `components/tool-ui/registry.test.tsx`
- Modify: `components/tool-ui/registry.tsx`

- [ ] **Step 1: Write the failing render test with a Leaflet-safe mock**

Leaflet calls `window.matchMedia`, `getBoundingClientRect`, and other layout APIs at mount time. jsdom (the vitest env this repo uses) doesn't implement them, so importing the real `GeoMap` in a test will throw. The current `vitest.setup.ts` has no Leaflet stub — we can't "copy an existing pattern" because there is none. Instead, mock the component at the module level inside this test file, which keeps the fix local and doesn't leak a global stub into unrelated tests.

Open `components/tool-ui/registry.test.tsx` and append:

```tsx
import { vi } from 'vitest'

vi.mock('./geo-map/geo-map', () => ({
  GeoMap: (props: { id: string }) => (
    <div data-testid="geo-map" data-id={props.id} />
  )
}))

const geoMapOutput = {
  id: 'test-map',
  markers: [
    { id: 'a', lat: 34.0522, lng: -118.2437, label: 'LA' },
    { id: 'b', lat: 37.7749, lng: -122.4194, label: 'SF' }
  ],
  viewport: { mode: 'fit' as const, target: 'all' as const }
}

describe('displayGeoMap entry', () => {
  it('renders a GeoMap via tryRenderToolUIByName', () => {
    const node = tryRenderToolUIByName(
      'displayGeoMap',
      geoMapOutput,
      'test-part-id'
    )
    render(<>{node}</>)
    expect(screen.getByTestId('geo-map')).toHaveAttribute('data-id', 'test-map')
  })

  it('returns null for invalid output', () => {
    const node = tryRenderToolUIByName(
      'displayGeoMap',
      { id: 'x' }, // missing markers
      'test-part-id'
    )
    expect(node).toBeNull()
  })
})
```

The mock spreads whatever props Leaflet would have consumed and renders a trivial `div` — this test verifies the registry wiring (parse → mount → ErrorBoundary → ToolCardMount), not Leaflet itself. Real-Leaflet render verification happens in Task 8's manual browser pass, which is the right place for it.

- [ ] **Step 2: Run the test to verify it fails**

```bash
bun run test -- components/tool-ui/registry.test.tsx
```

Expected: FAIL — the first case returns null because no `'displayGeoMap'` entry exists in `registry.tsx` yet; the invalid-output case already passes. If instead you get an import error from the mock, make sure the `vi.mock` call precedes `import { tryRenderToolUIByName }` — vitest hoists it automatically, but explicit ordering helps readers.

- [ ] **Step 3: Add the imports to `components/tool-ui/registry.tsx`**

The existing tool imports in this file are alphabetized by sibling directory. Current order: `callout`, `chart`, `citation`, `data-table`, `generate-image`, `link-preview`, `option-list`, `plan`, `question-wizard`, `timeline`. **Insert `geo-map` between `generate-image` and `link-preview`** (alphabetical position) — not "near Chart":

```ts
import { GenerateImage } from './generate-image/generate-image'
import { safeParseSerializableGenerateImage } from './generate-image/schema'
import { GeoMap } from './geo-map/geo-map'
import { safeParseSerializableGeoMap } from './geo-map/schema'
import { LinkPreview } from './link-preview/link-preview'
```

`eslint-plugin-simple-import-sort` enforces this; a wrong position will be auto-fixed by `bun format`, but naming the correct spot up-front avoids a reviewer round-trip.

- [ ] **Step 4: Append the `ToolUIEntry` to the `entries` array**

The `entries` array is category-grouped, not alphabetized. Insert the new entry immediately after the `displayChart` block (which currently ends at line 93, just before the `displayCitations` entry):

```tsx
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
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
bun run test -- components/tool-ui/registry.test.tsx
```

Expected: PASS. If the mock-backed render assertion fails, inspect mock ordering or schema-parse failure first. With the local `vi.mock('./geo-map/geo-map', …)` in place, this test should not need a global Leaflet stub.

- [ ] **Step 6: Commit**

```bash
git add components/tool-ui/registry.tsx components/tool-ui/registry.test.tsx
git commit -m "feat(tool-ui): register displayGeoMap in the UI registry"
```

---

## Task 7: Client-side schema tests + schema parity guard

**Files:**

- Create: `components/tool-ui/geo-map/__tests__/schema.test.ts`
- Create: `components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`

- [ ] **Step 1: Write client-side schema tests (mirrors `generate-image/__tests__/schema.test.ts`)**

```ts
import { describe, expect, it } from 'vitest'

import { parseSerializableGeoMap, safeParseSerializableGeoMap } from '../schema'

const valid = {
  id: 'm-1',
  markers: [{ id: 'a', lat: 34.05, lng: -118.24, label: 'LA' }]
}

describe('safeParseSerializableGeoMap', () => {
  it('parses a minimal valid payload', () => {
    expect(safeParseSerializableGeoMap(valid)).not.toBeNull()
  })

  it('returns null for empty markers', () => {
    expect(safeParseSerializableGeoMap({ id: 'm-2', markers: [] })).toBeNull()
  })

  it('returns null for missing id', () => {
    expect(
      safeParseSerializableGeoMap({
        markers: [{ lat: 0, lng: 0 }]
      })
    ).toBeNull()
  })

  it('parseSerializableGeoMap throws on invalid input', () => {
    expect(() => parseSerializableGeoMap({ id: 'x' })).toThrow()
  })

  it('returns null for duplicate marker ids', () => {
    expect(
      safeParseSerializableGeoMap({
        id: 'm-3',
        markers: [
          { id: 'dup', lat: 34.05, lng: -118.24 },
          { id: 'dup', lat: 37.77, lng: -122.42 }
        ]
      })
    ).toBeNull()
  })

  it('returns null for non-http image icon urls', () => {
    expect(
      safeParseSerializableGeoMap({
        id: 'm-4',
        markers: [
          {
            id: 'a',
            lat: 34.05,
            lng: -118.24,
            icon: { type: 'image', url: 'ftp://example.com/icon.png' }
          }
        ]
      })
    ).toBeNull()
  })
})
```

- [ ] **Step 2: Write the schema-mirror test**

```ts
import { describe, expect, it } from 'vitest'

import { displayGeoMapTool } from '@/lib/tools/display-geo-map'

import { safeParseSerializableGeoMap } from '../schema'

const parityCases = [
  {
    name: 'minimal',
    expected: true,
    payload: {
      id: 'minimal',
      markers: [{ id: 'a', lat: 0, lng: 0 }]
    }
  },
  {
    name: 'fleet',
    expected: true,
    payload: {
      id: 'fleet',
      title: 'Fleet',
      markers: [
        {
          id: 'truck-14',
          lat: 34.05,
          lng: -118.24,
          label: 'Truck 14',
          icon: { type: 'emoji', value: '🚚' }
        }
      ],
      routes: [
        {
          id: 'r1',
          points: [
            { lat: 33.94, lng: -118.4 },
            { lat: 34.05, lng: -118.24 }
          ],
          color: '#2563EB'
        }
      ],
      clustering: { enabled: true },
      viewport: {
        mode: 'fit' as const,
        target: 'all' as const,
        padding: 40,
        maxZoom: 11
      }
    }
  },
  {
    name: 'duplicate-marker-ids',
    expected: false,
    payload: {
      id: 'dup-markers',
      markers: [
        { id: 'dup', lat: 34.05, lng: -118.24 },
        { id: 'dup', lat: 37.77, lng: -122.42 }
      ]
    }
  },
  {
    name: 'non-http-image-icon',
    expected: false,
    payload: {
      id: 'bad-icon-url',
      markers: [
        {
          id: 'a',
          lat: 34.05,
          lng: -118.24,
          icon: { type: 'image', url: 'ftp://example.com/icon.png' }
        }
      ]
    }
  }
]

describe('geo-map schema parity', () => {
  for (const testCase of parityCases) {
    it(`agent-side and client-side schemas stay aligned for ${testCase.name}`, () => {
      const agentAccepts = displayGeoMapTool.inputSchema.safeParse(
        testCase.payload
      ).success
      const clientAccepts =
        safeParseSerializableGeoMap(testCase.payload) !== null

      expect(agentAccepts).toBe(testCase.expected)
      expect(clientAccepts).toBe(testCase.expected)
      expect(agentAccepts).toBe(clientAccepts)
    })
  }
})
```

- [ ] **Step 3: Run both files**

```bash
bun run test -- components/tool-ui/geo-map/__tests__
```

Expected: PASS. If the parity test fails, reconcile the agent-side schema back to the client-side schema for render-critical fields. Do **not** loosen the client schema merely to accommodate a draft agent payload.

- [ ] **Step 4: Commit**

```bash
git add components/tool-ui/geo-map/__tests__
git commit -m "test(geo-map): schema parse + agent/client schema mirror"
```

---

## Task 8: End-to-end manual verification

**Files:** _(none changed)_

- [ ] **Step 1: Start dev server**

Reuse the result from Task 2 Step 2:

- if the repo dev server is already running on `43100`, keep using it
- if you started an alternate port (for example `43101`), keep using that same URL
- only start a new server here if neither exists

- [ ] **Step 2: Open the app and submit a geo prompt**

Navigate to your chosen local app URL from Step 1, start a new chat, send:

> Show me a map with pins at the three largest US cities on the west coast.

Expected in the rendered assistant message:

1. A visible map canvas at the size defined by the component's CSS.
2. Three markers at LA, SF, and San Diego (or Seattle — model's choice).
3. No red error overlay, no `{toolName} output could not be rendered` fallback (see `render-message.tsx` fallback text around lines 619–624).
4. Browser console: no Leaflet errors; no "window is not defined" SSR errors in the terminal.

- [ ] **Step 3: Test dark mode**

Toggle the theme via the app's theme switcher. Because the live Geo Map component inherits the active document theme when `theme` is omitted, the map tiles should follow the app theme (light basemap in light mode, dark basemap in dark mode) or otherwise clearly reflect the active theme. If the basemap stays stuck on the previous theme, treat that as a bug.

- [ ] **Step 4: Test a `center` viewport prompt**

Send:

> Center a map on Tokyo at zoom 10 with a single pin at Tokyo Tower.

Expected: map renders centered and zoomed per the agent's output.

- [ ] **Step 5: Test the error path**

Send:

> Show me a map with no pins at all.

Expected: the model _should_ refuse via text OR call `displayGeoMap` with an invalid payload. If the latter, the registry's `safeParseSerializableGeoMap` returns null, and `render-message.tsx` (lines 619–624) renders the fallback `{toolName} output could not be rendered` text. No crash.

- [ ] **Step 5b: Test the Leaflet default-marker-icon edge case**

Send:

> Put a pin on Paris without specifying an icon style.

Expected: missing `icon` is valid upstream, so the marker should still render with some visible default-marker path. What you want to NOT see: an invisible marker caused by Leaflet's default asset resolution path. If the marker is missing pixels, inspect the vendored geo-map runtime for the non-custom-icon path and vendor a fix (for example an explicit asset-backed default icon) before calling the integration done.

- [ ] **Step 6: If anything above fails, fix it in-place and re-test before moving on**

Do not advance to Task 9 on a broken happy path.

---

## Task 9: Verification gate

**Files:** _(lint auto-fixes only)_

- [ ] **Step 1: Lint**

```bash
bun lint
```

Fix every warning and error — including pre-existing ones in files you touched (CLAUDE.md: _"Fix every warning and error you encounter. Never dismiss issues as 'pre-existing.'"_).

- [ ] **Step 2: Typecheck**

```bash
bun typecheck
```

Expected: PASS with zero errors.

- [ ] **Step 3: Full test run**

```bash
bun run test
```

Expected: PASS. No new failures, no flaky skips.

- [ ] **Step 4: Format check**

```bash
bun format:check
```

If it fails:

```bash
bun x prettier --write \
  app/layout.tsx \
  lib/tools/display-geo-map.ts \
  lib/tools/__tests__/display-geo-map.test.ts \
  lib/types/agent.ts \
  lib/agents/researcher.ts \
  lib/agents/prompts/search-mode-prompts.ts \
  lib/agents/__tests__/researcher.test.ts \
  lib/utils/__tests__/message-mapping-display-tools.test.ts \
  components/tool-ui/registry.tsx \
  components/tool-ui/registry.test.tsx \
  components/tool-ui/geo-map/** \
  docs/architecture/RESEARCH-AGENT.md \
  docs/architecture/GENERATIVE-UI.md \
  docs/architecture/OVERVIEW.md \
  GEMINI.md
```

Scope formatting to touched files only. Do **not** run repo-wide `bun format` in a dirty worktree.

- [ ] **Step 5: Commit any lint/format fixes**

```bash
git add app/layout.tsx \
        lib/tools/display-geo-map.ts \
        lib/tools/__tests__/display-geo-map.test.ts \
        lib/types/agent.ts \
        lib/agents/researcher.ts \
        lib/agents/prompts/search-mode-prompts.ts \
        lib/agents/__tests__/researcher.test.ts \
        lib/utils/__tests__/message-mapping-display-tools.test.ts \
        components/tool-ui/registry.tsx \
        components/tool-ui/registry.test.tsx \
        components/tool-ui/geo-map \
        docs/architecture/RESEARCH-AGENT.md \
        docs/architecture/GENERATIVE-UI.md \
        docs/architecture/OVERVIEW.md \
        GEMINI.md
git diff --cached --stat
git commit -m "chore: satisfy lint + format after geo-map integration"
```

If you intentionally updated `components/tool-ui/index.ts`, `docs/reference/FILE-INDEX.md`, or kept a semantic diff in `components/tool-ui/shared/*.ts`, stage those explicitly too. Skip if there's nothing staged.

- [ ] **Step 6: Invoke `verification-before-completion` before claiming done**

The CLAUDE.md policy requires it for anything that will become a PR.

- [ ] **Step 7: Push and open PR**

```bash
git push -u origin feat/geo-map-tool-ui
```

PR title: `feat(tool-ui): integrate @tool-ui/geo-map as displayGeoMap`

PR body should include:

- Summary of the 6 touch-points wired (tool def, types, agent registration, registry entry, root CSS, prompt hint).
- Note that this uses the repo's bespoke Tool UI pattern — not assistant-ui / Toolkit / tool-agent.
- Screenshot or short screen recording of Task 8 Steps 2–4.
- Confirmation that `bun lint` / `bun typecheck` / `bun run test` all pass.

---

## Self-review checklist (run after writing, before handing off)

- [x] Every touchpoint has a task: `lib/tools/` (Task 3), `lib/types/agent.ts` (Task 4), `lib/agents/researcher.ts` + `search-mode-prompts.ts` + `researcher.test.ts` + `message-mapping-display-tools.test.ts` + 4 docs files (Task 5), `components/tool-ui/registry.tsx` + `registry.test.tsx` (Task 6), the full current `components/tool-ui/geo-map/**` registry footprint (Task 1), `app/layout.tsx` (Task 2), schema parity (Task 7).
- [x] Registry `name` is `'displayGeoMap'` everywhere (`lib/tools/…` export, `tools` object key, `activeToolsList` string, `registry.tsx` entry name, prompt bullet, `DISPLAY_TOOLS` array, `researcher.test.ts` assertion). Spelling is consistent in every task.
- [x] No placeholders — every code block is literal.
- [x] `execute: async params => params` passthrough matches the non-interactive `displayChart` precedent.
- [x] No entry added to `INTERACTIVE_TOOL_TYPES`, no `addToolResult` wiring.
- [x] CSS loads once at root; `'use client'` boundary is the registry file.
- [x] TDD: failing test first, implementation second, re-run to green, commit. Every code-changing task commits.
- [x] Task 7 uses both valid and invalid parity cases so agent-side / client-side Zod drift is caught in both directions.
- [x] Task 1 Step 3b records the installed upstream schema so Task 3's agent-side schema is a mirror, not a guess.
- [x] Task 6 mocks `./geo-map/geo-map` at the module level so the registry test doesn't boot Leaflet in jsdom.
- [x] `bun.lock` (text), not `bun.lockb` (binary doesn't exist in this repo).
- [x] Prompt file pinned to `lib/agents/prompts/search-mode-prompts.ts`; bullets added to both `getChatModePrompt()` and `getResearchModePrompt()`.
- [x] Smoke test is `bun run test -- lib/agents` (exercises `researcher.test.ts`), not `bun run chat` (which POSTs to a dev server and tells you nothing about registration).
- [x] Task 3's URL-validation note matches the actual chosen schema style; no stale `z.url()` vs `z.string().url()` contradiction remains.
- [x] Docs drift addressed in 4 files enumerating the active-tools set, including pre-existing stale entries encountered in touched lists/tables.
- [x] Task 1 reflects the current upstream install footprint and runtime deps (`leaflet`, `react-leaflet`, `supercluster`) instead of assuming a 3-file drop-in.
- [x] Verification gate (lint / typecheck / test / format) before PR.

---

**If anything in the shadcn install goes sideways (for example it writes unexpected app files beyond the geo-map dir and optional shared-helper churn, or the upstream component requires assistant-ui runtime): stop, pull the raw component source from the tool-ui.com registry JSON, and vendor it by hand into `components/tool-ui/geo-map/`. The wiring tasks (2–9) are unchanged — they depend only on the named exports, not the installer path.**

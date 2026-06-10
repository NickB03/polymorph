# Adding Generative UI Tools

> **Audience:** Architect | Contributor
> **Prerequisites:** [Generative UI](GENERATIVE-UI.md)

This leaf documents the checklist for adding a new manifest-managed display tool.

## How to Add a New Generative UI Tool

### Adding a New Display Tool

Polymorph uses one local AI SDK v6 plus Tool UI manifest contract. It does not use `assistant-ui` `Toolkit`, Agent Kit runtime, or upstream Tool UI runtime wiring for the main chat runtime.

For passive display tools, add:

- Do **not** start with `tool-agent`, `npx shadcn add @tool-ui/...`, or an `assistant-ui` migration unless the user explicitly asks for that.
- First inspect the existing integration points:
  - `components/tool-ui/*` for component shape, schema contracts, and adapters
  - `components/tool-ui/registry.tsx` for output rendering and compatibility facade registration
  - `components/tool-ui/tool-part-registry.tsx` for tool-part dispatch
  - `lib/tools/<tool-name>/client.tsx` for interactive rendering and app-local output submission
  - `components/chat.tsx` and `components/chat-request.ts` for request/continuation plumbing
  - `lib/types/dynamic-tools.ts` and `lib/streaming/helpers/prepare-messages.ts` for interactive tool state transitions
  - `lib/agents/chat/toolset.ts`, the relevant `lib/agents/chat/*` agent definition, and any prompt files that must actually cause the model to call the tool
- Reuse the existing naming pattern (`displayX`, `generateImage`, canvas tools) unless there is a deliberate reason to change the contract.
- For interactive tools, registry registration is not enough. Add a module-local `client.tsx`, delegate it from `components/tool-ui/tool-part-registry.tsx`, cover the native `addToolOutput` continuation, and test the exact `tool-*` part shape.
- For passive display tools, the minimum path is usually:

1. `components/tool-ui/<component>/schema.ts`
2. `components/tool-ui/<component>/<component>.tsx`
3. `components/tool-ui/<component>/index.tsx`
4. `lib/tools/display-<component>/schema.ts`
5. `lib/tools/display-<component>/server.ts`
6. `lib/tools/display-<component>/result.tsx`
7. `lib/tools/display-<component>/index.ts`
8. `lib/tools/display-<component>.ts` compatibility re-export when older flat imports need to keep working
9. One community-source row in `lib/tools/tool-ui/community-sources.ts` when the component source is not purely local
10. One metadata row in `lib/tools/tool-ui/metadata.ts`
11. One server row in `lib/tools/tool-ui/server-catalog.ts`
12. One renderer row in `components/tool-ui/renderer-catalog.tsx`
13. Prompt guidance in `lib/agents/prompts/search-mode-prompts.ts`
14. Focused tests for schema, module contract, registry rendering, prompt usage, and agent availability

For interactive tools, also add:

1. `lib/tools/display-<component>/client.tsx`
2. One renderer row in `components/tool-ui/interactive-renderer-catalog.tsx`
3. A result schema that represents the value passed from the module-local renderer to `submitInteractiveToolOutput`
4. Request and continuation tests covering `components/chat-request.ts` and `lib/streaming/helpers/prepare-messages.ts`

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

Expected: package update succeeds, adapter/renderer tests pass, and typecheck passes. If upstream changed its public API, update only the local adapter files named in the community-source record and keep package source untouched.

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
- Interactive tools have a `client.tsx` renderer and call the local `submitInteractiveToolOutput` callback; `components/chat.tsx` bridges that callback to AI SDK `addToolOutput({ tool, toolCallId, output })`, and the next request carries the updated AI SDK `messages` history through `components/chat-request.ts` and `lib/streaming/helpers/prepare-messages.ts`.

---

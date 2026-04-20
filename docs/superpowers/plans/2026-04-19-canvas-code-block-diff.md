# Canvas Code Block / Diff Implementation Plan

## Summary

- Add Tool UI `code-block` and `code-diff` to the existing bespoke chat runtime; do not introduce `assistant-ui`, activity-tab changes, or workspace changes.
- Keep `createCanvasArtifact` unchanged in v1. Use code UI only for artifact inspection and update turns.
- Keep both `displayCodeBlock` and `displayCodeDiff` canvas-only in v1. They should only be registered and exposed when `canvasToolContext` exists, alongside `createCanvasArtifact`, `updateCanvasArtifact`, and `readCanvasArtifact`.
- Required repo-specific scope: `readCanvasArtifact` currently returns the full `files` map, while `components/render-message.tsx` only special-cases dynamic `createCanvasArtifact` / `updateCanvasArtifact` parts and otherwise falls through to the generic dynamic-tool renderer, which renders unregistered output as raw JSON. V1 must include an explicit read-path suppression rule so the new code UI replaces, rather than stacks on top of, the current raw artifact-read experience.

## Public Interfaces

- Add two backend display tools: `displayCodeBlock` and `displayCodeDiff`.
- `displayCodeBlock` payload: `id`, `code`, optional `language`, `filename`, `lineNumbers`, `highlightLines`, `maxCollapsedLines`.
- `displayCodeDiff` payload: `id`, `oldCode`, `newCode`, optional `language`, `filename`, `lineNumbers`, `diffStyle`, `maxCollapsedLines`.
- Keep `createCanvasArtifact`, `updateCanvasArtifact`, and `readCanvasArtifact` result shapes unchanged.
- Do not expose either new tool in non-canvas chats in v1.

## Implementation Changes

- Tool UI layer: add checked-in `components/tool-ui/code-block/*` and `components/tool-ui/code-diff/*`, then export/register them from `components/tool-ui/index.ts` and `components/tool-ui/registry.tsx`.
- Tool/agent wiring: add `lib/tools/display-code-block.ts` and `lib/tools/display-code-diff.ts`, then extend `lib/types/agent.ts` and `lib/agents/researcher.ts`.
- Canvas-only tool exposure: add the new tools to the `canvasTools` object and push them into `activeToolsList` only inside the existing `if (canvasToolContext)` branch. Do not add them to the default chat/research tool lists.
- Prompt contract: update the shared `getCanvasArtifactsPrompt()` helper in `lib/agents/prompts/search-mode-prompts.ts` rather than editing the chat and research prompt variants separately.
- Prompt rules:
  - `readCanvasArtifact` inspection flow: select the 1 to 2 relevant files, call `displayCodeBlock` for those files, then continue in prose.
  - Artifact update flow: after reading current files when needed, call `displayCodeDiff` for each changed file, then call `updateCanvasArtifact` with the full replacement file set.
  - `createCanvasArtifact` stays card-only in v1.
  - Outside canvas artifact inspection/update flows, continue using normal prose or fenced code blocks; do not use `displayCodeBlock` / `displayCodeDiff` yet.
- Read-path UX rule: in `components/render-message.tsx`, suppress a successful `readCanvasArtifact` dynamic-tool part only when a later part in the same assistant message is a successful, renderable `tool-displayCodeBlock` or `tool-displayCodeDiff`.
- Read error rule: do not treat `readCanvasArtifact` “not found” as `output-error`. The tool currently returns a normal `output-available` payload with `status: 'not_found'`, `error`, `errorCode`, and `files: {}`. Those payloads must keep the generic fallback.
- Malformed display rule: if the later `displayCodeBlock` / `displayCodeDiff` part is `output-error` or its payload fails the Tool UI schema/renderer parse, do not suppress the `readCanvasArtifact` fallback.
- Persistence: rely on the existing `tool-dynamic` display-tool mapping in `lib/utils/message-mapping.ts`; update the display-tool test matrix rather than adding DB columns.
- Dependencies: add `@pierre/diffs`; add direct `shiki` only if the checked-in `code-block` component imports it directly instead of relying on the existing transitive copy.

## Test Plan

- Registry/schema tests: both new tools safe-parse valid payloads and render through `components/tool-ui/registry.test.tsx`.
- Message-mapping tests: `tool-displayCodeBlock` and `tool-displayCodeDiff` round-trip UI -> DB -> UI as display tools.
- Researcher/tool exposure tests:
  - when `canvasToolContext` is absent, neither new tool is active
  - when `canvasToolContext` is present, both new tools are active with the existing canvas tools
- Prompt tests: `getCanvasArtifactsPrompt()` documents the read/update rules and remains the single source of truth for both search-mode prompt variants.
- Render-message tests:
  - a successful `readCanvasArtifact` part followed later in the same assistant message by a valid `displayCodeBlock` suppresses the generic raw JSON read renderer
  - a successful `readCanvasArtifact` part followed later in the same assistant message by a valid `displayCodeDiff` suppresses the generic raw JSON read renderer
  - `readCanvasArtifact` not-found payloads still use the generic fallback
  - malformed or `output-error` code-display parts do not suppress the read fallback
  - `displayCodeDiff` renders inline before the resulting canvas artifact card
  - `createCanvasArtifact` responses remain unchanged
- Final verification: targeted Vitest suites first, then `bun run test`, `bun run lint`, and `bun run typecheck`.

## Assumptions

- “Chat-only” means assistant-message rendering only, even in research mode.
- V1 renders one code card per file and caps inspection turns to 1 to 2 files by prompt guidance.
- `displayCodeDiff` uses `oldCode` / `newCode`, not unified patch strings, because canvas updates already work from full file contents.
- The v1 UX chooses full suppression of the successful `readCanvasArtifact` raw JSON block once valid code UI renders later in the same assistant message.

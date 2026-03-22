# Canvas Artifact Replacement Design

## Summary

Replace the current E2B-backed artifact system with a canvas-style frontend artifact system.

The replacement should behave like the canvas/artifact experiences in Claude, Gemini, and ChatGPT:

- one artifact opens in one canvas
- the user can see a live preview
- the user can edit code in-browser
- the user can ask the AI to make changes to the same artifact
- the artifact can be versioned and restored
- the artifact can be exported as a single HTML file

The current E2B artifact system should be moved out of this repo entirely and treated as a separate focused project. It should not remain in this repo behind flags or inactive docs because that would continue to confuse the LLM and future contributors.

## Goal

Make frontend web artifacts easy to create, preview, edit, revise with AI, and export, without sandbox/session complexity.

## Non-Goals

This replacement is not a full-stack app builder.

Out of scope:

- backend code
- databases
- auth
- API routes for user-created apps
- arbitrary package installation
- server-side execution for generated artifacts
- runtime session management
- sandbox rebuild/restart flows
- deployment orchestration

If a request fits inside a frontend-only canvas artifact that can compile into a single-file HTML experience, it is in scope. If it requires backend services, databases, server authority, infrastructure, or project scaffolding, it is out of scope and should be clarified or redirected by the existing chat/Q&A flow.

Important distinction:

- the generated artifact itself is frontend-only
- the product implementation is allowed to reuse the app's existing server-side persistence, auth, and chat infrastructure to store artifact state, versions, identity, and access control
- the non-goals above apply to generated artifact capabilities, not to the host product's implementation surface

## Product Model

The primary unit is a single canvas artifact, not a mini app project.

User-facing behavior:

- one artifact opens in one canvas
- preview is intrinsic to the artifact
- code editing happens in the browser
- AI updates mutate the same artifact
- version history is part of the artifact experience
- export/download produces one single-file HTML artifact

The system should support frontend-only interactive experiences broadly, not a narrow whitelist of artifact categories. This includes:

- dashboards
- landing pages
- interactive tools
- forms without backend submission
- visualizations
- prototypes
- webapp-based games
- other frontend-only browser experiences that fit the compile-to-HTML boundary

The product boundary should be principle-based:

- if it can be created as a frontend-only browser artifact, support it
- if it expands into backend or infrastructure scope, do not support it in this system

## Canonical Artifact Format

The canonical authoring model should be a small constrained virtual file set that compiles into a single HTML artifact.

Recommended virtual files:

- `App.tsx`
- `styles.css`
- optional `components.tsx`
- optional `meta.json`

Locked `meta.json` scope for v1:

- `title?`
- `description?`
- `viewport?`
- `assets?` as a keyed map of embedded project-owned assets:
  - `mimeType`
  - `data`
- `externalDependencies?` as a list of declared remote dependencies the export UI can surface:
  - `type` (`image`, `font`, `media`, or `api`)
  - `url`
  - optional `label`

The compiled/exported artifact should be:

- one `artifact.html` file
- single-file, with all project-owned code/styles/assets inlined

This gives the system:

- a simple artifact-like user experience
- structured source for AI and user edits
- a portable single-file output for preview and export

The bundled HTML should not be the only source of truth, because that would make iterative editing brittle after multiple revisions.

## Repo Strategy

The current E2B artifact system should be removed from this repo entirely.

That removal includes:

- active artifact tool registration
- E2B runtime/orchestration/rebuild/session code
- artifact workspace UI designed around sandbox preview
- artifact API routes tied to E2B lifecycle
- chat integration for the current E2B artifact flow
- docs and references that describe the E2B artifact system as current behavior
- tests that only exist for the old artifact architecture

The old system should be moved to a separate repo or dedicated worktree-backed project.

This repo should not keep the old artifact code behind flags. The active codebase and docs should describe one artifact model only.

## Naming Strategy

The replacement should avoid inheriting implementation vocabulary from the old system where that vocabulary implies a mini app runtime.

Recommended implementation naming:

- `canvas`
- `canvasArtifact`
- `webCanvas`

Avoid reusing old implementation concepts such as:

- runtime session
- rebuild
- restart preview
- sandbox expiry

The product UI may still use the word "artifact" if desired, but the internal implementation should make the canvas model explicit.

## Architecture

The replacement system should have six focused subsystems.

### 1. Canvas Generation Contract

Responsibility:

- define the schema the AI uses to create and update a canvas artifact

Requirements:

- constrained virtual file set
- deterministic input/output schema
- explicit size limits
- explicit unsupported import/package validation
- no arbitrary repo writes
- no arbitrary dependency installation

This contract replaces the current multi-file project/sandbox tool contract.

Locked v1 size limits:

- maximum virtual files per artifact: 4
- maximum size per source file: 150 KB
- maximum total source size per artifact draft: 400 KB
- maximum compiled HTML size: 2 MB
- maximum embedded project-owned asset payload across the artifact: 5 MB
- maximum retained immutable versions per artifact: 50

V1 contract boundaries:

- authoring files may only import:
  - other files inside the constrained virtual file set
  - the fixed built-in runtime surface defined below
- arbitrary package installation is not allowed
- remote module imports are not allowed
- remote `<script>` tags and remote stylesheet injection are not allowed
- server-only APIs are not allowed
- unsupported imports and unsupported APIs must produce explicit validation or compile diagnostics

V1 asset and network behavior:

- author-controlled assets in v1 are embedded-only
- supported project-owned asset forms in v1:
  - data URLs referenced directly from source
  - structured asset entries declared in `meta.json` and compiled into the generated HTML output
- v1 does not support loose uploaded asset files or a general asset storage pipeline
- exported HTML must not depend on repo-local files
- the export contract for v1 means:
  - all project-owned code is inlined
  - all project-owned styles are inlined
  - all project-owned embedded assets are inlined
  - the exported file runs on its own without local companion files
- remote images, media, and fonts may be referenced, but they are external dependencies rather than embedded artifact contents and should be surfaced as such in diagnostics or UI
- runtime browser requests to external HTTPS APIs may occur as normal browser behavior, but those are runtime dependencies rather than part of the embedded artifact payload
- requests that imply backend ownership remain out of scope and should be clarified or redirected in chat

Export rule clarification:

- v1 guarantees single-file export, not offline-only execution
- v1 does not promise a fully offline/self-contained runtime in the strict sense if the artifact intentionally references external network resources
- if an artifact references remote media, fonts, images, or external APIs, the exported HTML is still valid, but those dependencies must be reported explicitly to the user
- export UI must communicate remaining external dependencies explicitly
- preview and export resolve project-owned assets the same way: embedded into the compiled HTML artifact

Locked v1 runtime surface:

- allowed package imports:
  - `react`
  - `react-dom/client`
- allowed non-package imports:
  - relative imports within the constrained virtual file set
- allowed styling surface:
  - Tailwind v4 utility classes in authored JSX/TSX
  - optional authored rules in `styles.css`
- allowed browser capabilities:
  - standard DOM APIs
  - SVG
  - Canvas 2D
  - timers
  - keyboard, mouse, and pointer events
  - Web Audio
  - `fetch` to external HTTPS endpoints
- disallowed in v1:
  - arbitrary npm package imports
  - Node.js APIs
  - server-only framework APIs
  - remote ESM or CDN imports
  - user-authored Tailwind config, plugins, or package imports

### 2. Canvas Compiler/Renderer

Responsibility:

- compile the virtual file set into one single-file HTML artifact

Outputs:

- compiled HTML for live preview
- downloadable HTML for export
- diagnostics/errors for invalid source or failed compilation

Requirements:

- deterministic compilation
- fast enough for iterative edits
- supports frontend interactivity, state, events, timers, animation, and lightweight assets
- no server/runtime lifecycle concepts
- produces both compile diagnostics and runtime diagnostics contracts for the canvas UI

Locked v1 compile topology:

- canonical compilation runs in a host-controlled server-side compile worker/service
- the browser editor never owns the canonical compile pipeline
- manual browser edits are debounced and sent to the draft update endpoint, which persists source and then runs the same canonical compile pipeline
- AI writes update source first and then run the same canonical compile pipeline after the write is accepted
- preview and export must consume the same compiled HTML snapshot bytes for a given draft revision
- v1 must not maintain separate preview-vs-export compilation logic

This is the key architectural shift:

- old model: source -> sandbox runtime -> preview URL
- new model: source -> compile -> HTML artifact -> preview

Preview isolation model:

- preview renders the compiled artifact through `iframe.srcdoc`
- the iframe uses `sandbox="allow-scripts"` only
- v1 must not use `allow-same-origin`, `allow-forms`, `allow-popups`, `allow-downloads`, or any `allow-top-navigation*` capability
- because the preview runs in an opaque sandbox origin, it must not have access to host cookies, localStorage, sessionStorage, IndexedDB, or parent DOM
- the host replaces preview state by replacing `srcdoc`, not by exposing a generic RPC surface into the iframe
- host-to-preview coordination uses a versioned, nonce-scoped `postMessage` envelope:
  - `channel`
  - `type`
  - `artifactId`
  - `revisionId`
  - `nonce`
  - optional `requestId`
  - optional `payload`
- v1 host -> preview messages are limited to:
  - `init`
- v1 preview -> host messages are limited to:
  - `preview-ready`
  - `runtime-error`
  - `unhandled-rejection`
  - `asset-error`
  - `external-request-error`
  - `height-change`
- because the iframe origin is opaque, host message handlers must validate:
  - `event.source`
  - `artifactId`
  - `revisionId`
  - per-render `nonce`
- the preview document uses an enforced CSP aligned to the locked v1 runtime surface:
  - `default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: https: blob:; font-src data: https: blob:; media-src data: https: blob:; connect-src https:; object-src 'none'; base-uri 'none'; frame-src 'none'; form-action 'none'; navigate-to 'none'`

Locked v1 compiler choice:

- use server-side `esbuild` to transpile and bundle the constrained virtual file set
- bundle `react` and `react-dom/client` into the generated JS output rather than loading them from a CDN or shared host asset
- run a locked, host-owned Tailwind v4 compilation step over authored class usage and merge that output with `styles.css`
- use a host-controlled HTML assembler to inject the minified JS/CSS into a single HTML output
- reject compiled output that exceeds the locked size limits
- do not introduce a repo/project-style package manager flow for artifact generation

### 3. Canvas Persistence

Responsibility:

- persist artifact metadata, source model, compiled output, and versions

Requirements:

- version-based persistence
- no runtime session tables
- no preview expiry semantics
- restore previous versions
- track current compiled output alongside editable source

The persistence model should be artifact-history-centric, not runtime-centric.

Authoritative state model:

- editable virtual source is the single source of truth
- compiled HTML is a persisted derivative of a source snapshot, never the canonical editable state
- each artifact has one active draft source state
- each successful compile updates the current draft preview artifact stored on the artifact row
- immutable versions store:
  - source snapshot
  - metadata required for restore/history
- v1 does not persist full compiled HTML snapshots for every immutable version
- historical version preview is recompiled on demand from the saved source snapshot against the locked v1 compiler/runtime surface

Restore semantics:

- restoring a historical version loads that version's source snapshot back into the active draft
- the system then recompiles and produces a new current draft/preview state
- historical versions remain immutable

Version creation rules for v1:

- a version is created only on explicit save points chosen by the product flow:
  - successful AI-authored artifact creation
  - successful AI-authored artifact update
  - explicit user save/version action after manual edits
- successful background recompiles during typing update draft preview state but do not automatically create immutable versions
- draft state may diverge from the latest saved version

Draft and restore semantics:

- manual edits and AI edits both apply to the same active draft source state
- if a restore is requested while unsaved draft changes exist, the UI must force an explicit choice:
  - discard current draft changes and restore
  - cancel restore
- v1 should not attempt three-way merge of historical restore against unsaved draft state

Locked v1 draft status model:

- artifact status lives on the active `canvasArtifacts` row
- allowed status values:
  - `generating`
  - `compiling`
  - `ready`
  - `compile_failed`
  - `restoring`
- status ownership rules:
  - `generating`: an AI write is in progress and the editor is read-only
  - `compiling`: source has been accepted and the canonical compile pipeline is running
  - `ready`: the latest accepted draft compiled successfully
  - `compile_failed`: the latest accepted draft failed validation or compilation; the last successful preview remains visible if one exists
  - `restoring`: a restore request has been accepted and the draft is frozen until recompilation settles

Locked v1 diagnostics model:

- the active draft persists `draftDiagnostics` on the `canvasArtifacts` row
- `draftDiagnostics` stores the latest validation, compile, and runtime diagnostics for the active draft revision
- failed compiles update `draftDiagnostics` and artifact status even when no immutable version is created
- immutable versions may retain lightweight saved metadata, but v1 diagnostics are authoritative on the active draft rather than stored as large historical snapshots

Locked v1 persistence shape:

- one `canvasArtifacts` record per artifact:
  - `id`
  - `chatId`
  - `userId` or guest ownership reference
  - `title`
  - `status`
  - `draftSource` as the virtual file set payload
  - `draftCompiledHtml`
  - `draftDiagnostics`
  - `draftRevision` as `integer not null default 0`
  - `currentVersionId` (nullable until first explicit save point)
  - `lastCompiledAt`
  - timestamps
- one `canvasArtifactVersions` record per immutable version:
  - `id`
  - `artifactId`
  - `versionNumber`
  - `sourceSnapshot`
  - `createdBy` (`ai`, `user`, or `restore`)
  - timestamps

Locked v1 DB constraints and hot-path indexes:

- unique constraint on `canvasArtifacts.chatId`
- unique constraint on `canvasArtifactVersions (artifactId, versionNumber)`
- index on `canvasArtifacts (userId, updatedAt desc)` for artifact reopening/history lookups
- index on `canvasArtifactVersions (artifactId, createdAt desc)` for version browsing
- draft writes must use optimistic concurrency at the SQL layer:
  - `update ... where id = $artifactId and draftRevision = $expectedRevision`
  - successful writes increment `draftRevision`

### 4. Canvas Editor UI

Responsibility:

- provide the user-facing canvas experience

Capabilities:

- open artifact in a dedicated canvas view
- preview pane
- code pane
- version restore
- compile/error display
- runtime error display
- export/download
- AI revision entry point

Locked v1 editing mode:

- desktop uses split-pane preview and code editing
- mobile uses tabbed preview/code switching

The UI should not include old concepts such as:

- rebuild
- restart preview
- expired preview
- runtime logs tied to sandbox execution

Runtime diagnostics model:

- validation failures prevent compile and are shown as source-level diagnostics
- compile failures do not replace the last successful preview
- runtime failures in the browser preview should surface through a dedicated runtime diagnostics view or overlay
- runtime failures include:
  - synchronous browser exceptions
  - unhandled promise rejections
  - asset load failures
  - external request failures visible to the browser runtime
- after a runtime failure, the user should still be able to:
  - inspect the error
  - continue editing
  - ask the AI to fix the artifact
- recovery should happen through source edits and recompilation, not restart/rebuild controls

### 5. Chat Integration

Responsibility:

- connect the chat system to canvas artifact creation and updates

Requirements:

- chat can create the current canvas artifact
- chat can update the currently open canvas artifact
- artifact events in chat open or focus the canvas
- "Ask AI to change it" updates the same artifact object
- clarification/redirection remains available when a request crosses the frontend-only boundary

Identity and lifecycle semantics for v1:

- one chat may own at most one active canvas artifact
- the active artifact for a user session is the artifact attached to the currently open chat
- artifact identity must be persisted explicitly and not derived heuristically from latest message parts
- create behavior in a chat with no artifact creates that chat's artifact
- update behavior in a chat with an existing artifact updates that same artifact
- if a user asks for a fundamentally different artifact in a chat that already has one, the system should clarify whether to conceptually replace the current artifact or start a new chat
- the UI may allow viewing historical versions of the same artifact, but not multiple concurrent active artifacts within one chat in v1
- chat history should reference artifact identity explicitly so reopening a chat reopens the same canvas artifact, not a heuristic "latest artifact" guess
- authenticated users reopening a chat in a later session should resolve the same persisted artifact by chat-to-artifact linkage
- guest users should follow the same one-chat-to-one-artifact rule using the locked guest continuity model defined in the legacy/guest section below

Concurrency semantics for v1:

- the draft is single-writer logical state protected by optimistic concurrency
- every manual save or AI update must include the current `draftRevision`
- if the submitted base revision is stale, the write is rejected with a conflict instead of silently overwriting newer state
- AI updates operate on a full source snapshot, not a partial hidden patch format
- the AI orchestration layer must read the latest persisted draft source and `draftRevision` before issuing an update tool call
- while an AI update is in progress, the canvas editor becomes read-only until the write either succeeds or fails
- v1 conflict handling is explicit:
  - show stale-tab or stale-edit warning
  - require reload, reapply, or regenerate against the latest draft
- v1 does not attempt automatic merge of simultaneous manual and AI edits

### 6. Canvas API Contract

Responsibility:

- define the concrete tool, route, and stream contract for canvas artifact creation, update, persistence, and export

Tool contracts for v1:

- `createCanvasArtifact`
  - input:
    - optional `title`
    - full virtual file set payload
  - output:
    - `artifactId`
    - `chatId`
    - `status`
    - `draftRevision`
    - optional `currentVersionId`
- `updateCanvasArtifact`
  - input:
    - `artifactId`
    - `baseRevision`
    - full replacement virtual file set payload
    - optional `changeSummary`
  - output:
    - `artifactId`
    - `status`
    - `draftRevision`
    - optional `currentVersionId`
- tool writes are applied atomically on tool completion
- v1 does not stream partial file mutations into the live canvas while the model is still generating

Route contracts for v1:

- `GET /api/canvas-artifacts/[artifactId]`
  - returns current artifact state:
    - `artifactId`
    - `chatId`
    - `title`
    - `status`
    - `draftRevision`
    - `draftSource`
    - `draftCompiledHtml`
    - `draftDiagnostics`
    - `currentVersionId`
    - `updatedAt`
- `PATCH /api/canvas-artifacts/[artifactId]/draft`
  - request:
    - `baseRevision`
    - full replacement virtual file set payload
  - behavior:
    - validates source
    - persists draft
    - runs canonical compile pipeline
    - returns updated artifact state including `draftCompiledHtml` when a successful preview exists
- `POST /api/canvas-artifacts/[artifactId]/versions`
  - creates an immutable version from the current ready draft
- `POST /api/canvas-artifacts/[artifactId]/restore`
  - request:
    - `versionId`
  - behavior:
    - loads saved source snapshot into the active draft
    - recompiles and returns updated artifact state including `draftCompiledHtml` when restore compiles successfully
- `GET /api/canvas-artifacts/[artifactId]/export`
  - returns the current compiled HTML as an attachment download
  - export UI and response metadata must warn that exported artifacts can execute JavaScript and may depend on external network resources

SSE/message contract for v1:

- persisted chat parts:
  - `data-canvasArtifact`
  - `data-canvasArtifactStatus`
- ephemeral stream-only events:
  - `data-canvasArtifactEvent`
  - `data-canvasDiagnostics`
- persisted parts must be sufficient to reopen the correct artifact for a chat later
- ephemeral events are allowed for progress, transient compile state, and non-durable preview telemetry only

Guest and authenticated access control for v1:

- authenticated canvas reads and writes use the normal app auth path plus RLS-backed row ownership
- guest canvas reads and writes use application-layer HMAC token verification, not guest RLS alone
- every guest canvas handler must validate:
  - `token.chatId` against the chat context
  - `token.artifactId` against the route parameter or request body
- expired guest tokens are not accepted for normal v1 canvas read, write, restore, or export routes
- legacy-specific resolution may accept legacy identifiers only for the explicit read-only legacy path defined below

## V1 Constraints

V1 should be intentionally frontend-only, but not artificially narrow beyond that.

Supported:

- anything that can compile into a frontend-only single-file browser artifact

Not supported:

- anything that requires backend or infrastructure ownership

Technical constraints:

- constrained virtual file model
- fixed supported runtime/dependency surface
- deterministic bundling into one HTML artifact
- explicit validation errors for unsupported packages/imports/APIs
- explicit source/output size limits

This preserves usability while keeping the system closer to the reliability profile of canvas/artifact products than app-builder products.

## Migration Strategy

Migration should happen in two stages.

### Stage 1: Remove Old Artifact System From This Repo

Full removal manifest:

- directories:
  - `lib/artifacts/`
  - `components/artifact/`
- tool entrypoints:
  - `lib/tools/create-webapp-artifact.ts`
  - `lib/tools/update-webapp-artifact.ts`
  - `lib/tools/get-artifact-status.ts`
  - `lib/tools/restart-artifact-preview.ts`
- API and action surface:
  - `app/api/artifacts/[artifactId]/actions/route.ts`
  - `app/api/artifacts/[artifactId]/actions/route.test.ts`
  - `lib/actions/artifact.ts`
  - `lib/actions/__tests__/artifact.test.ts`
  - `lib/rate-limit/artifact-limits.ts`
- type and UI files that exist only for the old model:
  - `lib/types/artifact.ts`
  - `components/tool-ui/artifact-card.tsx`
- old artifact-only test files and fixtures under the paths above

Targeted edit manifest:

- chat and layout wiring:
  - `app/layout.tsx`
  - `app/api/chat/route.ts`
  - `components/chat.tsx`
  - `components/chat-request.ts`
  - `components/render-message.tsx`
  - `components/chat-messages.tsx`
- agent, streaming, and mapping layers:
  - `lib/agents/researcher.ts`
  - `lib/streaming/create-chat-stream-response.ts`
  - `lib/streaming/create-ephemeral-chat-stream-response.ts`
  - `lib/streaming/helpers/write-artifact-data.ts`
  - `lib/utils/message-mapping.ts`
  - `lib/utils/message-utils.ts`
  - `lib/types/ai.ts`
  - `lib/types/agent.ts`
- persistence and schema:
  - `lib/db/schema.ts`
  - `lib/db/relations.ts`
  - `lib/db/actions.ts`
  - existing artifact-related drizzle migrations
- docs, prompts, and references:
  - `docs/reference/API.md`
  - `docs/reference/FILE-INDEX.md`
  - `docs/plans/2026-03-13-e2b-artifact-mvp.md`
  - `docs/plans/2026-03-14-e2b-artifact-mvp-design.md`
  - `docs/plans/2026-03-14-e2b-artifact-rollout.md`
  - `docs/plans/2026-03-14-e2b-artifact-batch-4.md`
  - `docs/superpowers/plans/2026-03-15-artifact-rebuild-on-demand.md`
  - active agent prompt/docs references that describe E2B artifacts as current behavior

The output of Stage 1 should be:

- no active imports of the old artifact system in runtime paths
- no active docs that describe the old architecture as current
- no prompts/tool descriptions steering the LLM toward the old model

This stage should happen on the replacement branch, not as a standalone mainline change that leaves the product without an artifact system.

Release/cutover rule:

- Stage 1 is a branch-local cleanup and extraction step, not a production release milestone on its own
- the user-facing release happens only once Stage 2 is complete enough to replace the current artifact experience
- rollback means retaining the old system in the separate repo/project until the new system is accepted, not keeping both models active in this repo

### Stage 2: Add New Canvas Artifact System

Add:

- new canvas data model
- new generation/update contract
- compiler/renderer
- canvas UI
- chat integration
- export flow
- tests and docs for the new system only

Implementation planning should break Stage 2 into explicit milestones with independent acceptance criteria:

#### Milestone A: Canvas Data Model And Compiler Core

- compile/runtime topology
- locked styling/runtime asset strategy
- preview isolation boundary
- canvas artifact schema
- draft/version persistence model
- route/tool/SSE contract
- validation/diagnostics contract
- HTML export artifact generation

Acceptance:

- source can compile into a previewable/exportable HTML artifact
- compile errors are deterministic and structured
- versions and draft state have an unambiguous source-of-truth model
- preview isolation is enforced by the locked iframe/CSP/message model
- stale draft writes fail deterministically through optimistic concurrency

#### Milestone B: Canvas Editor UI

- canvas shell
- preview pane
- code pane
- compile/error display
- version browsing/restore
- export/download action

Acceptance:

- a user can edit source in browser and see preview updates
- compile failures are shown inline without runtime/session concepts

#### Milestone C: Chat Integration

- create/update artifact from chat
- open/focus canvas from chat events
- "Ask AI to change it" updates the same artifact
- clarification/redirection when a request crosses the frontend-only boundary

Acceptance:

- one chat consistently maps to one active artifact
- chat-driven edits and direct code edits converge on the same draft state

#### Milestone D: Repo And Docs Cleanup

- remove remaining old artifact references
- update reference docs
- update prompts/tool descriptions/types/tests to the new model only

Acceptance:

- no active E2B artifact references remain in runtime code, prompts, or current docs in this repo

### Legacy Data Handling

The replacement must explicitly define how existing artifact-related data is handled.

Locked default legacy behavior for v1:

- existing E2B-specific runtime/session/rebuild behavior should not be carried forward into the new model
- existing chats that referenced old artifacts should not silently point at incompatible new canvas artifacts
- legacy artifact records remain unmigrated by default
- legacy references in chat history resolve to a deterministic legacy notice, not to a best-effort converted canvas artifact
- legacy public links, if encountered, should resolve to a read-only legacy-unavailable notice
- v1 does not attempt automatic semantic migration from old sandbox projects to new canvas artifacts
- a future migration may exist only if a narrow deterministic conversion path is proven separately
- the chat/canvas load layer is responsible for resolving legacy references before normal canvas-open logic runs
- if a reopened chat points at a legacy artifact reference, the chat experience should surface the legacy notice state instead of attempting to hydrate a v1 canvas artifact
- legacy artifact IDs, legacy message parts, and legacy guest tokens must not be heuristically remapped to a new canvas artifact identity
- if no explicit legacy rendering path exists for a legacy reference, the system must fail closed with a clear legacy-unavailable state

Locked guest continuity behavior for v1:

- guest artifacts use a signed guest canvas token bound to `chatId` and `artifactId`
- the token is the anonymous continuity mechanism for reopening the same guest chat/artifact pair
- token TTL is 30 minutes
- token is issued on guest artifact creation
- token rotates on every successful guest write
- token refreshes on successful guest restore because the restored artifact remains the same `artifactId`
- token is invalidated when the guest artifact is replaced with a new artifact identity
- no anonymous cross-device recovery is guaranteed beyond possession of the guest token
- guest users follow the same one-chat-to-one-artifact rule as authenticated users
- guest enforcement is application-layer:
  - route handlers verify the signed token before service-role access
  - handlers must compare token `chatId` and `artifactId` against the request target

## Testing Strategy

### Unit Tests

- schema validation
- import/package restriction behavior
- compile pipeline behavior
- HTML bundling behavior
- version model helpers
- draft status transitions
- draft diagnostics persistence
- guest token route enforcement

### Component Tests

- canvas open/edit/update flows
- preview refresh after compile
- inline error presentation
- version restore behavior
- export/download action behavior
- sandboxed preview bridge behavior
- read-only editor behavior during AI generation

### Integration Tests

- chat -> create artifact -> canvas opens
- AI update -> source changes -> preview updates
- user code edit -> compile -> preview updates
- unsupported request -> clarification/redirection path
- stale `draftRevision` conflict path
- guest route auth and artifact/chat binding
- legacy reference -> legacy notice resolution

### Migration Regression Tests

- no old artifact runtime paths remain wired into chat
- no old artifact API routes remain part of active behavior
- docs/reference checks reflect only the new architecture

## Success Criteria

The replacement is successful when:

- a user can request a frontend web artifact and get a live preview without sandbox lifecycle issues
- the user can directly edit the artifact code in the browser
- the user can ask the AI to make iterative changes to the same artifact
- the artifact supports version history and restore
- the artifact can be exported as a single HTML file with project-owned code/styles/assets inlined
- the old E2B artifact system is no longer present in the active repo, active docs, or active prompts

## Risks And Mitigations

### Risk: Replacing one complex system with another hidden project model

Mitigation:

- keep the authoring model intentionally small
- do not let the replacement become another repo-shaped app builder

### Risk: Bundled HTML becomes too hard to edit over time

Mitigation:

- keep virtual source as the editable canonical model
- use bundled HTML only as the compiled preview/export artifact

### Risk: Scope creep toward full-stack generation

Mitigation:

- enforce the frontend-only boundary in the generation contract
- rely on existing chat clarification/redirection when a request crosses the boundary

### Risk: Old artifact concepts keep leaking into prompts and docs

Mitigation:

- remove the old system entirely from this repo
- rewrite docs and references so only one artifact model is described as active

## Locked V1 Decisions

The following design choices are fixed for implementation planning:

- virtual file schema:
  - required: `App.tsx`
  - optional: `styles.css`
  - optional: `components.tsx`
  - optional: `meta.json`
- runtime surface:
  - `react`
  - `react-dom/client`
  - relative imports within the virtual file set
  - browser APIs defined in the v1 runtime contract
- compiler/bundler:
  - server-side `esbuild` plus host-controlled HTML assembly
  - bundled `react` and `react-dom/client`
  - host-owned Tailwind v4 compilation plus optional `styles.css`
- persistence model:
  - `canvasArtifacts` plus `canvasArtifactVersions`
  - status-driven active draft row with persisted `draftDiagnostics`
- editing mode:
  - split-pane on desktop
  - tabbed on mobile
- asset strategy:
  - limited asset support in v1
  - project-owned assets must be embedded into the generated/exported artifact path rather than emitted as loose companion files
- preview boundary:
  - `iframe.srcdoc`
  - `sandbox="allow-scripts"`
  - nonce-scoped `postMessage` bridge

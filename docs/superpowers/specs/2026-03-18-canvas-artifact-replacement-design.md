# Canvas Artifact Replacement Design

## Summary

Replace the current E2B-backed artifact system with a canvas-style frontend artifact system.

The replacement should behave like the canvas/artifact experiences in Claude, Gemini, and ChatGPT:

- one artifact opens in one canvas
- the user can see a live preview
- the user can edit code in-browser
- the user can ask the AI to make changes to the same artifact
- the artifact can be versioned and restored
- the artifact can be exported as a single self-contained HTML file

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

If a request fits inside a frontend-only canvas artifact that can compile into a self-contained HTML experience, it is in scope. If it requires backend services, databases, server authority, infrastructure, or project scaffolding, it is out of scope and should be clarified or redirected by the existing chat/Q&A flow.

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
- export/download produces one self-contained HTML file

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

The canonical authoring model should be a small constrained virtual file set that compiles into a single self-contained HTML artifact.

Recommended virtual files:

- `App.tsx`
- `styles.css`
- optional `components.tsx`
- optional `meta.json`

The compiled/exported artifact should be:

- one `artifact.html` file
- self-contained with inline JS/CSS/assets where feasible

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

The replacement system should have five focused subsystems.

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

- author-controlled assets must be embedded in the exported artifact output or handled through a constrained asset path selected during implementation
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
- if an artifact references remote media, fonts, images, or external APIs, the exported HTML is still valid, but those dependencies must be reported explicitly to the user
- implementation planning should define how export metadata or UI communicates remaining external dependencies

Locked v1 runtime surface:

- allowed package imports:
  - `react`
  - `react-dom/client`
- allowed non-package imports:
  - relative imports within the constrained virtual file set
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

### 2. Canvas Compiler/Renderer

Responsibility:

- compile the virtual file set into one self-contained HTML artifact

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

This is the key architectural shift:

- old model: source -> sandbox runtime -> preview URL
- new model: source -> compile -> HTML artifact -> preview

Preview isolation model:

- preview runs inside a sandboxed iframe
- the iframe must not share application origin state with the host app
- host-to-preview coordination should use a narrow `postMessage` bridge
- preview sandbox permissions should allow script execution and browser interaction needed for frontend artifacts while blocking direct host-app access and parent navigation
- the preview document should use a restrictive CSP aligned to the locked v1 runtime surface:
  - inline bundled code and styles allowed
  - embedded assets allowed
  - external runtime requests limited to the dependency classes allowed by the v1 contract

Locked v1 compiler choice:

- use `esbuild` to transpile and bundle the constrained virtual file set
- use a host-controlled HTML assembler to inject bundled JS/CSS into a single HTML output
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
- each successful compile updates the draft preview artifact
- immutable versions store:
  - source snapshot
  - compiled HTML snapshot
  - metadata required for restore/history

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

Locked v1 persistence shape:

- one `canvasArtifacts` record per artifact:
  - `id`
  - `chatId`
  - `userId` or guest ownership reference
  - `title`
  - `draftSource` as the virtual file set payload
  - `draftCompiledHtml`
  - `draftRevision`
  - `currentVersionId`
  - timestamps
- one `canvasArtifactVersions` record per immutable version:
  - `id`
  - `artifactId`
  - `versionNumber`
  - `sourceSnapshot`
  - `compiledHtmlSnapshot`
  - `createdBy` (`ai`, `user`, or `restore`)
  - timestamps

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
- guest users should follow the same one-chat-to-one-artifact rule, but with the guest continuity model chosen during implementation replacing the current guest sandbox token model

Concurrency semantics for v1:

- the draft is single-writer logical state protected by optimistic concurrency
- every manual save or AI update must include the current `draftRevision`
- if the submitted base revision is stale, the write is rejected with a conflict instead of silently overwriting newer state
- v1 conflict handling is explicit:
  - show stale-tab or stale-edit warning
  - require reload, reapply, or regenerate against the latest draft
- v1 does not attempt automatic merge of simultaneous manual and AI edits

## V1 Constraints

V1 should be intentionally frontend-only, but not artificially narrow beyond that.

Supported:

- anything that can compile into a frontend-only self-contained browser artifact

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

Remove:

- tool registration
- tool implementations
- E2B runtime/orchestration/rebuild/session code
- artifact workspace UI and related chat wiring
- artifact API routes tied to the current model
- docs/reference content that describes the old system as active

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

- canvas artifact schema
- draft/version persistence model
- compile pipeline
- validation/diagnostics contract
- HTML export artifact generation

Acceptance:

- source can compile into a previewable/exportable HTML artifact
- compile errors are deterministic and structured
- versions and draft state have an unambiguous source-of-truth model

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

Migration rules:

- existing E2B-specific runtime/session/rebuild behavior should not be carried forward into the new model
- existing chats that referenced old artifacts should not silently point at incompatible new canvas artifacts
- legacy artifact records, legacy references in chat history, and legacy public links should be handled through one of these explicit behaviors selected during implementation:
  - read-only legacy experience
  - migration banner with "legacy artifact unavailable in new canvas system"
  - one-time migration only if the old artifact can be meaningfully represented in the new model

V1 should assume no automatic semantic migration from old sandbox projects to new canvas artifacts unless a narrow, deterministic migration path is proven during implementation.

## Testing Strategy

### Unit Tests

- schema validation
- import/package restriction behavior
- compile pipeline behavior
- HTML bundling behavior
- version model helpers

### Component Tests

- canvas open/edit/update flows
- preview refresh after compile
- inline error presentation
- version restore behavior
- export/download action behavior

### Integration Tests

- chat -> create artifact -> canvas opens
- AI update -> source changes -> preview updates
- user code edit -> compile -> preview updates
- unsupported request -> clarification/redirection path

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
- the artifact can be exported as a self-contained HTML file
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
  - `esbuild` plus host-controlled HTML assembly
- persistence model:
  - `canvasArtifacts` plus `canvasArtifactVersions`
- editing mode:
  - split-pane on desktop
  - tabbed on mobile
- asset strategy:
  - limited asset support in v1
  - project-owned assets must be embedded into the generated/exported artifact path rather than emitted as loose companion files

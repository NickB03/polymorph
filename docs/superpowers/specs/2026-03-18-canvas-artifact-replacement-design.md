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

This is the key architectural shift:

- old model: source -> sandbox runtime -> preview URL
- new model: source -> compile -> HTML artifact -> preview

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

### 4. Canvas Editor UI

Responsibility:

- provide the user-facing canvas experience

Capabilities:

- open artifact in a dedicated canvas view
- preview pane
- code pane
- version restore
- compile/error display
- export/download
- AI revision entry point

The UI should not include old concepts such as:

- rebuild
- restart preview
- expired preview
- runtime logs tied to sandbox execution

### 5. Chat Integration

Responsibility:

- connect the chat system to canvas artifact creation and updates

Requirements:

- chat can create the current canvas artifact
- chat can update the currently open canvas artifact
- artifact events in chat open or focus the canvas
- "Ask AI to change it" updates the same artifact object
- clarification/redirection remains available when a request crosses the frontend-only boundary

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

### Stage 2: Add New Canvas Artifact System

Add:

- new canvas data model
- new generation/update contract
- compiler/renderer
- canvas UI
- chat integration
- export flow
- tests and docs for the new system only

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

## Open Decisions For Implementation Planning

These do not block the design, but the implementation plan must choose them explicitly:

- exact virtual file schema for v1
- exact compiler/bundler stack
- exact canvas storage schema
- whether code editing is split-pane or tabbed in the canvas UI
- whether asset embedding in v1 is inline-only or supports limited uploads

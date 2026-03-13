# E2B Artifact MVP Design

## Goal

Add a preview-first webapp artifact experience to Polymorph that lets visitors and signed-in users ask the model to create and iteratively edit React SPA artifacts inside an E2B sandbox, with the artifact rendered in a persistent split-view workspace beside chat.

## Product Summary

The MVP should feel closer to Gemini Canvas, ChatGPT Canvas, and Claude Artifacts than to an IDE:

- Chat remains on the left.
- A persistent artifact workspace opens on the right.
- The artifact workspace prioritizes live preview.
- Follow-up prompts update the same artifact across turns.
- There is no file editor or file tree in MVP.
- The site remains generous for guests because it is a public portfolio experience.

## Approved Scope

### In Scope

- React SPA artifact generation in E2B
- Multi-turn artifact edits bound to one artifact identity
- Guest and authenticated support
- Split chat/workspace desktop layout
- Mobile workspace drawer/sheet experience
- Preview and logs views
- Retry and restart behavior
- Shareable artifact preview link
- Invisible operational guardrails

### Out of Scope

- Full Next.js app generation in the sandbox
- File editor
- File browser
- Version history UI
- Artifact deployment/export
- Collaboration
- Arbitrary npm package installation during generation

## Research Summary

### Why AI SDK Fits

The current app already uses the right primitives for artifact-style UX:

- AI SDK `ToolLoopAgent` orchestration in [lib/agents/researcher.ts](/Users/nick/Projects/vana-v2/lib/agents/researcher.ts)
- `createUIMessageStream` for server-driven UI/data streaming in [lib/streaming/create-chat-stream-response.ts](/Users/nick/Projects/vana-v2/lib/streaming/create-chat-stream-response.ts)
- Tool UI rendering in [components/tool-ui/registry.tsx](/Users/nick/Projects/vana-v2/components/tool-ui/registry.tsx)
- A dedicated artifact side panel in [components/artifact/chat-artifact-container.tsx](/Users/nick/Projects/vana-v2/components/artifact/chat-artifact-container.tsx)

AI SDK provides the right message, tool, and streaming abstractions for collaborative artifact state, but it does not provide the code execution runtime. That runtime must come from a sandbox service.

### Why E2B First

E2B is the best MVP runtime fit because it is already oriented around AI-generated apps running in isolated environments, and E2B Fragments is the closest open-source analogue to the desired product shape.

Reasons for choosing E2B over a Vercel Sandbox-first build:

- Faster time to a working artifact product
- Stronger fit for iterative code generation workflows
- Clear reference implementation in Fragments
- Lower product design lift for preview-oriented app generation

The architecture should still isolate runtime access behind an internal adapter so Vercel Sandbox can be added later if desired.

### Why React SPA Only

Full Next.js generation in a remote sandbox increases install time, cold starts, and failure rate while adding little value for a preview-first portfolio demo. A React SPA template covers the desired UI demo use cases with much higher reliability.

### Why Curated UI And Dependency Surface

The most common artifact failures come from bad dependency choices and invented imports. The MVP should not use an allowlist as the primary control because the model can ignore it. Instead, it should use an immutable template:

- Preinstalled dependencies only
- Template-owned `package.json`
- Template-owned local `components/ui`
- Structured validation and repair after each update

Shadcn-style local components backed by pinned Radix primitives are the right fit because they provide accessible UI primitives while keeping import paths stable and source-local.

## Current System Fit

The current codebase already provides the main extension points:

- [app/api/chat/route.ts](/Users/nick/Projects/vana-v2/app/api/chat/route.ts): request validation, guest/auth split, model selection
- [lib/streaming/create-chat-stream-response.ts](/Users/nick/Projects/vana-v2/lib/streaming/create-chat-stream-response.ts): streamed tool/data response construction
- [lib/agents/researcher.ts](/Users/nick/Projects/vana-v2/lib/agents/researcher.ts): active tool list and instructions
- [components/chat.tsx](/Users/nick/Projects/vana-v2/components/chat.tsx): client transport, tool-result continuations, error handling
- [components/render-message.tsx](/Users/nick/Projects/vana-v2/components/render-message.tsx): rendering tool outputs inline
- [components/artifact/artifact-context.tsx](/Users/nick/Projects/vana-v2/components/artifact/artifact-context.tsx): artifact open/close state
- [components/artifact/chat-artifact-container.tsx](/Users/nick/Projects/vana-v2/components/artifact/chat-artifact-container.tsx): current right-side artifact/activity shell
- [components/inspector/inspector-panel.tsx](/Users/nick/Projects/vana-v2/components/inspector/inspector-panel.tsx): current artifact panel presentation
- [lib/db/schema.ts](/Users/nick/Projects/vana-v2/lib/db/schema.ts): persisted chat/message/part schema

## Product Design

### Workspace Layout

Use a hybrid split-view workspace:

- Left: current chat thread
- Right: persistent artifact workspace

The right workspace should open automatically when an artifact is created or updated. The preview should be the default tab and take most of the available space.

### Workspace Header

The workspace header should include:

- artifact title
- build/runtime status
- refresh
- retry
- share
- close

The header should feel lightweight and product-oriented, not IDE-oriented.

### Workspace Body

The workspace body should include:

- `Preview` tab
- `Logs` tab

Optional for later, but not in MVP:

- code tab
- file tree
- revision list

### Chat Behavior

Artifact turns should still produce assistant messages in the thread, but the actual artifact surface should live in the workspace. The model should reference the current artifact naturally in multi-turn edits:

- "make it darker"
- "add a pricing section"
- "turn this into a dashboard"

These should update the current artifact, not create a new one, unless the user explicitly asks for a fresh build.

## Backend Design

Use a balanced artifact spine instead of a single mutable row.

### Tables

#### `artifacts`

Stable identity for the artifact.

Suggested fields:

- `id`
- `chat_id`
- `user_id` nullable for guests
- `current_revision_id`
- `current_runtime_session_id`
- `title`
- `framework` set to `react-spa`
- `status`
- `created_at`
- `updated_at`

#### `artifact_revisions`

One row per create/update turn that successfully produces a new artifact state.

Suggested fields:

- `id`
- `artifact_id`
- `triggering_message_id`
- `prompt_summary`
- `title`
- `sandbox_snapshot_ref` nullable
- `created_at`

#### `artifact_runtime_sessions`

One row per E2B runtime session.

Suggested fields:

- `id`
- `artifact_id`
- `provider` set to `e2b`
- `sandbox_id`
- `preview_url`
- `status`
- `started_at`
- `expires_at`
- `last_heartbeat_at`

This separation keeps artifact identity, revision history, and sandbox lifecycle from collapsing into one mutable record.

### Guest Handling

The contract should be the same for guests and signed-in users, but durability can differ:

- authenticated users: persist artifact, revision, and runtime session records in Postgres
- guests: allow artifact creation and updates with the same UI/agent contract, but tolerate shorter-lived persistence and more aggressive cleanup

The user experience should remain generous and mostly frictionless.

## Runtime Design

Create an internal runtime adapter with an E2B implementation.

Suggested interface:

- `createSession`
- `reuseSession`
- `writeTemplateFiles`
- `applySourceUpdate`
- `runValidation`
- `startPreview`
- `restartPreview`
- `getLogs`
- `destroySession`

The adapter boundary keeps E2B-specific details out of the agent and UI layers.

### Template

The React SPA template should include:

- Vite + React + TypeScript
- Tailwind
- local `components/ui`
- pinned shadcn-compatible components
- pinned Radix dependencies under the hood
- icons, motion, forms, charting, and utility packages preinstalled

Suggested preinstalled packages:

- `react`
- `react-dom`
- `vite`
- `typescript`
- `tailwindcss`
- `clsx`
- `tailwind-merge`
- `class-variance-authority`
- `lucide-react`
- `framer-motion`
- `sonner`
- `react-hook-form`
- `zod`
- `recharts`
- `date-fns`

### Immutable Template Policy

To reduce model-induced dependency failures:

- the model may edit application source files only
- `package.json` is template-owned
- config files are template-owned
- local `components/ui` is template-owned
- no dependency installation during generation

Validation should catch unsupported imports and either normalize them automatically or trigger one structured repair pass.

## Agent Design

Add explicit artifact tools instead of relying on assistant text to carry generated code.

### MVP Tools

- `createWebappArtifact`
- `updateWebappArtifact`
- `getArtifactStatus`
- `restartArtifactPreview`

Optional internal helper tools later:

- `getArtifactLogs`
- `snapshotArtifact`

### Tool Semantics

Each tool should return structured machine-readable output containing:

- artifact id
- revision id
- runtime session id
- status
- preview url when available
- short title
- repairable error information when relevant

The agent should be instructed to:

- use artifact tools for webapp creation/edit requests
- continue updating the current artifact across turns
- avoid raw code dumps when an artifact exists
- prefer template-local UI components
- avoid unsupported dependencies and Next.js-specific APIs

## Streaming Design

Extend the existing streamed message model with persistent artifact data parts and transient status/log events.

### Persistent Data Parts

Add data part types for:

- `data-artifact`
- `data-artifact-status`

These should support reconciliation by stable `id` so the same artifact card/workspace can update over time.

### Transient Data Parts

Use transient parts for:

- build progress
- retry notifications
- restart notifications

This aligns with AI SDK streaming guidance for collaborative artifacts and status updates.

## UI Design

### Artifact Workspace State

The current artifact context only tracks an open `Part`. That is too narrow for a persistent workspace. Replace or extend it to track:

- active artifact id
- active revision id
- workspace title
- preview url
- status
- logs availability
- is open

### Rendering

Add a dedicated artifact tool UI renderer instead of treating artifacts like search/fetch inspector content. The workspace should render from artifact data, not raw message text.

### Failure States

The workspace needs explicit states:

- building
- ready
- failed
- restarting
- expired

The failed state should expose:

- retry
- ask AI to fix

## Operational Posture

This site is a portfolio property, not a production SaaS. The artifact system should therefore bias toward generosity and low friction.

### Recommended Guardrails

- no auth requirement for artifacts
- no prominent quota messaging
- idle-time sandbox cleanup
- sandbox reuse within an artifact session
- hidden abuse detection only if traffic requires it

Do not front-load visible product restrictions that degrade the showcase experience.

## Testing Strategy

Test artifact lifecycle behavior rather than generated app correctness.

Critical coverage:

- create artifact from chat
- update existing artifact across turns
- render workspace automatically
- stream preview state and logs into the UI
- handle sandbox restart and failure states
- verify guest flow works without auth
- verify idle cleanup does not break artifact identity

## Rollout

Start with a server flag and enable it on the portfolio deployment first. Observe:

- sandbox startup latency
- average session duration
- build success rate
- repair success rate
- guest usage shape
- runtime spend

Expose the feature broadly once the default React SPA path is stable.

## References

- AI SDK streaming custom data: https://ai-sdk.dev/docs/ai-sdk-ui/streaming-data
- AI SDK tools: https://ai-sdk.dev/docs/foundations/tools
- E2B Fragments: https://github.com/e2b-dev/fragments
- E2B sandbox docs: https://e2b.dev/docs/sandbox
- Vercel Sandbox docs: https://vercel.com/docs/vercel-sandbox
- Radix Primitives overview: https://www.radix-ui.com/primitives/docs/overview/introduction
- shadcn/ui docs: https://ui.shadcn.com/docs/new

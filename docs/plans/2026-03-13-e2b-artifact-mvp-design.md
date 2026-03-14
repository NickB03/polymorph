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
- [components/chat.tsx](/Users/nick/Projects/vana-v2/components/chat.tsx): client transport, tool-result continuations, error handling, and the client entry point for transient `onData` handling
- [components/render-message.tsx](/Users/nick/Projects/vana-v2/components/render-message.tsx): rendering tool outputs inline
- [components/artifact/artifact-context.tsx](/Users/nick/Projects/vana-v2/components/artifact/artifact-context.tsx): artifact open/close state
- [components/artifact/chat-artifact-container.tsx](/Users/nick/Projects/vana-v2/components/artifact/chat-artifact-container.tsx): current right-side artifact/activity shell
- [components/inspector/inspector-panel.tsx](/Users/nick/Projects/vana-v2/components/inspector/inspector-panel.tsx): current artifact panel presentation
- [lib/db/schema.ts](/Users/nick/Projects/vana-v2/lib/db/schema.ts): persisted chat/message/part schema

Artifact tools should be enabled in both existing search modes rather than
behind a new mode flag:

- `chat`: append artifact tools to the current 20-step tool list
- `research`: append the same artifact tools while preserving `todoWrite` when
  a writer is available

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

### Header Actions

Workspace header actions should use one concrete MVP contract:

- `refresh`: call `POST /api/artifacts/[artifactId]/actions` with
  `{ action: 'refresh' }`; the route should reuse the same server artifact
  service used by `getArtifactStatus`
- `retry`: call the same route with `{ action: 'retry' }`; the route should
  reuse the same server artifact service used by `restartArtifactPreview`
- `share`: copy the current `previewUrl` to the clipboard on the client; do not
  add a second share-mutation route or DB record in MVP

If `previewUrl` is unavailable, hide or disable `share` rather than rendering
an inert control.

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

### Migration Workflow

Schema changes should continue to use the repo's existing Drizzle layout:

- SQL migrations in `drizzle/`
- snapshots and journal updates in `drizzle/meta/*`

`bun run migrate` reads from `drizzle/`, so the MVP should not introduce a
parallel `lib/db/migrations` folder.

### Guest Handling

The contract should be the same for guests and signed-in users, but durability can differ:

- authenticated users: persist artifact, revision, and runtime session records in Postgres
- guests: allow artifact creation and updates with the same UI/agent contract, but tolerate shorter-lived persistence and more aggressive cleanup

Guest continuity must not trust raw `artifactId` or `runtimeSessionId` values
copied out of prior `data-artifact` parts. Use a server-verifiable
`guestArtifactToken` instead:

- issue a fresh opaque signed token on every successful guest
  `createWebappArtifact`, `updateWebappArtifact`, `getArtifactStatus`, and
  `restartArtifactPreview` result
- encode the server-trusted guest handle in that token, including at minimum
  `artifactId`, `runtimeSessionId`, `chatId`, and `expiresAt`
- carry the token in guest `data-artifact` and `data-artifactStatus` payloads;
  treat raw IDs in those parts as display metadata only
- on the next guest turn, extract the latest token from incoming message
  history, validate its signature, chat binding, and expiry, then look up the
  backing artifact/runtime from server state
- if the token is missing, forged, or expired, do not reuse the prior guest
  runtime; `create`/`update` may start a fresh artifact, while `status`/`retry`
  should return a structured preview-expired error

Cleanup should destroy expired guest runtimes and prune guest-backed artifact
records on the same or a shorter timeline than token expiry so stale tokens
cannot resurrect deleted sessions.

The user experience should remain generous and mostly frictionless.

## Runtime Design

Create an internal runtime adapter with an E2B implementation.

The MVP runtime adapter should be raw HTTP-backed. Use authenticated server-side
`fetch` calls to E2B from `lib/artifacts/runtime/e2b-runtime.ts` rather than
adding an E2B SDK dependency in this phase.

Suggested interface:

- `createSession`
- `writeFiles`
- `applySourceUpdate`
- `installDependencies`
- `runCommand`
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

### Tool Registration Scope

Register all four artifact tools in both existing researcher modes. Do not make
artifact generation chat-only. `research` mode should keep its current
additional capabilities, including `todoWrite`, while gaining the same artifact
tool access as `chat`.

### Tool Semantics

Each tool should return structured machine-readable output containing:

- artifact id
- revision id
- runtime session id
- status
- preview url when available
- short title
- repairable error information when relevant
- refreshed guest token when `isGuest` is true

Artifact tools should execute with request-scoped context supplied by the stream
layer, including:

- `chatId`
- `userId | null`
- `isGuest`
- incoming message history
- guest artifact token resolver
- stream emitter callbacks for artifact data and transient events

Pass this through the agent via `experimental_context` rather than relying on
module globals or implicit singleton state.

### Tool Persistence Contract

Persist artifact tool invocations through the existing generic dynamic-tool
shape already supported by the `parts` table:

- `createWebappArtifact`
- `updateWebappArtifact`
- `getArtifactStatus`
- `restartArtifactPreview`

For persisted chats, `message-mapping.ts` should normalize those tool parts to:

- `type = 'tool-dynamic'`
- `tool_dynamic_type = 'artifact'`
- `tool_dynamic_name = <tool name>`
- `tool_dynamic_input` / `tool_dynamic_output` populated from the tool payload

Do not add artifact-specific tool columns to `parts`. Persisted artifact state
still travels separately through `data-artifact` and `data-artifactStatus`.
`data-artifactLog` and `data-artifactEvent` remain transient stream-only events.

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
- `data-artifactStatus`

These should support reconciliation by stable `id` so the same artifact card/workspace can update over time.

### Transient Data Parts

Use transient parts for:

- `data-artifactLog` for live sandbox/build logs
- `data-artifactEvent` for progress, retry, and restart notifications

These transient events should be consumed in `useChat({ onData })`. They should
not be expected in `message.parts`.

### Stream Emitter Contract

Do not let artifact tools write ad hoc stream payloads. The request-scoped
artifact context should expose explicit writer-backed callbacks:

- `emitArtifact(data)` for persistent `data-artifact`
- `emitArtifactStatus(data)` for persistent `data-artifactStatus`
- `emitArtifactLog(data)` for transient `data-artifactLog`
- `emitArtifactEvent(data)` for transient `data-artifactEvent`

`createWebappArtifact` and `updateWebappArtifact` should emit start/progress
events, zero or more log chunks, then the final persistent artifact/status
payloads. `getArtifactStatus` and `restartArtifactPreview` should use the same
contract so the client only has one transient event path.

## UI Design

### Artifact Workspace State

The current artifact context only tracks an open `Part`. That is too narrow for a persistent workspace. Replace or extend it to track:

- inspected part for the existing search/reasoning inspector
- active artifact id
- active revision id
- workspace title
- preview url
- status
- is open

Logs are tracked separately as a mutable array (`workspaceLogs`) with an
`appendWorkspaceLog` callback, rather than a boolean availability flag in the
workspace state.

Do not remove the current generic inspector behavior. The right-side shell needs
to support both:

- generic inspected parts such as search and reasoning
- the dedicated artifact workspace

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
- persist artifact tool calls as `tool-dynamic` rows for authenticated chats
- render workspace automatically
- stream preview state and logs into the UI
- handle `useChat({ onData })` transient log/event updates
- handle sandbox restart and failure states
- verify guest token issuance, validation, expiry, and cleanup behavior
- reject forged or expired guest tokens in route and ephemeral-stream tests
- execute at least one workspace header action path through
  `POST /api/artifacts/[artifactId]/actions`
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

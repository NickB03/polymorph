# E2B Artifact MVP Implementation Plan

**Goal:** Add a preview-first React SPA artifact workflow powered by E2B that supports create + multi-turn edits for guests and authenticated users in the existing Polymorph chat UI.

**Architecture:** Extend the current AI SDK tool-driven chat pipeline with explicit artifact tools, persistent artifact data parts, and a dedicated right-side workspace shell. Persist artifact identity, revisions, and runtime sessions separately so multi-turn edits and sandbox lifecycle remain stable. Use an immutable E2B React template with preinstalled shadcn-compatible UI and pinned dependencies to minimize generation failures.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Bun, AI SDK 6, Drizzle, Supabase Postgres, E2B, Tailwind, shadcn/ui, Radix primitives

---

### Task 1: Add artifact schema and types

**Files:**

- Modify: `lib/db/schema.ts`
- Create: `lib/types/artifact.ts`
- Create: `drizzle/0011_<artifact_tag>.sql`
- Create: `drizzle/meta/0011_snapshot.json`
- Modify: `drizzle/meta/_journal.json`
- Test: `lib/db/schema.ts`

**Step 1: Write the failing type usage**

Add artifact type references that do not exist yet in `lib/types/artifact.ts`:

```ts
export type ArtifactStatus =
  | 'building'
  | 'ready'
  | 'failed'
  | 'restarting'
  | 'expired'
```

Expected: imports that reference this file fail until the file exists.

**Step 2: Add database tables**

Add Drizzle tables:

- `artifacts`
- `artifactRevisions`
- `artifactRuntimeSessions`

Each table should follow the same ID conventions already used in [lib/db/schema.ts](/Users/nick/Projects/vana-v2/lib/db/schema.ts).

**Step 3: Add basic indexes and ownership model**

Keep MVP indexing minimal:

- `artifacts_chat_id_idx`
- `artifact_revisions_artifact_id_created_at_idx`
- `artifact_runtime_sessions_artifact_id_started_at_idx`

Use the same RLS pattern as chats where possible for authenticated records. Guest durability can remain app-managed for MVP if full guest RLS is not practical yet.

**Step 4: Add migration**

Generate the migration with the repo's existing Drizzle workflow so
`bun run migrate` can apply it:

Run: `bunx drizzle-kit generate`

Expected: a new SQL file appears under `drizzle/` and matching snapshot/journal
updates appear under `drizzle/meta/`.

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: artifact schema/types compile cleanly.

**Step 6: Commit**

```bash
git add lib/db/schema.ts lib/types/artifact.ts drizzle drizzle/meta
git commit -m "feat: add artifact persistence schema"
```

### Task 2: Add artifact persistence actions

**Files:**

- Modify: `lib/actions/chat.ts`
- Create: `lib/actions/artifact.ts`
- Modify: `lib/db/actions.ts`
- Test: `lib/actions/artifact.ts`

**Step 1: Write the failing action signatures**

Create server-side actions:

```ts
export async function loadArtifactByChatId(chatId: string) {}
export async function createArtifactRecord(input: CreateArtifactInput) {}
export async function appendArtifactRevision(
  input: AppendArtifactRevisionInput
) {}
export async function upsertArtifactRuntimeSession(
  input: UpsertArtifactRuntimeSessionInput
) {}
```

**Step 2: Implement DB actions**

Add raw persistence operations to the existing `lib/db/actions.ts` file, which
already hosts chat persistence. Use `lib/actions/artifact.ts` for server
actions with caching and auth.

**Step 3: Add cache invalidation**

Use artifact-specific tags like:

- `artifact-${artifactId}`
- `artifact-chat-${chatId}`

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: no missing imports or action type errors.

**Step 5: Commit**

```bash
git add lib/actions/artifact.ts lib/db/actions.ts lib/actions/chat.ts
git commit -m "feat: add artifact persistence actions"
```

### Task 3: Add artifact UI data types and message serialization support

**Files:**

- Modify: `lib/types/ai.ts`
- Modify: `lib/utils/message-mapping.ts`
- Modify: `lib/types/message-persistence.ts` as needed
- Test: `lib/utils/__tests__/message-mapping-display-tools.test.ts`

**Step 1: Write the failing message types**

Add persistent AI SDK data part types:

```ts
export type ArtifactData = {
  id: string
  title: string
  status: ArtifactStatus
  previewUrl?: string
  revisionId?: string
}
```

Add:

- `data-artifact`
- `data-artifactStatus`
- transient `data-artifactLog`
- transient `data-artifactEvent`

**Step 2: Extend `UIDataTypes`**

Update [lib/types/ai.ts](/Users/nick/Projects/vana-v2/lib/types/ai.ts) so `useChat` and stream code can type artifact parts.

**Step 3: Ensure parts schema supports persisted artifact data**

Do not add new `parts` columns for artifacts. Reuse the existing generic
`data_*` fields in [lib/db/schema.ts](/Users/nick/Projects/vana-v2/lib/db/schema.ts)
and update [lib/utils/message-mapping.ts](/Users/nick/Projects/vana-v2/lib/utils/message-mapping.ts)
so:

- persistent `data-artifact` and `data-artifactStatus` round-trip through DB
- `tool-createWebappArtifact`, `tool-updateWebappArtifact`,
  `tool-getArtifactStatus`, and `tool-restartArtifactPreview` normalize to
  `tool-dynamic` rows with `tool_dynamic_type = 'artifact'`
- transient `data-artifactLog` and `data-artifactEvent` remain client-stream-only
- tests cover reconciliation IDs, persisted artifact tool mapping, and
  backward-compatible data-part mapping

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: data part types are valid across server and client code.

**Step 5: Run targeted persistence test**

Run: `bun run test -- lib/utils/__tests__/message-mapping-display-tools.test.ts`

Expected: artifact data parts and artifact tool invocations serialize through
the chosen persistence path without regressing existing display tool coverage.

**Step 6: Commit**

```bash
git add lib/types/ai.ts lib/utils/message-mapping.ts lib/types/message-persistence.ts lib/utils/__tests__/message-mapping-display-tools.test.ts
git commit -m "feat: add artifact UI message data types"
```

### Task 4: Build the E2B runtime adapter

**Files:**

- Create: `lib/artifacts/runtime/types.ts`
- Create: `lib/artifacts/runtime/e2b-runtime.ts`
- Create: `lib/artifacts/runtime/index.ts`
- Create: `lib/artifacts/templates/react-spa/*`
- Create: `lib/artifacts/runtime/e2b-runtime.test.ts`

**Step 1: Write the runtime interface**

Define a provider-neutral interface:

```ts
export interface ArtifactRuntime {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>
  writeFiles(input: WriteFilesInput): Promise<void>
  applySourceUpdate(input: ApplySourceUpdateInput): Promise<void>
  installDependencies(input: InstallDependenciesInput): Promise<void>
  runCommand(input: RunCommandInput): Promise<RunCommandResult>
  startPreview(input: StartPreviewInput): Promise<StartPreviewResult>
  restartPreview(input: RestartPreviewInput): Promise<StartPreviewResult>
  getLogs(input: GetLogsInput): Promise<RuntimeLog[]>
  destroySession(input: DestroySessionInput): Promise<void>
}
```

Implement the adapter with raw authenticated HTTP requests to E2B. Do not add
an E2B SDK dependency in MVP, and do not change `package.json` or `bun.lock`
for this task.

**Step 2: Create immutable React SPA template**

Include:

- Vite React app
- Tailwind setup
- local `components/ui`
- pinned `package.json`
- baseline app shell and utility helpers

Do not allow the model to edit template-owned files in MVP.

**Step 3: Implement E2B adapter**

Handle:

- session creation/reuse
- template file sync
- app source file updates
- preview start/restart
- log retrieval

Use server-side `fetch` against E2B endpoints from
`lib/artifacts/runtime/e2b-runtime.ts` so the rest of the codebase only depends
on the provider-neutral runtime interface.

**Step 4: Add environment and bootstrap validation**

Fail early if `E2B_API_KEY` is missing, and cover the runtime bootstrap in
tests:

- missing key throws a structured configuration error
- request construction includes the expected base URL and auth headers
- adapter initialization does not leak E2B details outside the runtime module

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: runtime adapter compiles without leaking E2B-specific details outside the runtime module.

**Step 6: Run targeted runtime test**

Run: `bun run test -- lib/artifacts/runtime/e2b-runtime.test.ts`

Expected: bootstrap validation and request construction pass without a live E2B
dependency.

**Step 7: Commit**

```bash
git add lib/artifacts/runtime lib/artifacts/templates
git commit -m "feat: add E2B artifact runtime adapter"
```

### Task 5: Add import validation and repair support for the immutable template

**Files:**

- Create: `lib/artifacts/validation/normalize-imports.ts`
- Create: `lib/artifacts/validation/validate-artifact-source.ts`
- Create: `lib/artifacts/template-manifest.ts`
- Test: `lib/artifacts/validation/validate-artifact-source.test.ts`

**Step 1: Write failing validation tests**

Cover:

- fake shadcn package imports
- `next/link` usage
- unsupported package imports
- allowed local `@/components/ui/*` imports

Example:

```ts
it('rewrites fake shadcn imports to local ui paths', () => {
  const result = normalizeImports("import { Button } from 'shadcn/ui'")
  expect(result.code).toContain('@/components/ui/button')
})
```

**Step 2: Implement template manifest**

Manifest should define:

- allowed source roots
- allowed import patterns
- banned import patterns
- template-owned files

**Step 3: Implement validation + normalization**

The validator should:

- reject `package.json` writes
- reject Next.js-only imports
- rewrite common bad imports when safe
- return structured repairable errors

**Step 4: Run tests**

Run: `bun run test -- lib/artifacts/validation/validate-artifact-source.test.ts`

Expected: all validation scenarios pass.

**Step 5: Commit**

```bash
git add lib/artifacts/validation lib/artifacts/template-manifest.ts
git commit -m "feat: add artifact template validation and import repair"
```

### Task 6: Add artifact tools and request context to the researcher agent

**Files:**

- Modify: `lib/agents/researcher.ts`
- Modify: `lib/agents/prompts/search-mode-prompts.ts`
- Create: `lib/tools/create-webapp-artifact.ts`
- Create: `lib/tools/update-webapp-artifact.ts`
- Create: `lib/tools/get-artifact-status.ts`
- Create: `lib/tools/restart-artifact-preview.ts`
- Create: `lib/artifacts/tool-context.ts`
- Modify: `lib/types/agent.ts`
- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Test: `lib/tools/*.ts`

**Step 1: Write the failing context contract and tool exports**

Add artifact tools with AI SDK `tool()` definitions and typed schemas.
Define a request-scoped artifact context contract, for example:

```ts
export interface ArtifactToolContext {
  chatId: string
  userId: string | null
  isGuest: boolean
  messages: UIMessage[]
  resolveGuestArtifactToken(): Promise<ValidatedGuestArtifactHandle | null>
  emitArtifact(data: ArtifactData): void
  emitArtifactStatus(data: ArtifactStatusData): void
  emitArtifactLog(data: ArtifactLogData): void
  emitArtifactEvent(data: ArtifactEventData): void
}
```

**Step 2: Thread request-scoped context through the agent**

Update [lib/agents/researcher.ts](/Users/nick/Projects/vana-v2/lib/agents/researcher.ts)
and both stream entrypoints so the `ToolLoopAgent` receives artifact execution
context via `experimental_context`. Artifact tools must not read module-global
state to discover `chatId`, auth state, or prior messages.

**Step 3: Implement create/update behavior**

Each tool should:

- locate or create the artifact record
- for authenticated flows, load/reuse the artifact by `chatId`
- for guest flows, recover the active artifact/runtime session only from the
  latest valid signed guest token carried in `data-artifact` or
  `data-artifactStatus`; do not trust raw artifact/runtime IDs from the client
- provision/reuse runtime session
- validate source updates
- run build/preview pipeline
- persist authenticated artifact tool invocations through the existing
  `tool-dynamic` message-part path with `tool_dynamic_type = 'artifact'`
- return structured artifact output, including a rotated guest token whenever
  `isGuest` is true

**Step 4: Register tools in the agent**

Update [lib/agents/researcher.ts](/Users/nick/Projects/vana-v2/lib/agents/researcher.ts) so both `chat` and `research` modes can call artifact tools when appropriate. Preserve existing mode differences such as `todoWrite` remaining research-only.

**Step 5: Update prompts**

Adjust artifact-related instructions in both search-mode prompts so webapp
requests favor artifact tools over plain text code dumps in either mode.

**Step 6: Run typecheck**

Run: `bun typecheck`

Expected: agent and tool typing remain valid.

**Step 7: Commit**

```bash
git add lib/agents/researcher.ts lib/agents/prompts/search-mode-prompts.ts lib/artifacts/tool-context.ts lib/tools lib/types/agent.ts lib/streaming/create-chat-stream-response.ts lib/streaming/create-ephemeral-chat-stream-response.ts
git commit -m "feat: add artifact generation tools"
```

### Task 7: Stream artifact state and logs through the AI SDK response pipeline

**Files:**

- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Create: `lib/streaming/helpers/write-artifact-data.ts`
- Create: `lib/streaming/helpers/write-artifact-data.test.ts`
- Modify: `components/chat.tsx`

**Step 1: Write the helper contract**

Add a helper that returns a writer-backed emitter for:

- persistent `data-artifact`
- persistent `data-artifactStatus`
- transient `data-artifactLog`
- transient `data-artifactEvent`

The helper should be the only way artifact tools emit streamed state, so
`ArtifactToolContext` gets a concrete event-emitter contract instead of direct
`writer` access.

**Step 2: Integrate helper into stream execution**

Use the existing `writer` in [lib/streaming/create-chat-stream-response.ts](/Users/nick/Projects/vana-v2/lib/streaming/create-chat-stream-response.ts) to build that emitter and inject it into the request-scoped artifact context when artifact tools run.

**Step 3: Wire transient artifact events on the client**

Update [components/chat.tsx](/Users/nick/Projects/vana-v2/components/chat.tsx)
to use `useChat({ onData })` for transient artifact log/event parts. Do not
expect transient parts to appear in `message.parts`.

**Step 4: Ensure guest flow parity**

Mirror the same behavior in the ephemeral stream path.

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: streamed artifact data parts are typed and compile for both auth and guest flows.

**Step 6: Commit**

```bash
git add lib/streaming/create-chat-stream-response.ts lib/streaming/create-ephemeral-chat-stream-response.ts lib/streaming/helpers/write-artifact-data.ts lib/streaming/helpers/write-artifact-data.test.ts components/chat.tsx
git commit -m "feat: stream artifact state into chat responses"
```

### Task 8: Build artifact client state and workspace shell

**Files:**

- Create: `app/api/artifacts/[artifactId]/actions/route.ts`
- Modify: `components/artifact/artifact-context.tsx`
- Modify: `components/artifact/chat-artifact-container.tsx`
- Modify: `components/inspector/inspector-panel.tsx`
- Modify: `components/inspector/inspector-drawer.tsx`
- Modify: `components/search-section.tsx`
- Modify: `components/reasoning-section.tsx`
- Create: `components/artifact/artifact-workspace.tsx`
- Create: `components/artifact/artifact-workspace-header.tsx`
- Create: `components/artifact/artifact-preview-frame.tsx`
- Create: `components/artifact/artifact-logs-panel.tsx`
- Test: `components/artifact/*.tsx`

**Step 1: Write the failing client state shape**

Replace the current `part`-only state with a dual-surface UI state that keeps
the existing inspector working:

```ts
interface ArtifactUiState {
  inspectedPart: Part | null
  workspace: ArtifactWorkspaceState
}

interface ArtifactWorkspaceState {
  artifactId: string | null
  revisionId: string | null
  title: string | null
  status: ArtifactStatus | null
  previewUrl: string | null
  isOpen: boolean
}
```

Keep a lightweight `open(part)` API for search/reasoning inspection and add
workspace-specific actions such as `openWorkspace`, `updateWorkspace`,
`appendWorkspaceLog`, and `closeWorkspace`.

**Step 2: Add executable header action path**

Create `app/api/artifacts/[artifactId]/actions/route.ts` as the server path for
workspace header actions:

- `POST { action: 'refresh' }` returns the same artifact/status payload shape as
  `getArtifactStatus`
- `POST { action: 'retry' }` returns the same artifact/status payload shape as
  `restartArtifactPreview`
- require auth for persisted chats and validate the guest artifact token for
  guest chats before reusing any artifact/runtime session

Keep `share` client-only in MVP by copying the current `previewUrl` to the
clipboard. Do not add a second share persistence flow.

**Step 3: Build workspace shell**

The shell should include:

- title/status header
- preview tab
- logs tab
- refresh/retry/share/close controls

**Step 4: Preserve current responsive behavior**

Keep desktop split view and mobile drawer model from
[components/artifact/chat-artifact-container.tsx](/Users/nick/Projects/vana-v2/components/artifact/chat-artifact-container.tsx),
and preserve the current inspector flows triggered from
[components/search-section.tsx](/Users/nick/Projects/vana-v2/components/search-section.tsx)
and [components/reasoning-section.tsx](/Users/nick/Projects/vana-v2/components/reasoning-section.tsx).
Artifact workspace state should be additive, not a breaking replacement for
generic inspect behavior.

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: workspace shell compiles and replaces inspector-only behavior for artifacts.

**Step 6: Commit**

```bash
git add app/api/artifacts components/artifact components/inspector/inspector-panel.tsx components/inspector/inspector-drawer.tsx components/search-section.tsx components/reasoning-section.tsx
git commit -m "feat: add artifact workspace shell"
```

### Task 9: Render artifact data parts and auto-open the workspace

**Files:**

- Modify: `components/render-message.tsx`
- Modify: `components/chat.tsx`
- Create: `components/tool-ui/artifact-card.tsx`
- Modify: `components/tool-ui/registry.tsx`
- Test: `components/render-message.tsx`

**Step 1: Write the failing artifact renderer**

Add a renderer that can consume `data-artifact` parts and show an inline artifact card/receipt in chat.

**Step 2: Auto-open artifact workspace**

When a new or updated artifact data part arrives, open the artifact workspace,
hydrate its state, and reconcile updates by stable artifact `id`.

**Step 3: Preserve current tool-result continuation logic**

Do not break interactive tool flow in
[components/chat.tsx](/Users/nick/Projects/vana-v2/components/chat.tsx), and
do not route generic inspector parts through the artifact workspace renderer.

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: artifact card and workspace opening work without breaking existing message rendering.

**Step 5: Commit**

```bash
git add components/render-message.tsx components/chat.tsx components/tool-ui
git commit -m "feat: render artifact cards and open workspace"
```

### Task 10: Add artifact-specific error handling and portfolio-friendly guest behavior

**Files:**

- Modify: `app/api/chat/route.ts`
- Modify: `components/chat.tsx`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Create: `lib/artifacts/errors.ts`
- Create: `lib/artifacts/guest-token.ts`
- Create: `lib/rate-limit/artifact-limits.ts`
- Create: `lib/artifacts/runtime/cleanup.ts`
- Modify: `app/api/chat/__tests__/route.test.ts`
- Modify: `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

**Step 1: Add artifact-aware errors**

Introduce structured error codes for:

- artifact build failed
- artifact runtime unavailable
- artifact preview expired

**Step 2: Keep guest behavior generous**

Use invisible guardrails only:

- soft per-session/runtime limits
- idle cleanup
- no prominent auth wall or quota UI
- guest artifact continuity should reuse only the latest valid signed
  `guestArtifactToken`, not raw artifact/runtime identifiers copied from prior
  assistant message data
- successful guest artifact responses should rotate and return a refreshed token
  in `data-artifact` and `data-artifactStatus`
- forged or expired guest tokens should fail closed on reuse: no raw ID fallback,
  no trust in client-supplied runtime identifiers
- if a guest token has expired, create/update may start a fresh artifact while
  status/retry returns a structured preview-expired error

**Step 3: Add cleanup hook**

Implement background-safe cleanup logic for expired runtime sessions and guest
artifacts. Token expiry should be aligned with cleanup so deleted guest
resources cannot be resumed by a stale token.

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: guest/auth flow remains intact and artifact-specific failures surface clearly.

**Step 5: Run targeted guest-integrity tests**

Run:

```bash
bun run test -- app/api/chat/__tests__/route.test.ts
bun run test -- lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts
```

Expected: forged and expired guest tokens are rejected by both the chat route
and the ephemeral stream path.

**Step 6: Commit**

```bash
git add app/api/chat/route.ts app/api/chat/__tests__/route.test.ts components/chat.tsx lib/streaming/create-ephemeral-chat-stream-response.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts lib/artifacts/errors.ts lib/artifacts/guest-token.ts lib/rate-limit/artifact-limits.ts lib/artifacts/runtime/cleanup.ts
git commit -m "feat: add artifact runtime error handling"
```

### Task 11: Add focused tests for artifact lifecycle behavior

**Files:**

- Modify: `lib/utils/__tests__/message-mapping-display-tools.test.ts`
- Create: `components/chat.test.tsx`
- Create: `components/artifact/artifact-workspace.test.tsx`
- Create: `components/artifact/artifact-context.test.tsx`
- Create: `lib/artifacts/validation/validate-artifact-source.test.ts`
- Create: `lib/artifacts/runtime/e2b-runtime.test.ts`
- Create: `lib/tools/__tests__/artifact-tools.test.ts`
- Create: `lib/streaming/helpers/write-artifact-data.test.ts`
- Create: `lib/actions/__tests__/artifact.test.ts`
- Modify: `app/api/chat/__tests__/route.test.ts`
- Modify: `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts`

**Step 1: Write lifecycle tests**

Cover:

- create artifact result shape
- update artifact preserves artifact id
- authenticated persistence stores artifact tool calls through `tool-dynamic`
- guest update reuses continuity only from a valid signed guest token
- forged or expired guest tokens are rejected in route and ephemeral-stream
  coverage
- workspace opens on artifact data
- legacy search/reasoning inspector still opens after the context refactor
- validation rejects template-owned file edits
- runtime bootstrap validation catches missing E2B configuration
- streaming reconciles artifact data by stable id
- `components/chat.test.tsx` verifies transient artifact logs/events are
  handled via `useChat({ onData })` without being persisted
- `components/artifact/artifact-workspace.test.tsx` verifies one workspace
  header action path executes against the artifact actions route

**Step 2: Run targeted tests**

Run:

```bash
bun run test -- lib/utils/__tests__/message-mapping-display-tools.test.ts
bun run test -- lib/artifacts/validation/validate-artifact-source.test.ts
bun run test -- lib/artifacts/runtime/e2b-runtime.test.ts
bun run test -- lib/tools/__tests__/artifact-tools.test.ts
bun run test -- lib/streaming/helpers/write-artifact-data.test.ts
bun run test -- components/chat.test.tsx
bun run test -- components/artifact/artifact-context.test.tsx
bun run test -- components/artifact/artifact-workspace.test.tsx
bun run test -- lib/actions/__tests__/artifact.test.ts
bun run test -- app/api/chat/__tests__/route.test.ts
bun run test -- lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts
```

Expected: all new artifact lifecycle tests pass.

**Step 3: Commit**

```bash
git add components/chat.test.tsx components/artifact/*.test.tsx lib/utils/__tests__/message-mapping-display-tools.test.ts lib/artifacts/runtime/*.test.ts lib/artifacts/validation/*.test.ts lib/tools/__tests__/artifact-tools.test.ts lib/streaming/helpers/*.test.ts lib/actions/__tests__/artifact.test.ts app/api/chat/__tests__/route.test.ts lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts
git commit -m "test: cover artifact lifecycle flows"
```

### Task 12: Run full verification and polish docs

**Files:**

- Modify: `docs/plans/2026-03-13-e2b-artifact-mvp-design.md`
- Modify: `docs/plans/2026-03-13-e2b-artifact-mvp.md`

**Step 1: Run lint**

Run: `bun lint`

Expected: no ESLint errors.

**Step 2: Run typecheck**

Run: `bun typecheck`

Expected: no TypeScript errors.

**Step 3: Run artifact tests**

Before Task 11 creates the new lifecycle tests, run only the artifact test
files that already exist in the repo. After Task 11 lands, run the full list
below.

Run:

```bash
bun run test -- lib/utils/__tests__/message-mapping-display-tools.test.ts
bun run test -- lib/artifacts/runtime/e2b-runtime.test.ts
bun run test -- lib/tools/__tests__/artifact-tools.test.ts
bun run test -- lib/streaming/helpers/write-artifact-data.test.ts
bun run test -- components/chat.test.tsx
bun run test -- components/artifact/artifact-context.test.tsx
bun run test -- components/artifact/artifact-workspace.test.tsx
bun run test -- lib/actions/__tests__/artifact.test.ts
bun run test -- app/api/chat/__tests__/route.test.ts
bun run test -- lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts
```

Expected: artifact-related tests pass.

**Step 4: Confirm doc accuracy**

Ensure the file paths, constraints, and sequencing in the docs match the final
implementation.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-13-e2b-artifact-mvp-design.md docs/plans/2026-03-13-e2b-artifact-mvp.md
git commit -m "docs: finalize E2B artifact MVP plan"
```

# E2B Artifact MVP Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a preview-first React SPA artifact workflow powered by E2B that supports create + multi-turn edits for guests and authenticated users in the existing Polymorph chat UI.

**Architecture:** Extend the current AI SDK tool-driven chat pipeline with explicit artifact tools, persistent artifact data parts, and a dedicated right-side workspace shell. Persist artifact identity, revisions, and runtime sessions separately so multi-turn edits and sandbox lifecycle remain stable. Use an immutable E2B React template with preinstalled shadcn-compatible UI and pinned dependencies to minimize generation failures.

**Tech Stack:** Next.js App Router, React 19, TypeScript, Bun, AI SDK 6, Drizzle, Supabase Postgres, E2B, Tailwind, shadcn/ui, Radix primitives

---

### Task 1: Add artifact schema and types

**Files:**

- Modify: `lib/db/schema.ts`
- Create: `lib/types/artifact.ts`
- Create: `lib/db/migrations/000X_artifacts.sql`
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

Create SQL migration matching the Drizzle schema.

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: artifact schema/types compile cleanly.

**Step 6: Commit**

```bash
git add lib/db/schema.ts lib/types/artifact.ts lib/db/migrations/000X_artifacts.sql
git commit -m "feat: add artifact persistence schema"
```

### Task 2: Add artifact persistence actions

**Files:**

- Modify: `lib/actions/chat.ts`
- Create: `lib/actions/artifact.ts`
- Create: `lib/db/actions/artifact.ts`
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

Mirror the existing chat action split:

- `lib/actions/*` for server actions/caching
- `lib/db/actions/*` for raw persistence operations

**Step 3: Add cache invalidation**

Use artifact-specific tags like:

- `artifact-${artifactId}`
- `artifact-chat-${chatId}`

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: no missing imports or action type errors.

**Step 5: Commit**

```bash
git add lib/actions/artifact.ts lib/db/actions/artifact.ts lib/actions/chat.ts
git commit -m "feat: add artifact persistence actions"
```

### Task 3: Add artifact UI data types and message serialization support

**Files:**

- Modify: `lib/types/ai.ts`
- Modify: `lib/db/schema.ts`
- Modify: `lib/db/actions/*` as needed for part serialization
- Test: `lib/types/ai.ts`

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

**Step 2: Extend `UIDataTypes`**

Update [lib/types/ai.ts](/Users/nick/Projects/vana-v2/lib/types/ai.ts) so `useChat` and stream code can type artifact parts.

**Step 3: Ensure parts schema supports persisted artifact data**

Reuse the existing generic `data_*` fields in [lib/db/schema.ts](/Users/nick/Projects/vana-v2/lib/db/schema.ts) instead of inventing per-artifact columns in `parts`.

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: data part types are valid across server and client code.

**Step 5: Commit**

```bash
git add lib/types/ai.ts lib/db/schema.ts lib/db/actions
git commit -m "feat: add artifact UI message data types"
```

### Task 4: Build the E2B runtime adapter

**Files:**

- Create: `lib/artifacts/runtime/types.ts`
- Create: `lib/artifacts/runtime/e2b-runtime.ts`
- Create: `lib/artifacts/runtime/index.ts`
- Create: `lib/artifacts/templates/react-spa/*`
- Test: `lib/artifacts/runtime/e2b-runtime.ts`

**Step 1: Write the runtime interface**

Define a provider-neutral interface:

```ts
export interface ArtifactRuntime {
  createSession(input: CreateSessionInput): Promise<CreateSessionResult>
  writeTemplateFiles(input: WriteTemplateFilesInput): Promise<void>
  applySourceUpdate(input: ApplySourceUpdateInput): Promise<void>
  runValidation(input: RunValidationInput): Promise<ValidationResult>
  startPreview(input: StartPreviewInput): Promise<StartPreviewResult>
  restartPreview(input: RestartPreviewInput): Promise<StartPreviewResult>
  getLogs(input: GetLogsInput): Promise<RuntimeLog[]>
  destroySession(input: DestroySessionInput): Promise<void>
}
```

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

**Step 4: Add environment validation**

Fail early if `E2B_API_KEY` is missing.

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: runtime adapter compiles without leaking E2B-specific details outside the runtime module.

**Step 6: Commit**

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

### Task 6: Add artifact tools to the researcher agent

**Files:**

- Modify: `lib/agents/researcher.ts`
- Create: `lib/tools/create-webapp-artifact.ts`
- Create: `lib/tools/update-webapp-artifact.ts`
- Create: `lib/tools/get-artifact-status.ts`
- Create: `lib/tools/restart-artifact-preview.ts`
- Modify: `lib/types/agent.ts`
- Test: `lib/tools/*.ts`

**Step 1: Write the failing tool exports**

Add artifact tools with AI SDK `tool()` definitions and typed schemas.

**Step 2: Implement create/update behavior**

Each tool should:

- locate or create the artifact record
- provision/reuse runtime session
- validate source updates
- run build/preview pipeline
- return structured artifact output

**Step 3: Register tools in the agent**

Update [lib/agents/researcher.ts](/Users/nick/Projects/vana-v2/lib/agents/researcher.ts) so chat mode can call artifact tools when appropriate.

**Step 4: Update prompts**

Adjust artifact-related instructions in the system prompts so webapp requests favor artifact tools over plain text code dumps.

**Step 5: Run typecheck**

Run: `bun typecheck`

Expected: agent and tool typing remain valid.

**Step 6: Commit**

```bash
git add lib/agents/researcher.ts lib/tools lib/types/agent.ts
git commit -m "feat: add artifact generation tools"
```

### Task 7: Stream artifact state and logs through the AI SDK response pipeline

**Files:**

- Modify: `lib/streaming/create-chat-stream-response.ts`
- Modify: `lib/streaming/create-ephemeral-chat-stream-response.ts`
- Create: `lib/streaming/helpers/write-artifact-data.ts`
- Test: `lib/streaming/helpers/write-artifact-data.ts`

**Step 1: Write the helper contract**

Add a helper that writes:

- persistent `data-artifact`
- persistent `data-artifactStatus`
- transient log/status updates

**Step 2: Integrate helper into stream execution**

Use the existing `writer` in [lib/streaming/create-chat-stream-response.ts](/Users/nick/Projects/vana-v2/lib/streaming/create-chat-stream-response.ts) to merge artifact state into the response stream when artifact tools run.

**Step 3: Ensure guest flow parity**

Mirror the same behavior in the ephemeral stream path.

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: streamed artifact data parts are typed and compile for both auth and guest flows.

**Step 5: Commit**

```bash
git add lib/streaming/create-chat-stream-response.ts lib/streaming/create-ephemeral-chat-stream-response.ts lib/streaming/helpers/write-artifact-data.ts
git commit -m "feat: stream artifact state into chat responses"
```

### Task 8: Build artifact client state and workspace shell

**Files:**

- Modify: `components/artifact/artifact-context.tsx`
- Modify: `components/artifact/chat-artifact-container.tsx`
- Modify: `components/inspector/inspector-panel.tsx`
- Create: `components/artifact/artifact-workspace.tsx`
- Create: `components/artifact/artifact-workspace-header.tsx`
- Create: `components/artifact/artifact-preview-frame.tsx`
- Create: `components/artifact/artifact-logs-panel.tsx`
- Test: `components/artifact/*.tsx`

**Step 1: Write the failing client state shape**

Replace the current `part`-only state with workspace state:

```ts
interface ArtifactWorkspaceState {
  artifactId: string | null
  revisionId: string | null
  title: string | null
  status: ArtifactStatus | null
  previewUrl: string | null
  isOpen: boolean
}
```

**Step 2: Build workspace shell**

The shell should include:

- title/status header
- preview tab
- logs tab
- refresh/retry/share/close controls

**Step 3: Preserve current responsive behavior**

Keep desktop split view and mobile drawer model from [components/artifact/chat-artifact-container.tsx](/Users/nick/Projects/vana-v2/components/artifact/chat-artifact-container.tsx).

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: workspace shell compiles and replaces inspector-only behavior for artifacts.

**Step 5: Commit**

```bash
git add components/artifact components/inspector/inspector-panel.tsx
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

When a new or updated artifact data part arrives, open the artifact workspace and hydrate its state.

**Step 3: Preserve current tool-result continuation logic**

Do not break interactive tool flow in [components/chat.tsx](/Users/nick/Projects/vana-v2/components/chat.tsx).

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
- Create: `lib/rate-limit/artifact-limits.ts`
- Create: `lib/artifacts/runtime/cleanup.ts`
- Test: `app/api/chat/route.ts`

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

**Step 3: Add cleanup hook**

Implement background-safe cleanup logic for expired runtime sessions.

**Step 4: Run typecheck**

Run: `bun typecheck`

Expected: guest/auth flow remains intact and artifact-specific failures surface clearly.

**Step 5: Commit**

```bash
git add app/api/chat/route.ts components/chat.tsx lib/rate-limit/artifact-limits.ts lib/artifacts/runtime/cleanup.ts
git commit -m "feat: add artifact runtime error handling"
```

### Task 11: Add focused tests for artifact lifecycle behavior

**Files:**

- Create: `components/artifact/artifact-workspace.test.tsx`
- Create: `lib/artifacts/validation/validate-artifact-source.test.ts`
- Create: `lib/tools/create-webapp-artifact.test.ts`
- Create: `lib/tools/update-webapp-artifact.test.ts`
- Create: `lib/streaming/helpers/write-artifact-data.test.ts`

**Step 1: Write lifecycle tests**

Cover:

- create artifact result shape
- update artifact preserves artifact id
- workspace opens on artifact data
- validation rejects template-owned file edits
- streaming reconciles artifact data by stable id

**Step 2: Run targeted tests**

Run:

```bash
bun run test -- lib/artifacts/validation/validate-artifact-source.test.ts
bun run test -- lib/tools/create-webapp-artifact.test.ts
bun run test -- lib/tools/update-webapp-artifact.test.ts
bun run test -- lib/streaming/helpers/write-artifact-data.test.ts
bun run test -- components/artifact/artifact-workspace.test.tsx
```

Expected: all new artifact lifecycle tests pass.

**Step 3: Commit**

```bash
git add components/artifact/*.test.tsx lib/artifacts/validation/*.test.ts lib/tools/*.test.ts lib/streaming/helpers/*.test.ts
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

Run:

```bash
bun run test -- lib/artifacts
bun run test -- components/artifact
```

Expected: artifact-related tests pass.

**Step 4: Update docs if implementation diverged**

Correct any file paths, constraints, or sequencing details in the docs.

**Step 5: Commit**

```bash
git add docs/plans/2026-03-13-e2b-artifact-mvp-design.md docs/plans/2026-03-13-e2b-artifact-mvp.md
git commit -m "docs: finalize E2B artifact MVP plan"
```

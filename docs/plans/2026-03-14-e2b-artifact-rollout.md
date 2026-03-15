# E2B Artifact Rollout & Future Work

**Status:** Code-complete. MVP (Tasks 1-12) + Batch 4 (Tasks 13-17) merged.
**Last updated:** 2026-03-14

---

## Deployment Checklist

### Prerequisites

- [ ] PR #52 (batch 4) merged to `main`
- [ ] Production build passes (`bun run build`)

### Environment Setup

- [ ] Set `E2B_API_KEY` in production environment (obtain from [e2b.dev/dashboard](https://e2b.dev/dashboard))
- [ ] Set `GUEST_ARTIFACT_SECRET` — generate with `openssl rand -base64 32`
- [ ] Optionally set `GUEST_ARTIFACT_TOKEN_TTL_MS` (default: `1800000` / 30 minutes)
- [ ] Set `ENABLE_ARTIFACTS=true` to activate artifact tools

### Smoke Test

- [ ] Create a simple artifact ("build a counter app")
- [ ] Verify preview iframe loads with working React SPA
- [ ] Verify multi-turn edit ("make the button blue")
- [ ] Verify Code tab shows source files
- [ ] Verify Logs tab shows build output
- [ ] Verify Retry button works on intentional failure
- [ ] Verify "Ask AI to fix" submits a repair message
- [ ] Verify guest flow works without authentication
- [ ] Verify guest token rotation (second artifact edit in same session)
- [ ] Verify workspace close/reopen preserves state
- [ ] Verify mobile drawer behavior

### Monitoring (First 48 Hours)

- [ ] Check structured logs for `artifact.create.complete` events — confirm `durationMs` is reasonable (<30s)
- [ ] Check `artifact.create.error` events — identify common failure modes
- [ ] Monitor E2B dashboard for sandbox count and runtime spend
- [ ] Verify `artifact.cleanup.run` events fire and destroy idle sessions
- [ ] Check guest token verification failures in ephemeral stream logs

---

## Observed Metrics to Track

Per the [MVP design doc](2026-03-13-e2b-artifact-mvp-design.md#rollout):

| Metric                   | Source                                          | Target           |
| ------------------------ | ----------------------------------------------- | ---------------- |
| Sandbox startup latency  | `artifact.create.complete` `durationMs`         | < 15s            |
| Build success rate       | `complete` / (`complete` + `error`) events      | > 85%            |
| Average session duration | E2B dashboard                                   | Informational    |
| Repair success rate      | Second `artifact.update.complete` after `error` | > 50%            |
| Guest usage share        | `isGuest: true` in lifecycle logs               | Informational    |
| Runtime spend            | E2B billing dashboard                           | Budget-dependent |

---

## Future Features

Prioritized backlog for post-rollout work. None of these are started.

### High Priority

#### File Editor Tab

- Replace read-only code viewer with an editable code tab (Monaco or CodeMirror)
- Allow users to directly edit source files and trigger a rebuild
- Requires new workspace action: `SAVE_AND_REBUILD`
- **Files:** `components/artifact/artifact-code-viewer.tsx` → replace, add editor dependency

#### `getArtifactLogs` Helper Tool

- Let the model query build/runtime logs directly to self-diagnose failures
- Currently "Ask AI to fix" sends error context as a user message — this tool would give the model direct log access
- **Files:** Create `lib/tools/get-artifact-logs.ts`, register in `lib/agents/researcher.ts`

### Medium Priority

#### Version History UI

- Display revision timeline in workspace (the `artifactRevisions` table already stores revision data)
- Allow reverting to a previous revision
- **Files:** Create `components/artifact/artifact-revision-history.tsx`, add workspace tab

#### `snapshotArtifact` Helper Tool

- Save a named snapshot of the current sandbox state for rollback
- Uses E2B sandbox snapshot API
- **Files:** Create `lib/tools/snapshot-artifact.ts`, register in researcher

#### Template Expansion: More Starter Templates

- Add dashboard, landing page, and form templates beyond the generic React SPA
- Model selects appropriate template based on user intent
- **Files:** New directories under `lib/artifacts/templates/`, update `createWebappArtifact` schema

### Low Priority

#### Vercel Sandbox Adapter

- The runtime interface (`lib/artifacts/runtime/types.ts`) is already provider-neutral
- Implement `lib/artifacts/runtime/vercel-runtime.ts` as an alternative to E2B
- Select provider via environment variable or config
- **Files:** Create `lib/artifacts/runtime/vercel-runtime.ts`, update `lib/artifacts/runtime/index.ts`

#### Artifact Deployment/Export

- Let users download artifact source as a zip or deploy to Vercel
- Requires new workspace header action and API route
- Not scoped in MVP design

#### Collaboration

- Real-time multi-user artifact editing
- Not scoped in MVP design

---

## Completed Work Reference

| Batch      | PR     | Tasks       | Summary                                                                      |
| ---------- | ------ | ----------- | ---------------------------------------------------------------------------- |
| MVP (1-7)  | Merged | Tasks 1-7   | Schema, persistence, types, runtime adapter, validation, tools, streaming    |
| MVP (8-12) | #51    | Tasks 8-12  | Workspace UI, rendering, guest security, tests, docs                         |
| Batch 4    | #52    | Tasks 13-17 | Feature flag, template expansion, code viewer, observability, error recovery |

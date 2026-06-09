# PR 173 Phase 2 Manual QA Remediation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolve the PR173 Phase 2 manual QA blockers and the failed canvas update flow so Phase 2 can be re-verified as a parked merge candidate.

**Architecture:** PR173 adds richer AI SDK tool rendering on top of the existing chat message renderer. The canvas tools persist artifact state on the server and emit tool/data parts that the client converts into dedicated Tool UI components. The remediation keeps server tool behavior intact, fixes the client renderer so context-only artifact reads do not masquerade as final artifact cards, and establishes an authenticated local QA path when the Vercel preview is protected.

**Tech Stack:** Next.js App Router, Vercel AI SDK tool parts, Supabase Auth, Tool UI registry, Vitest, Testing Library, Chrome manual QA.

---

## Scope Rules

- [ ] Keep PR171 and PR173 draft.
- [ ] Do not merge either PR.
- [ ] Do not mark either PR ready for review.
- [ ] Do not start Phase 3 planning.
- [ ] Preserve unrelated worktree changes.
- [ ] Do not count guest mode or `ENABLE_AUTH=false` as authenticated QA.

## Required Worktree And Branch

- [ ] Do all implementation and verification work from `/Users/nick/.codex/worktrees/restack-pr173/vana-v2`.
- [ ] Required local branch: `codex/restack-pr173-clean`.
- [ ] This is the PR173 restack worktree and currently points at `2d1125672d1e4df14e90402a4bd053916aa0b9ee`, matching PR173 head `origin/codex/ai-sdk-contract-phase-2`.
- [ ] Do not use `/Users/nick/.codex/worktrees/2580/vana-v2`; it is detached at `fb3f7ab`.
- [ ] Do not use `/Users/nick/.codex/worktrees/phase2-ai-sdk-contract/vana-v2`; its local `codex/ai-sdk-contract-phase-2` branch is stale/diverged.
- [ ] Before editing code, run `git status --short --branch` and confirm `## codex/restack-pr173-clean`.
- [ ] Stage only files intentionally changed for this Phase 2 remediation.

## Current Evidence

- PR171 remains draft, base `main`, head `codex/ai-sdk-contract-phase-1`, head `ec99402938e47baefb739a5e91022505a6e1a6dc`, mergeable and clean.
- PR173 remains draft, base `codex/ai-sdk-contract-phase-1`, head `codex/ai-sdk-contract-phase-2`, head `2d1125672d1e4df14e90402a4bd053916aa0b9ee`, mergeable and clean.
- PR173 Vercel preview returns Vercel SSO `401` for `/` and `/api/health`, so preview QA is blocked before app code runs.
- Local Chrome target is `http://localhost:43100`.
- Local browser was guest-only during validation: `#guest-menu-trigger` rendered and `#user-menu-trigger` did not.
- Manual QA pass items already verified locally: guest chat, build prompt path, option-list completion, question-wizard completion, image generation, and live `competitorResearch` specialist rendering.
- Manual QA blocked items: authenticated chat in search mode and authenticated chat in research mode.
- Manual QA failed item: canvas read/update flow rendered two identical `Phoenix Pro Project Tracker Dashboard` cards, both `Ready`.

## Root Cause Summary

### Canvas Duplicate Ready Card

- `readCanvasArtifact` is a context tool. It reads the current artifact before an update and returns metadata plus `files` from `lib/tools/read-canvas-artifact/server.ts`.
- The read output includes `artifactId`, `chatId`, `title`, and `status`, which is enough to match the canvas card parser in `components/tool-ui/canvas-artifact-card.tsx`.
- `components/render-message.tsx` now tries rich Tool UI rendering for any completed `tool-*` part through `tryRenderToolUIByName`.
- `components/tool-ui/registry.tsx` has no named `readCanvasArtifact` entry, so `tryRenderToolUIByName` falls back to trying every registered schema.
- The generic fallback parses the read output as `canvasArtifactCard`, so the read step immediately renders a `Ready` artifact card.
- The later `updateCanvasArtifact` data part correctly renders the final artifact card, producing the duplicate.

### Authenticated QA Block

- The preview blocker is Vercel Deployment Protection/SSO, not app auth.
- Local auth requires a real Supabase session. `app/(chat)/layout.tsx` only passes a user to the shell after `supabase.auth.getUser()` succeeds, and `components/header.tsx` renders `#user-menu-trigger` only for an authenticated user.
- `ENABLE_AUTH=false` is not an acceptable substitute because it bypasses real authenticated UI/session behavior.

### Non-Blocking Residuals

- `competitorResearch` is wired on the research agent and rendered with its dedicated component in `components/tool-ui/competitor-research-result.tsx`.
- Brave 429s fell through to the tested provider fallback path in `lib/tools/search/server.ts`; the streamed response still completed with rendered results.
- `DataTable` missing `rowIdKey` is a dev warning from `components/tool-ui/data-table/data-table.tsx`; it is unrelated to the dedicated competitor renderer.
- The Radix `DialogContent` description warning appears tied to `components/ui/command.tsx`, which currently has no in-repo consumer. Treat this as an accessibility follow-up unless a later browser run ties it to a Phase 2 flow.

## Implementation Plan

### 1. Pre-Flight Verification

- [ ] Run `git status --short --branch` from `/Users/nick/.codex/worktrees/restack-pr173/vana-v2`.
- [ ] Re-check PR171 and PR173 state with `gh pr view` and `gh pr checks`.
- [ ] Confirm the local dev server is still the PR173 worktree:

```bash
lsof -nP -iTCP:43100 -sTCP:LISTEN
lsof -a -p <PID> -d cwd -Fn
```

- [ ] Confirm preview access state before choosing target:

```bash
curl -I https://polymorph-git-codex-ai-sdk-contrac-4abf39-nick-bohmers-projects.vercel.app/
curl -I https://polymorph-git-codex-ai-sdk-contrac-4abf39-nick-bohmers-projects.vercel.app/api/health
```

- [ ] If preview is still `401`, use `http://localhost:43100` for Chrome QA.

### 2. Add Failing Canvas Coverage

- [ ] In `components/render-message.test.tsx`, extend the Tool UI registry mock so `tool-readCanvasArtifact` can reproduce the current accidental card render when its output has `artifactId`, `chatId`, and `status`.
- [ ] Add a test where a single assistant message contains:
  - `tool-readCanvasArtifact` output for `artifact-1` with `status: "ready"` and `files`.
  - `data-canvasArtifactStatus` for `artifact-1` showing update progress or final ready state.
  - `tool-updateCanvasArtifact` output for `artifact-1`.
  - final `data-canvasArtifact` for `artifact-1`.
- [ ] Assert the rendered DOM contains exactly one canvas artifact card for `artifact-1`.
- [ ] Assert the surviving card reflects the latest persisted/update data, not the earlier read output.

Suggested test shape:

```tsx
it('does not render readCanvasArtifact output as a duplicate canvas card during updates', () => {
  const message = createAssistantMessage([
    {
      type: 'tool-readCanvasArtifact',
      state: 'output-available',
      toolCallId: 'read-1',
      output: {
        artifactId: 'artifact-1',
        chatId: 'chat-1',
        title: 'Phoenix Pro Project Tracker Dashboard',
        status: 'ready',
        draftRevision: 1,
        currentVersionId: 'version-1',
        files: [
          { path: 'app/page.tsx', content: 'export default function Page() {}' }
        ]
      }
    },
    {
      type: 'tool-updateCanvasArtifact',
      state: 'output-available',
      toolCallId: 'update-1',
      output: {
        artifactId: 'artifact-1',
        chatId: 'chat-1',
        title: 'Phoenix Pro Project Tracker Dashboard',
        status: 'ready',
        draftRevision: 2,
        currentVersionId: 'version-2'
      }
    },
    {
      type: 'data-canvasArtifact',
      data: {
        artifactId: 'artifact-1',
        chatId: 'chat-1',
        title: 'Phoenix Pro Project Tracker Dashboard',
        status: 'ready',
        draftRevision: 2,
        currentVersionId: 'version-2'
      }
    }
  ])

  render(<RenderMessage message={message} />)

  expect(screen.getAllByTestId('canvas-artifact-card')).toHaveLength(1)
})
```

- [ ] Add the same behavior for a `dynamic-tool` `readCanvasArtifact` part if current persisted messages can produce that shape.

### 3. Fix Read Tool Rendering

- [ ] In `components/tool-ui/registry.tsx`, add a narrow non-renderable tool guard for context-only tools before generic schema fallback:

```ts
const nonRenderableToolNames = new Set(['readCanvasArtifact'])

export function tryRenderToolUIByName(
  toolName: string,
  output: unknown,
  partId: string
): ReactNode | null {
  const named = entries.find(e => e.name === toolName)
  if (named) {
    const result = named.tryRender(output, partId)
    if (result) return result
  }

  if (nonRenderableToolNames.has(toolName)) {
    return null
  }

  return tryRenderToolUI(output, partId)
}
```

- [ ] In `components/render-message.tsx`, add an explicit guard before the generic `tool-*` render branch calls `tryRenderToolUIByName` if the registry guard alone does not suppress the read card in the failing test:

```ts
const nonRenderableToolPartNames = new Set(['readCanvasArtifact'])

// inside the generic tool-* branch, after toolName is derived
if (nonRenderableToolPartNames.has(toolName)) {
  buffer.push(part)
  return
}
```

- [ ] Do not change `lib/tools/read-canvas-artifact/server.ts`; read output with `files` is required for the model to perform updates.
- [ ] Do not change `lib/tools/update-canvas-artifact/server.ts`; update still needs to emit progress/status and final artifact data.
- [ ] Keep create/update card dedupe behavior intact for cases where no `data-canvasArtifact` arrives.

### 4. Add Registry Guard Coverage

- [ ] In `components/tool-ui/registry.test.tsx`, add a regression test for the false-positive fallback:

```tsx
it('does not render readCanvasArtifact output through the canvas card fallback', () => {
  const rendered = tryRenderToolUIByName(
    'readCanvasArtifact',
    {
      artifactId: 'artifact-1',
      chatId: 'chat-1',
      title: 'Phoenix Pro Project Tracker Dashboard',
      status: 'ready',
      files: [{ path: 'app/page.tsx', content: 'source' }]
    },
    'part-1'
  )

  expect(rendered).toBeNull()
})
```

- [ ] Add a positive control that `tryRenderToolUIByName('createCanvasArtifact', output, partId)` and `tryRenderToolUIByName('updateCanvasArtifact', output, partId)` still render the card.

### 5. Authenticated Local QA Unblock

- [ ] If preview remains protected, use local auth instead of preview auth.
- [ ] Confirm local Supabase auth settings:

```bash
curl -sS http://127.0.0.1:44321/auth/v1/settings \
  | jq '{external_email_enabled,disable_signup,mailer_autoconfirm}'
```

- [ ] Open `http://localhost:43100/auth/sign-up?next=/` in Chrome.
- [ ] Create a local QA user through the UI. Do not print credentials in logs or the final report.
- [ ] Verify authenticated shell state in Chrome:

```js
!!document.querySelector('#user-menu-trigger') // must be true
!!document.querySelector('#guest-menu-trigger') // must be false
```

- [ ] If local signup is disabled or fails, record authenticated search and research as `blocked` with the exact UI/API error. Do not convert them to pass.
- [ ] If provider keys are unavailable and `/api/chat` returns `PROVIDER_UNAVAILABLE`, record the relevant flow as `blocked` with the response status/body summary.

### 6. Re-Run Automated Verification

- [ ] Run focused tests:

```bash
bun run test -- --run \
  components/render-message.test.tsx \
  components/tool-ui/registry.test.tsx \
  components/tool-ui/tool-part-registry.test.tsx \
  components/tool-ui/data-table/data-table.test.tsx \
  lib/tools/__tests__/canvas-tools.test.ts \
  lib/tools/__tests__/search-provider-routing.test.ts
```

- [ ] Run broader project checks:

```bash
bun run lint
bun run typecheck
```

- [ ] If any command fails, stop and record the failing command plus the first actionable error.

### 7. Re-Run Chrome Manual QA Matrix

Use the Vercel preview only if SSO protection is cleared. Otherwise use `http://localhost:43100`.

- [ ] Authenticated chat in search mode:
  - Confirm `#user-menu-trigger`.
  - Select Search/default mode.
  - Submit a prompt requiring streamed output.
  - Pass only if `/api/chat` streams successfully, output renders, no unexpected console/runtime errors appear, and history persists after reload.
- [ ] Authenticated chat in research mode:
  - Confirm `#user-menu-trigger`.
  - Select Research mode with `#mode-selector-trigger`.
  - Submit a live research prompt.
  - Pass only if research routing occurs, sources/tool output render, no unexpected API failure appears, and history persists after reload.
- [ ] Build-mode prompt path:
  - Submit a build prompt.
  - Pass if question wizard or build flow renders dedicated UI and reaches artifact creation.
- [ ] Guest chat flow:
  - Sign out or use a clean guest session.
  - Pass if guest chat streams successfully and guest UI state is correct.
- [ ] Interactive option-list completion:
  - Trigger `displayOptionList`.
  - Select an option and confirm.
  - Pass if continuation runs and tool UI does not render raw JSON.
- [ ] Interactive question-wizard completion:
  - Trigger `displayQuestionWizard`.
  - Complete all steps.
  - Pass if continuation runs and tool UI does not render raw JSON.
- [ ] Canvas create/read/update with progress events:
  - Create a canvas artifact.
  - Ask the model to read current source first, then update it.
  - Pass only if progress/status appears appropriately and exactly one final artifact card is visible for the updated artifact.
  - Fail if a read step renders an immediate `Ready` artifact card before the update completes.
- [ ] Image-generation flow:
  - Submit a simple image request.
  - Pass if generated image UI renders and no unexpected network failure occurs.
- [ ] Live competitor-research specialist invocation and rendered result:
  - Use Research mode.
  - Ask for a comparison using the `competitorResearch` specialist.
  - Pass if the dedicated `Competitor Research` component renders. Provider fallback warnings can be recorded as residuals if the request completes.

### 8. Final Acceptance Gate

- [ ] Update the Phase 2 manual QA report with exact pass, fail, and blocked statuses.
- [ ] Include the Chrome target used.
- [ ] Include exact blockers with browser/API evidence.
- [ ] Include code references only for verified repo issues.
- [ ] Recommend `Phase 2 parked acceptance can be recorded` only if:
  - The duplicate canvas card regression is fixed and verified in Chrome.
  - Authenticated search and research are either passed or remain explicitly blocked by preview/auth/provider access with exact evidence.
  - No new Phase 2 acceptance failures are found.
- [ ] Otherwise recommend `Phase 2 is not accepted yet; fix/verify these items first`.

## Follow-Up Items Not Required For Phase 2 Acceptance

- [ ] Add prompt guidance so generated `displayTable` calls include `rowIdKey` when rows have stable identifiers.
- [ ] Add a focused `DataTable` warning test for `rowIdKey`.
- [ ] Add `DialogDescription` coverage to `CommandDialog` if it becomes reachable through current app UI.
- [ ] Investigate Brave quota pressure only if provider fallback noise becomes operationally disruptive.

## Implementation Results - 2026-04-26

### Code Changes

- Fixed the duplicate canvas read/update renderer path by treating `readCanvasArtifact` as a non-renderable context tool in `components/tool-ui/registry.tsx` and `components/render-message.tsx`.
- Added regression coverage for regular `tool-readCanvasArtifact`, `dynamic-tool` `readCanvasArtifact`, and the registry fallback false positive in `components/render-message.test.tsx` and `components/tool-ui/registry.test.tsx`.
- Fixed a live specialist failure found during QA: `competitorResearch` now falls back to search snippets when fetching the top source returns an error such as HTTP 403.
- Added prompt guidance so explicit user requests to call or use `competitorResearch` must route through the specialist before generic search/table/prose.

### Verification

- `bun run test -- --run components/render-message.test.tsx components/tool-ui/registry.test.tsx components/tool-ui/tool-part-registry.test.tsx components/tool-ui/data-table/data-table.test.tsx lib/tools/__tests__/canvas-tools.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/agents/chat/__tests__/specialists.test.ts lib/agents/prompts/search-mode-prompts.test.ts` passed: 8 files, 117 tests.
- `bun run lint` passed.
- `bun run typecheck` passed.

### Chrome Manual QA Report

Chrome target: `http://localhost:43100`. The PR173 Vercel preview remained blocked by Vercel SSO with HTTP 401 for `/` and `/api/health`, so preview QA did not reach app code.

| Flow                                   | Status                | Evidence                                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------- | --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated shell                    | Pass                  | Local Chrome showed `#user-menu-trigger` present and `#guest-menu-trigger` absent. Local signup/auth was used; credentials are intentionally not recorded.                                                                                                                                                                                          |
| Authenticated search mode              | Pass                  | Chat `sh5f1sdz11po4qgx0rw5lp13` streamed and persisted after reload. A local-only DB schema drift blocker was repaired by adding the missing `messages.ui_message` column in the configured local DB; no repo file changed for that repair.                                                                                                         |
| Authenticated research mode            | Pass                  | Chat `l2z08mluv43xz6fyao6mtqpt` streamed in Research mode and persisted after reload with authenticated UI state.                                                                                                                                                                                                                                   |
| Live `competitorResearch` specialist   | Pass                  | Chat `bbep8rl4s8ducg6ahnd0andv` used Research mode with an explicit `competitorResearch` request and rendered the dedicated `Competitor Research` component.                                                                                                                                                                                        |
| Build-mode prompt path                 | Pass                  | Chat `zhrey8pxiy03shkejewlm4fo` in Build mode created a ready `Phoenix Pro Project Tracker Dashboard` canvas artifact.                                                                                                                                                                                                                              |
| Canvas create/read/update              | Pass                  | The same chat was updated after an explicit read-first request. During the update flow there were two cards total across the whole chat: the original create card plus one update card. The previous extra read-generated `Ready` card did not reproduce. After reload, the persisted chat showed one canvas artifact card for the active artifact. |
| Guest chat flow                        | Pass, carried forward | Already verified in the pre-remediation local manual QA evidence; not re-run here to preserve the authenticated local QA session.                                                                                                                                                                                                                   |
| Interactive option-list completion     | Pass, carried forward | Already verified in the pre-remediation local manual QA evidence.                                                                                                                                                                                                                                                                                   |
| Interactive question-wizard completion | Pass, carried forward | Already verified in the pre-remediation local manual QA evidence.                                                                                                                                                                                                                                                                                   |
| Image-generation flow                  | Pass, carried forward | Already verified in the pre-remediation local manual QA evidence.                                                                                                                                                                                                                                                                                   |

Residuals:

- The `DataTable` `rowIdKey` warning still appears in dev console output and remains a non-blocking follow-up.
- The Radix `DialogContent` description warning still appears in dev console output and remains a non-blocking accessibility follow-up unless tied to a current Phase 2 flow.
- One stale console error from the earlier local DB schema-drift run remained visible in browser log history; it did not recur in the post-repair search, research, competitor, or canvas runs.

Recommendation: **Phase 2 parked acceptance can be recorded** for the remediated PR173 blockers. PR171 and PR173 should remain draft, unmerged, and not marked ready for review.

## Final Completion Verification Attempt - 2026-04-26

Status: **Phase 2 complete except blocked by authenticated Chrome replay access**.

This pass was run from `/Users/nick/.codex/worktrees/restack-pr173/vana-v2` on `codex/restack-pr173-clean` at `c5d11e422c8e320fdf700dba53e1c1e2db6411a0`. The worktree was clean before and after verification.

### Stacked PR State

- PR171: open draft, base `main`, head `codex/ai-sdk-contract-phase-1`, head SHA `ec99402938e47baefb739a5e91022505a6e1a6dc`, `mergeStateStatus: CLEAN`.
- PR173: open draft, base `codex/ai-sdk-contract-phase-1`, head `codex/ai-sdk-contract-phase-2`, head SHA `2d1125672d1e4df14e90402a4bd053916aa0b9ee`, `mergeStateStatus: CLEAN`.
- PR177: open draft, base `codex/ai-sdk-contract-phase-2`, head `codex/restack-pr173-clean`, head SHA `c5d11e422c8e320fdf700dba53e1c1e2db6411a0`, `mergeStateStatus: CLEAN`.
- PR177 head still matches the expected prior-review SHA `c5d11e422c8e320fdf700dba53e1c1e2db6411a0`.
- PR171's previous `mergeStateStatus: UNKNOWN` did not reproduce; `gh pr view`, GraphQL, and REST checks all reported clean/mergeable state during the current pass.

Commands:

```bash
git status --short --branch
gh pr view 171 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr view 173 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr view 177 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr checks 171
gh pr checks 173
gh pr checks 177
gh pr view 177 --json statusCheckRollup,url
```

Check status:

- PR171: `Build`, `Format Check`, `Lint`, `Test`, `Test (evals)`, `Type Check`, `Vercel`, `Vercel Preview Comments`, and `CodeRabbit` passed.
- PR173: `Vercel`, `Vercel Preview Comments`, and `CodeRabbit` passed.
- PR177: `Vercel`, `Vercel Preview Comments`, and `CodeRabbit` passed.
- No failing or pending checks were reported.

### Automated Verification

Commands:

```bash
bun run test -- --run components/render-message.test.tsx components/tool-ui/registry.test.tsx components/tool-ui/tool-part-registry.test.tsx components/tool-ui/data-table/data-table.test.ts lib/tools/__tests__/canvas-tools.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/agents/chat/__tests__/specialists.test.ts lib/agents/prompts/search-mode-prompts.test.ts
bun run lint
bun run typecheck
```

Results:

- Focused tests passed: 8 files, 117 tests.
- `bun run lint` passed.
- `bun run typecheck` passed.

### Core Fix Revalidation

- `readCanvasArtifact` remains a non-renderable context-only path in `components/render-message.tsx` and `components/tool-ui/registry.tsx`.
- Create/update artifact cards still render through the explicit create/update paths.
- Tests cover regular `tool-readCanvasArtifact`, dynamic-tool `readCanvasArtifact`, and the registry fallback false-positive.
- `competitorResearch` still falls back to search snippets when top-source fetch fails.
- Prompt forcing remains narrow: only explicit requests to call or use `competitorResearch` require the specialist path.

### Chrome/Manual QA

Chrome target: `http://localhost:43100`.

Dev server command:

```bash
bun --env-file=/Users/nick/Projects/vana-v2/.env.local run dev
```

Local runtime state:

- `curl -I http://localhost:43100` returned HTTP 200.
- The configured local Supabase target is `127.0.0.1:44321`; local signup settings reported `disable_signup: false` and `mailer_autoconfirm: true`.
- PR177 Vercel preview remained blocked before app code with HTTP 401 on both `/` and `/api/health`.

Current-run browser evidence:

| Flow                                                          | Status                        | Evidence                                                                                                                                                                                                                                           |
| ------------------------------------------------------------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Guest shell                                                   | Pass                          | Clean Chrome profile loaded `/`; `#guest-menu-trigger` was present, `#user-menu-trigger` was absent, and `[data-testid="full-chat"]` was present.                                                                                                  |
| Guest chat                                                    | Pass                          | Submitted `Say hello in one short sentence for Phase 2 QA.`; `/api/chat` returned `200 text/event-stream`; rendered answer: `Hello, I am ready for Phase 2 QA.`                                                                                    |
| Authenticated shell                                           | Blocked                       | The normal Chrome profile could be opened, but JavaScript inspection through Apple Events is disabled and Computer Use permissions remained pending. Creating a new temporary local QA account requires explicit user confirmation at action time. |
| Authenticated search mode                                     | Blocked                       | Not replayed in current pass because authenticated shell access is blocked. Prior recorded evidence in this file remains from the earlier remediation QA pass.                                                                                     |
| Authenticated research mode                                   | Blocked                       | Not replayed in current pass because authenticated shell access is blocked. Prior recorded evidence in this file remains from the earlier remediation QA pass.                                                                                     |
| Live `competitorResearch` browser replay                      | Blocked                       | Not replayed in current pass because authenticated research-mode access is blocked. Code/test coverage and prior recorded local QA evidence remain valid, but this was not freshly replayed in Chrome today.                                       |
| Build/canvas create/read/update browser replay                | Blocked                       | Not replayed in current pass because the final required replay target was authenticated Chrome. Code/test coverage and prior recorded local QA evidence remain valid, but this was not freshly replayed in Chrome today.                           |
| Option-list, question-wizard, image-generation browser replay | Carried forward, not replayed | These remain covered by the earlier local manual QA record above and focused tests where applicable; they were not replayed in the current pass.                                                                                                   |

Blocked access details:

- Browser plugin/in-app browser attempts to navigate to `http://localhost:43100` and `http://127.0.0.1:43100` timed out before producing page evidence.
- Default Chrome AppleScript inspection failed because Chrome has `Allow JavaScript from Apple Events` disabled.
- Computer Use remained unavailable because macOS Accessibility/Screen Recording permissions were still pending.
- Creating a new local Supabase QA account was not performed because account creation requires explicit user confirmation at action time.

Final current-run judgment: **Phase 2 is not yet fully verified in this pass; the remaining blocker is authenticated Chrome replay access.** If the user confirms temporary local QA account creation or grants Computer Use/browser inspection access, rerun authenticated shell, search, research, competitorResearch, build/canvas read-update, and the optional interactive/image flows. If those pass, update this section to: **"Phase 2 is fully verified and complete pending user-directed PR readiness/merge workflow."**

## Authenticated Chrome Replay - 2026-04-26 Local / 2026-04-27 UTC

Status: **Phase 2 not complete; fix `readCanvasArtifact` persistence first.**

This pass supersedes the access-blocked attempt above. Authenticated local Chrome access was established with a temporary local Supabase account against `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321`; credentials were intentionally not recorded. No PR was merged and no draft/ready state was changed.

### Stacked PR State

- PR171: open draft, base `main`, head `codex/ai-sdk-contract-phase-1`, head SHA `ec99402938e47baefb739a5e91022505a6e1a6dc`, `mergeStateStatus: CLEAN`.
- PR173: open draft, base `codex/ai-sdk-contract-phase-1`, head `codex/ai-sdk-contract-phase-2`, head SHA `2d1125672d1e4df14e90402a4bd053916aa0b9ee`, `mergeStateStatus: CLEAN`.
- PR177: open draft, base `codex/ai-sdk-contract-phase-2`, head `codex/restack-pr173-clean`, head SHA `c5d11e422c8e320fdf700dba53e1c1e2db6411a0`, `mergeStateStatus: CLEAN`.
- PR177 head matches the expected SHA `c5d11e422c8e320fdf700dba53e1c1e2db6411a0`.
- PR171 checks passed: `Build`, `Format Check`, `Lint`, `Test`, `Test (evals)`, `Type Check`, `Vercel`, `Vercel Preview Comments`, and `CodeRabbit`.
- PR173 checks passed: `Vercel`, `Vercel Preview Comments`, and `CodeRabbit`.
- PR177 checks passed: `Vercel`, `Vercel Preview Comments`, and `CodeRabbit`.

Commands:

```bash
git status --short --branch
gh pr view 171 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr view 173 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr view 177 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr checks 171
gh pr checks 173
gh pr checks 177
```

### Runtime Checks

Commands:

```bash
npx supabase start
bun --env-file=/Users/nick/Projects/vana-v2/.env.local run dev
curl -I http://localhost:43100
curl -I https://polymorph-git-codex-restack-pr173-clean-nick-bohmers-projects.vercel.app/
curl -I https://polymorph-git-codex-restack-pr173-clean-nick-bohmers-projects.vercel.app/api/health
curl -sS http://127.0.0.1:44321/auth/v1/settings | jq '{external_email_enabled,disable_signup,mailer_autoconfirm}'
```

Results:

- Local app target `http://localhost:43100` returned HTTP 200.
- PR177 Vercel preview returned HTTP 401 with Vercel SSO protection for both `/` and `/api/health`.
- Local Supabase auth settings returned `disable_signup: false` and `mailer_autoconfirm: true`.

### Automated Verification

Commands:

```bash
bun run test -- --run components/render-message.test.tsx components/tool-ui/registry.test.tsx components/tool-ui/tool-part-registry.test.tsx components/tool-ui/data-table/data-table.test.ts lib/tools/__tests__/canvas-tools.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/agents/chat/__tests__/specialists.test.ts lib/agents/prompts/search-mode-prompts.test.ts
bun run lint
bun run typecheck
```

Results:

- Focused tests passed: 8 files, 117 tests.
- `bun run lint` passed with no diagnostics.
- `bun run typecheck` passed with no diagnostics.

### Code Invariant Review

- Finding: `components/render-message.tsx` suppresses `readCanvasArtifact` output before preserving visible `not_found` or `output-error` fallback, so the visible-error preservation invariant is not fully covered.
- Finding: live authenticated canvas replay exposed a persistence gap in `lib/utils/message-mapping.ts`: `tool-readCanvasArtifact` is not mapped to `tool-dynamic` or filtered, so it falls through as an unknown `tool-*` part and violates the `parts.tool_fields_required` database constraint during message persistence.

### Chrome Manual QA

Chrome target: `http://localhost:43100`.

| Flow                                                       | Status       | Evidence                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated shell                                        | Pass         | Local Chrome showed `#user-menu-trigger` present, `#guest-menu-trigger` absent, and `[data-testid="full-chat"]` mounted.                                                                                                                                                                                                                                                                                                                                                                                                                      |
| Authenticated search mode                                  | Pass         | Chat `ieghoxtv83p18uco16urm1yl` streamed through `/api/chat` with `200 text/event-stream`, rendered search results and a sourced answer, then persisted after reload.                                                                                                                                                                                                                                                                                                                                                                         |
| Authenticated research mode                                | Pass         | Chat `f2wm62c98ir1hkput2fgbfo6` in Research mode streamed two search-result blocks, rendered the Research Activity panel and answer content, then persisted after reload.                                                                                                                                                                                                                                                                                                                                                                     |
| Explicit `competitorResearch`                              | Pass         | Chat `cwj4p5s20odz1g951z5n60pl` in Research mode rendered the dedicated `COMPETITOR RESEARCH` region for Vercel and Netlify, then completed with source links.                                                                                                                                                                                                                                                                                                                                                                                |
| Build mode create                                          | Pass         | Chat `hgxo7e9et7pm55ygig7r5yr1` in Build mode created `QA Status Dashboard`; the canvas artifact card rendered `Ready` and the workspace preview loaded.                                                                                                                                                                                                                                                                                                                                                                                      |
| Canvas read/update                                         | Fail         | The model did call `readCanvasArtifact` and `updateCanvasArtifact`; the live UI showed the original create card plus one update/final card, and no extra read-generated `Ready` card. However, the server logged `Unrecognized tool part type "tool-readCanvasArtifact"` followed by `tool_fields_required` constraint failure while saving the assistant message. After reload, the updated artifact preview still showed `Active Bugs` as `3` and `Reviewer sign-off`, but the update assistant message/card was not persisted in the chat. |
| Guest chat, option-list, question-wizard, image generation | Not replayed | Optional in this pass; prior local evidence remains carried forward above.                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

Residual risks:

- Brave search is over quota and repeatedly falls back to Tavily; the fallback path completed search/research/competitor flows but remains noisy in dev logs.
- The PR177 Vercel preview remains inaccessible without Deployment Protection/SSO access.
- The local QA account exists only in local Supabase and should not be treated as deployed auth evidence.

Final current-run judgment: **Phase 2 not complete; fix `readCanvasArtifact` persistence first.**

## Phase 2 Completion Verification - 2026-04-27

Status: **Phase 2 is fully verified and complete pending user-directed PR readiness/merge workflow.**

This pass was run from `/Users/nick/.codex/worktrees/restack-pr173/vana-v2` on `codex/restack-pr173-clean`. No PR was merged, no PR draft/ready state was changed, and the remote PR heads were left unchanged. The local working tree contains the Phase 2 fix and verification doc updates.

### Stacked PR State

- PR171: open draft, base `main`, head `codex/ai-sdk-contract-phase-1`, head SHA `ec99402938e47baefb739a5e91022505a6e1a6dc`, `mergeStateStatus: CLEAN`.
- PR173: open draft, base `codex/ai-sdk-contract-phase-1`, head `codex/ai-sdk-contract-phase-2`, head SHA `2d1125672d1e4df14e90402a4bd053916aa0b9ee`, `mergeStateStatus: CLEAN`.
- PR177: open draft, base `codex/ai-sdk-contract-phase-2`, head `codex/restack-pr173-clean`, remote head SHA `c5d11e422c8e320fdf700dba53e1c1e2db6411a0`, `mergeStateStatus: CLEAN`.
- Local `git log -1 --oneline`: `c5d11e4 fix: remediate pr 173 manual qa blockers`.

Commands:

```bash
git status --short --branch
git log -1 --oneline
gh pr view 171 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr view 173 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr view 177 --json number,title,state,isDraft,baseRefName,headRefName,headRefOid,mergeStateStatus,url
gh pr checks 171
gh pr checks 173
gh pr checks 177
```

Check status:

- PR171: `Build`, `Format Check`, `Lint`, `Test`, `Test (evals)`, `Type Check`, `Vercel`, `Vercel Preview Comments`, and `CodeRabbit` passed.
- PR173: `Vercel`, `Vercel Preview Comments`, and `CodeRabbit` passed.
- PR177: `Vercel`, `Vercel Preview Comments`, and `CodeRabbit` passed.
- No failing or pending checks were reported.

### Code Fixes

- `lib/utils/message-mapping.ts`: `tool-readCanvasArtifact` now persists through `tool-dynamic` with `tool_toolCallId`, `tool_state`, dynamic name/type, input, output, provider metadata, and full `files` output intact. DB-to-UI restore now reconstructs it as `tool-readCanvasArtifact`.
- `components/render-message.tsx`: successful `readCanvasArtifact` context reads are hidden to avoid duplicate canvas cards, while `not_found` and `output-error` read outputs remain visible through the dynamic-tool fallback.
- Regression tests were added for read-tool persistence, DB round trip, hidden successful read cards, visible `not_found`, and visible `output-error` for both named and dynamic read parts.

### Automated Verification

Commands:

```bash
bun run test -- --run components/render-message.test.tsx lib/utils/__tests__/message-mapping-display-tools.test.ts
bun run test -- --run components/render-message.test.tsx components/tool-ui/registry.test.tsx components/tool-ui/tool-part-registry.test.tsx components/tool-ui/data-table/data-table.test.ts lib/tools/__tests__/canvas-tools.test.ts lib/tools/__tests__/search-provider-routing.test.ts lib/agents/chat/__tests__/specialists.test.ts lib/agents/prompts/search-mode-prompts.test.ts lib/utils/__tests__/message-mapping-display-tools.test.ts
bun run lint
bun run typecheck
```

Results:

- Focused regression tests passed: 2 files, 76 tests.
- Required focused suite passed: 9 files, 171 tests.
- `bun run lint` passed with no diagnostics.
- `bun run typecheck` passed with no diagnostics.

### Runtime Checks

Commands:

```bash
bun --env-file=/Users/nick/Projects/vana-v2/.env.local run dev
curl -I http://localhost:43100
curl -I https://polymorph-git-codex-restack-pr173-clean-nick-bohmers-projects.vercel.app/
curl -I https://polymorph-git-codex-restack-pr173-clean-nick-bohmers-projects.vercel.app/api/health
curl -sS http://127.0.0.1:44321/auth/v1/settings | jq '{external_email_enabled,disable_signup,mailer_autoconfirm}'
```

Results:

- Local Chrome target: `http://localhost:43100`.
- Local app returned HTTP 200.
- PR177 Vercel preview returned HTTP 401 with Vercel SSO protection for both `/` and `/api/health`.
- Local Supabase auth settings returned `disable_signup: false` and `mailer_autoconfirm: true`.
- Browser connector used the existing local QA session; no credentials were printed.

### Authenticated Chrome QA

| Flow                          | Status | Evidence                                                                                                                                                                                                                                                                                                                      |
| ----------------------------- | ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authenticated shell           | Pass   | Local Chrome at `/` reported `#user-menu-trigger: true`, `#guest-menu-trigger: false`, and `[data-testid="full-chat"]: true`.                                                                                                                                                                                                 |
| Authenticated search mode     | Pass   | Chat `b7s8oy953kosvpsyesmqc0ld` streamed `/api/chat` with HTTP 200, rendered 24 search results and an answer linking to `https://nextjs.org/`, then persisted after reload.                                                                                                                                                   |
| Authenticated research mode   | Pass   | Chat `jsnq74tehyz4c07h7gyyhpxt` streamed `/api/chat` with HTTP 200, rendered `Research Plan - 3/3 complete`, 24 search results, sourced answer links, and the Research Activity panel, then persisted after reload.                                                                                                           |
| Explicit `competitorResearch` | Pass   | Chat `s6tqp3pq5xwoc3cmzd1mdab1` rendered the dedicated `Competitor research result` region with `COMPETITOR RESEARCH` for Vercel and Netlify.                                                                                                                                                                                 |
| Build create                  | Pass   | Chat `brq2q1gvm729o3xfg9ed1my0` created `QA Status Dashboard`; the canvas artifact card rendered `Ready` and the preview showed Passed Checks `6`, Active Bugs `0`, Coverage `92%`, and Review Status `Ready`.                                                                                                                |
| Canvas read/update            | Pass   | Same chat called `readCanvasArtifact` and `updateCanvasArtifact`, rendered the original create card plus one update/final card, and did not render an extra read-generated Ready card. After reload, the updated assistant message/card persisted and the preview showed Active Bugs `1` and Review Status `Needs Follow-up`. |

Server-log evidence for the fixed read/update path:

```text
[readCanvasArtifact] Tool invoked: chatId=brq2q1gvm729o3xfg9ed1my0, artifactId=no2fur0g4dz5mgcefhp81041
[updateCanvasArtifact] Tool invoked: chatId=brq2q1gvm729o3xfg9ed1my0, artifactId=no2fur0g4dz5mgcefhp81041, baseRevision=2, files=[App.tsx]
[updateCanvasArtifact] Success: chatId=brq2q1gvm729o3xfg9ed1my0, artifactId=no2fur0g4dz5mgcefhp81041, status=ready
POST /api/chat 200
GET /api/canvas-artifacts/no2fur0g4dz5mgcefhp81041 200
```

The post-fix read/update run did not log `Unrecognized tool part type "tool-readCanvasArtifact"` and did not log `tool_fields_required`.

Residual risks:

- Brave search remains over quota and falls back to Tavily in local QA logs; the fallback completed search, research, and competitor flows.
- The PR177 Vercel preview remains inaccessible without Deployment Protection/SSO access.
- Optional guest chat, option-list, question-wizard, and image-generation flows were not replayed in this final pass. One abandoned competitorResearch attempt surfaced an interactive depth-question continuation guard, but the required explicit competitorResearch flow passed after specifying depth upfront.

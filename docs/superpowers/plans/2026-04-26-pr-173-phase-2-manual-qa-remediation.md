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

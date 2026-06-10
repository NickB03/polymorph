# PR 209 Agent Handoff

Last updated: 2026-05-07

## Current Status

PR: https://github.com/NickB03/polymorph/pull/209

Title: `[codex] Add manifest-driven Tool UI runtime`

Branch: `codex/tool-ui-manifest-runtime`

Base: `main` at `3ce4a5b67d5577dab6d8026b1e41765593fe06a2`

Head: use `gh pr view 209 --repo NickB03/polymorph --json headRefOid`.
This handoff was synced from `5ce40069bf6dd29803acf5e616312e0057081fe9`
before the local `displayOptionList` Clear-action follow-up.

State: open draft PR. GitHub reports `mergeStateStatus: CLEAN`.

Latest checks before the Clear-action follow-up were green:

- Build
- Format Check
- Lint
- Test
- Test (evals)
- Type Check
- Vercel
- Vercel Preview Comments

CodeRabbit skipped review because the PR is still draft.

## Worktrees

Use this worktree for further PR 209 changes:

```bash
cd /Users/nick/.codex/worktrees/6220/vana-v2
```

That worktree owns branch `codex/tool-ui-manifest-runtime` and was clean at the time of this handoff.

The current handoff was prepared from:

```bash
/Users/nick/.codex/worktrees/de1c/vana-v2
```

That checkout is detached at the same PR head. It is fine for review, but use the branch-owning `6220` worktree for additional edits.

Do not use the main checkout for this PR:

```bash
/Users/nick/Projects/vana-v2
```

That checkout is `main`, not the PR branch.

Useful startup commands for the next agent:

```bash
cd /Users/nick/.codex/worktrees/6220/vana-v2
git status --short --branch
git log --oneline -5
gh pr view 209 --repo NickB03/polymorph --json number,title,url,isDraft,headRefName,headRefOid,baseRefName,mergeStateStatus
gh pr checks 209 --repo NickB03/polymorph
```

## Recent Commit Stack

```text
5ce4006 docs: add pr 209 agent handoff
ec0817a fix: validate interactive tool selections
77bf7b8 feat: add manifest-driven tool ui runtime
4c2f2b docs: add multi-agent verification loop
ac6a103 docs: add tool ui manifest execution plans
```

## What This PR Does

PR 209 adds a manifest-driven Tool UI runtime while preserving Polymorph's bespoke AI SDK v6 chat runtime.

The main implementation surfaces are:

- `lib/tools/tool-ui/metadata.ts`
- `lib/tools/tool-ui/server-catalog.ts`
- `lib/tools/tool-ui/server.ts`
- `lib/tools/tool-ui/client-output-validation.ts`
- `components/tool-ui/renderer-catalog.tsx`
- `components/tool-ui/interactive-renderer-catalog.tsx`
- `components/tool-ui/registry.tsx`
- `components/tool-ui/tool-part-registry.tsx`
- `lib/agents/chat/toolset.ts`
- `lib/agents/chat/factory.ts`
- `lib/agents/chat/search.ts`
- `lib/agents/chat/research.ts`
- `lib/agents/chat/build.ts`

The proof component/tool added by this PR is `displayAgentArtifact`:

- `components/tool-ui/agent-artifact/*`
- `lib/tools/display-agent-artifact/*`

The latest review fix on `ec0817a` validates client-resolved interactive tool outputs against the original tool input before persistence. This blocks invalid option ids, missing wizard steps, duplicate ids, and min/max selection violations from being persisted by `prepareToolResultMessages`.

The Clear-action follow-up keeps `displayOptionList` Clear local in the client
adapter and submits only Confirm as a tool-result continuation.

## Key Documents

Read these first:

- `AGENTS.md` / `CLAUDE.md` for repository rules and non-obvious invariants.
- `docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime.md` for the main implementation plan and task history.
- `docs/superpowers/plans/2026-05-06-tool-ui-manifest-runtime-codex-multi-agent.md` for orchestration and verification evidence.
- `components/tool-ui/agent-artifact/README.md` for the Agent Artifact port notes.
- `components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md` for the retained non-commercial upstream notice.
- `docs/architecture/GENERATIVE-UI.md` for the updated Tool UI architecture docs.
- `docs/architecture/RESEARCH-AGENT.md` for agent/tool-loop context.
- `docs/reference/FILE-INDEX.md` for current file locations.

## Verification Already Run

Local verification after the Clear-action follow-up:

```bash
bun run test -- lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts components/chat-request.test.ts components/tool-ui/tool-part-registry.test.tsx
bun typecheck
bun lint
```

Focused local result: 28 tests passed. `bun typecheck` and `bun lint` exited cleanly.

Previous GitHub verification on PR 209 code head `ec0817a`:

- Build passed
- Format Check passed
- Lint passed
- Test passed
- Test (evals) passed
- Type Check passed
- Vercel deployment passed

## Known Review Status

One review finding was confirmed and fixed:

- `lib/tools/tool-ui/client-output-validation.ts` now does input-aware validation for `displayOptionList` and `displayQuestionWizard`.
- `lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts` includes regression tests for invalid option ids, missing required wizard steps, and min/max violations before persistence.
- `lib/tools/display-option-list/client.tsx` now submits only `confirm` actions to `addToolResult`; `components/tool-ui/tool-part-registry.test.tsx` covers Clear staying local instead of persisting an empty result.

No other confirmed findings are open in this handoff.

## Residual Risks

- The PR is large: 55 files changed. Keep any further fixes narrow.
- The PR remains draft. Do not mark ready or merge unless the user explicitly asks.
- CodeRabbit skipped because draft. If automated review is desired, either request a review explicitly or move the PR out of draft when approved.
- `displayAgentArtifact` is an adapted non-commercial upstream port. The local README states the project owner clarified Polymorph is personal/non-commercial; revisit licensing before commercial use.
- Server validation rejects malformed or incomplete interactive continuations. The required `displayOptionList` Clear-action path stays local and no longer submits an empty result.

## Next Steps

1. Start in `/Users/nick/.codex/worktrees/6220/vana-v2`.
2. Re-check `git status --short --branch` and `gh pr checks 209 --repo NickB03/polymorph`.
3. Review any new PR comments or check failures against source before acting.
4. If the user asks for another review, audit the exact PR head from GitHub, not local `main`.
5. If more fixes are needed, keep scope to PR 209 Tool UI runtime surfaces and rerun:

```bash
bun run test -- lib/streaming/helpers/__tests__/prepare-tool-result-messages.test.ts components/chat-request.test.ts components/tool-ui/tool-part-registry.test.tsx
bun typecheck
bun lint
```

6. If the user asks to finalize, confirm PR checks are still green, then move out of draft with `gh pr ready 209 --repo NickB03/polymorph`. Only merge after explicit user approval.

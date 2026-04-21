# CLAUDE.md

Guidance for Claude Code when working in this repository. Keep this file short: it loads on every session. Anything that can be discovered by reading the code or a leaf doc belongs in that leaf doc, not here.

## Project Overview

Polymorph is an AI platform with a generative UI for research, creation, and exploration. Stack: Next.js 16 (App Router), React 19, TypeScript (strict), Bun, Tailwind v4, shadcn/ui.

## Commands

- `bun dev` — dev server on port 43100
- `bun run build` — production build
- `bun lint` / `bun typecheck` — must pass before claiming done
- `bun format` / `bun format:check` — Prettier
- `bun run test` — Vitest (single run); `bun run test -- path/to/file.test.ts` for one file; `bun run test:watch` for watch mode
- `bun run migrate` — Drizzle migrations
- `bun run chat` — CLI chat interface (`scripts/chat-cli.ts`)
- `npx supabase start` — local Supabase (DB 44322, API 44321, Studio 44323)

## Code conventions

- **Path alias:** `@/*` maps to project root. Use `@/lib/...`, `@/components/...`, etc.
- **Prettier:** no semicolons, single quotes, no trailing commas, 2-space indent, avoid arrow parens, LF line endings.
- **Import order (ESLint `simple-import-sort`):** `react`/`next` → third-party → `@/types` → `@/config` → `@/lib` → `@/hooks` → `@/components/ui` → `@/components` → `@/registry` → `@/styles` → `@/app` → side effects → parents → relatives → styles.

## Non-obvious invariants

These are load-bearing and not derivable by reading any single file:

- **Row-Level Security.** Every user-scoped table in `lib/db/schema.ts` uses RLS keyed on `current_setting('app.current_user_id')`. Server code must set that GUC before querying or rows are invisible.
- **Tool UI is bespoke in this repo.** Do not default to `assistant-ui`, `Toolkit`, `tool-agent`, or stock `shadcn add` flows when adding a Tool UI component. Match the local pattern across `components/tool-ui/*`, `components/render-message.tsx`, `components/chat.tsx`, `components/chat-request.ts`, `lib/types/dynamic-tools.ts`, `lib/streaming/helpers/prepare-tool-result-messages.ts`, and `lib/agents/researcher.ts`. Only propose an assistant-ui runtime migration if the user explicitly asks for it.
- **Canvas is one-artifact-per-chat.** `createCanvasArtifact` / `updateCanvasArtifact` / `readCanvasArtifact` are conditionally registered only when a canvas context is present. Compiled HTML lives in the DB and is served via `iframe.srcdoc`.
- **Guest canvas tokens** are HMAC-SHA256 signed with `GUEST_CANVAS_SECRET` and rotate on every successful write.
- **Phoenix tracing enforces HTTPS in production.** `instrumentation.ts` silently disables tracing if the collector endpoint is plain HTTP when any of `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `RAILWAY_ENVIRONMENT=production`, or `NODE_ENV=production` is set.
- **Privileged DB client bypasses RLS.** `lib/db/admin.ts` is the only path that may set/upsert rows on user-scoped tables without a session GUC. Used by the Vercel cron at `/api/suggestions/refresh` to write the singleton `trending_suggestions_cache`.
- **Railway cron triggers:** `railway redeploy -s polymorph-evals` from the CLI rebuilds the image but does **not** run the container CMD. Use the Railway dashboard redeploy button for an immediate one-off run.

## Skill invocation policy

Users should not need to say the word "skill." Infer intent from normal requests and invoke project-scoped skills automatically:

- **Bug, test failure, unexpected behavior** → `systematic-debugging`
- **Multi-step feature, refactor, migration** → `writing-plans` (before implementation)
- **Before claiming done / opening PR** → `verification-before-completion`
- **Preparing for review** → `requesting-code-review`
- **Applying review feedback** → `receiving-code-review`
- **UI behavior changes / interaction regressions** → `webapp-testing`
- **Canvas artifact issues** (preview iframe, compile pipeline, diagnostics) → `harden`
- **Supabase/Postgres schema/query/perf changes** → `supabase-postgres-best-practices`
- **Next.js App Router architecture decisions** → `nextjs-app-router-patterns`
- **New page, major UI section, complex layout** → Pencil wireframe workflow (`.claude/rules/design-workflow.md`), then `frontend-design`
- **Any creative/visual work** → `brainstorming` (before wireframing or implementation)

**Precedence:** process/quality skills first (debugging/planning/verification/review), then domain skills (Next.js, Supabase, testing). When multiple apply, order:
`systematic-debugging` → `writing-plans` → domain skill(s) → `verification-before-completion` → review skill(s).

For ambiguous tasks, begin with: _"Select and invoke any relevant skills before answering, then proceed."_

## Quality standards

- **Make the change, don't describe it.** When you identify a fix, implement it directly — don't explain what to do and wait for permission. The user can always revert.
- **Fix every warning and error you encounter.** Never dismiss issues as "pre-existing," "unrelated," or "from a previous session." If you see it, you own it.
- **Always run `bun lint` and `bun typecheck` before claiming done.** Fix every warning, not just the ones your changes introduced.

## Behavioral guardrails

- **Surface ambiguity before coding.** If a request has multiple plausible interpretations, state the ambiguity explicitly and ask only the minimum clarifying question needed. Do not pick silently when scope, UX, or data semantics are unclear.
- **Prefer the simplest implementation that satisfies the request.** Do not add speculative abstractions, configurability, or future-proofing unless the requirement is explicit or already established in nearby code.
- **Keep diffs surgical.** Every changed line should trace back to the user's request or to cleanup made necessary by your own change. Do not perform drive-by refactors or style edits.
- **Push back on unnecessary complexity.** If a simpler approach is sufficient, say so briefly and implement the simpler version unless the user asks otherwise.

## Investigation & verification standards

A hypothesis is not a conclusion. Before declaring a root cause found or a fix correct:

- **Read the actual code.** A root cause claim must cite a specific `file:line`. Don't reason about what a file "probably" contains — open it.
- **Trace the full path.** For bugs, follow execution from symptom → call site → implementation. Don't stop at the first plausible explanation.
- **Verify, then fix.** Confirm the problem exists where you think it does before writing a fix. Write a failing test or a log statement that proves the bug if you can.
- **State your evidence.** When reporting a root cause, include `file:line`, the actual value, or the error message. "This is likely because…" is a hypothesis — label it as one and then verify.
- **Don't trust your own prior analysis.** Re-check before acting on earlier session conclusions; state may have changed.
- **External review claims are hypotheses, not facts.** Comments from CodeRabbit (or any PR-review bot) and recommendations from peer-review subagents are unverified opinions written from limited context. Before relaying or acting on one: open the cited code, confirm the claim still applies to the current state, and judge whether the recommendation is correct _for this codebase_. Many automated comments are stale, irrelevant, or wrong — surfacing them uncritically wastes the user's time and degrades the codebase. Same bar as your own analysis: cite `file:line` and the evidence, or label it a hypothesis.

The bar: _could you point a skeptical reviewer to the exact evidence?_ If not, keep investigating.

## Deeper references (load on demand)

Claude should `Read` these only when the current task needs them.

| Topic                                      | File                                           |
| ------------------------------------------ | ---------------------------------------------- |
| Architecture overview                      | `docs/architecture/OVERVIEW.md`                |
| Researcher agent / tool loop               | `docs/architecture/RESEARCH-AGENT.md`          |
| Streaming & SSE                            | `docs/architecture/STREAMING.md`               |
| Generative UI message parts                | `docs/architecture/GENERATIVE-UI.md`           |
| Model configuration                        | `docs/architecture/MODEL-CONFIGURATION.md`     |
| Search providers                           | `docs/architecture/SEARCH-PROVIDERS.md`        |
| Architecture decisions                     | `docs/architecture/DECISIONS.md`               |
| Required config & env variables            | `docs/getting-started/CONFIGURATION.md`        |
| Environment variables                      | `docs/getting-started/ENVIRONMENT.md`          |
| Quickstart                                 | `docs/getting-started/QUICKSTART.md`           |
| Deployment + Phoenix persistence procedure | `docs/operations/DEPLOYMENT.md`                |
| Troubleshooting (setup & deploy failures)  | `docs/operations/TROUBLESHOOTING.md`           |
| Docker / self-host                         | `docs/operations/DOCKER.md`                    |
| Day-2 operations runbook                   | `docs/operations/runbooks/day-2-operations.md` |
| File index (where things live)             | `docs/reference/FILE-INDEX.md`                 |
| API reference                              | `docs/reference/API.md`                        |
| ESLint conventions                         | `docs/reference/ESLINT-CONVENTIONS.md`         |
| Railway + Phoenix CLI cheat sheet          | `.claude/rules/operations.md`                  |
| Design / wireframing workflow              | `.claude/rules/design-workflow.md`             |

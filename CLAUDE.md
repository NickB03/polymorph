# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Polymorph is an AI platform with a generative UI for research, creation, and exploration. Research is its first capability, with code generation, image creation, and multimodal features expanding the platform.

**Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Bun, Tailwind CSS v4, shadcn/ui

## Commands

- `bun dev` — dev server on port 43100
- `bun run build` — production build
- `bun lint` — ESLint
- `bun typecheck` — TypeScript checking
- `bun format` — Prettier format
- `bun format:check` — Prettier check
- `bun run test` — Vitest (single run)
- `bun run test -- path/to/file.test.ts` — run a single test file
- `bun run test:watch` — Vitest watch mode
- `bun run migrate` — run Drizzle migrations
- `bun run chat` — CLI chat interface (`scripts/chat-cli.ts`)
- `npx supabase start` — local Supabase (DB:44322, API:44321, Studio:44323)
- `railway status` — show linked Railway project context
- `railway logs -s <service>` — stream Railway service logs (phoenix, polymorph-evals)
- `npx @arizeai/phoenix-cli trace list` — list recent Phoenix traces

## Architecture

### AI Agent Pipeline

The core flow is: `app/api/chat/route.ts` → `lib/agents/researcher.ts` → tools → streaming response.

- **Researcher agent** (`lib/agents/researcher.ts`): Uses Vercel AI SDK's `ToolLoopAgent` with two modes:
  - **Chat mode**: max 20 steps, forced optimized search, tools: `[search, fetch, displayPlan, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayQuestionWizard, displayCallout, displayTimeline]` + canvas artifact tools
  - **Research mode**: max 50 steps, full search, tools: `[search, fetch, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayQuestionWizard, displayCallout, displayTimeline, todoWrite]` + canvas artifact tools
- **Tools** (`lib/tools/`): `search` (Brave primary, Tavily fallback, plus Exa, SearXNG, Firecrawl), `fetch` (web content extraction), `todo` (task management), `dynamic` (MCP/runtime-defined tools)
- **Model selection** (`lib/utils/model-selection.ts`): Resolves model by search mode + model type (speed/quality). Default: Gemini 3 Flash (speed), Grok 4.1 Fast Reasoning (quality), both via Vercel AI Gateway
- **Provider registry** (`lib/utils/registry.ts`): Wraps multiple AI providers (gateway, openai, anthropic, google, openai-compatible, ollama) via `createProviderRegistry`

### Database (Drizzle + Supabase PostgreSQL)

Schema in `lib/db/schema.ts` with core tables:

- **chats** → **messages** → **parts** (cascade delete)
- **canvasArtifacts** → **canvasArtifactVersions** (cascade delete)
- **feedback** — user feedback storage
- **artifacts** → **artifactRevisions**, **artifactRuntimeSessions** — SPA artifact system (still active, separate from canvas)
- `parts` is a wide table storing all message part types (text, reasoning, files, sources, tool calls) with check constraints per type
- All tables use Row-Level Security (RLS) via `current_setting('app.current_user_id')` — users see only their own data, public chats are readable by all
- Server actions in `lib/actions/chat.ts` use `unstable_cache` with revalidation tags

### Streaming

- `lib/streaming/create-chat-stream-response.ts` — authenticated chat streaming
- `lib/streaming/create-ephemeral-chat-stream-response.ts` — anonymous/guest streaming
- `lib/streaming/helpers/` — message preparation, persistence, related questions, canvas data writing
- Responses are SSE with message parts streamed incrementally

### Rate Limiting

`lib/rate-limit/` — per-chat, per-canvas, and guest IP-based rate limits. Uses Upstash Redis with in-memory fallback.

### Auth

Supabase Auth with three client patterns:

- `lib/supabase/client.ts` — browser client
- `lib/supabase/server.ts` — server-side client (cookies-based)
- `lib/supabase/middleware.ts` — session refresh in middleware
- **Guest mode** (default): `ENABLE_GUEST_CHAT=true` lets unauthenticated users search immediately. Guest chats are ephemeral (not persisted), use speed-mode models only, and are rate-limited per IP via Upstash Redis. A gentle inline nudge encourages sign-up after the 5th search.

### Canvas Artifacts

Canvas is the active artifact model. It is always-on (no feature flag gating).

- **Compile pipeline** (`lib/canvas/compiler/`): Server-side esbuild + Tailwind CSS v4 compiles React SPA source into a single self-contained HTML string. The compiled HTML is persisted in the database and served via `iframe.srcdoc` for preview and export.
- **One-artifact-per-chat rule:** Each chat maps to at most one canvas artifact. The `createCanvasArtifact` tool creates it; `updateCanvasArtifact` mutates it. Both are always available in the researcher tool set.
- **Canvas service** (`lib/canvas/service.ts`): CRUD operations with optimistic concurrency (revision counter). Draft updates, version saves, restores, exports, and runtime diagnostics all go through this service layer.
- **Guest access** (`lib/canvas/guest-token.ts`): HMAC-SHA256 signed tokens grant guest users scoped access to a specific artifact. Tokens rotate on every successful write.
- **Legacy notice** (`components/canvas/canvas-legacy-notice.tsx`): Old artifact references from the removed sandbox system fail closed into a static "artifact unavailable" notice.
- **Canvas API routes** (`app/api/canvas-artifacts/[artifactId]/`):
  - `GET /` — Load artifact state
  - `PATCH /draft` — Update draft source (optimistic concurrency)
  - `POST /versions` — Create immutable version snapshot
  - `POST /restore` — Restore a previous version
  - `GET /export` — Download compiled HTML as a file
  - `POST /runtime-diagnostics` — Persist iframe runtime errors
  - `GET /view` — Serve compiled HTML for embedding
- **Pre-processors** (`lib/canvas/pre-processors/`): AST transforms that fix AI-generated code before compilation
- **Source validation** (`lib/canvas/validation/`): Validates and normalizes canvas source before compilation
- **Canvas workspace UI** (`components/canvas/`): Split-view workspace with live preview, CodeMirror editor, diagnostics panel, and version history

### Observability (Arize Phoenix on Railway)

OpenTelemetry traces export to a self-hosted Phoenix instance on Railway, gated by `ENABLE_TRACING=true`.

- **Instrumentation** (`instrumentation.ts`): Registers OTel with Phoenix OTLP exporter. Enforces HTTPS in production via `isProductionTarget()`.
- **Production detection** (`lib/config/env.ts`): `isProductionTarget()` checks `VERCEL_ENV`, `VERCEL_TARGET_ENV`, `RAILWAY_ENVIRONMENT`, or `NODE_ENV=production`. Used by instrumentation and env validation.
- **Trace flushing** (`lib/utils/telemetry.ts`): `flushTraces()` forces pending spans to export before serverless shutdown. Call in `onFinish` callbacks of streaming routes.
- **Architecture:** `Vercel (app) --OTLP/HTTPS--> Railway (phoenix) <--API-- Railway (evals cron)`

### Evals Service (`services/evals/`)

Offline LLM-judge evaluation pipeline running as a Railway cron service (every 6 hours). Deployed alongside `phoenix` on Railway. See `docs/operations/DEPLOYMENT.md` for configuration details.

- Samples recent chats from Supabase Postgres (parameterized SQL)
- Runs 6 evaluators: 2 deterministic (`prechecks`, `tool-usage`) + 4 LLM-judge (`faithfulness`, `relevance`, `response-quality`, `safety`) via `asExperimentEvaluator` shells
- Pushes results to Phoenix as experiments
- Key files: `sampler.ts`, `prechecks.ts`, `evaluators/faithfulness.ts`, `evaluators/relevance.ts`, `evaluators/response-quality.ts`, `evaluators/safety.ts`, `evaluators/tool-usage.ts`, `config.ts`

### Voice

Feature-gated behind `NEXT_PUBLIC_ENABLE_VOICE=true`.

- **TTS providers** (`lib/voice/`): ElevenLabs (default), OpenAI, browser Web Speech API — configurable per-user
- **API route** (`app/api/voice/synthesize/`): server-side TTS synthesis

### Generative UI

Components render different message part types: `answer-section.tsx`, `search-section.tsx`, `reasoning-section.tsx`, `artifact/` directory for rich artifacts. These map to part types from the `parts` database table.

### Hooks

Custom React hooks in `hooks/`: `use-activity-feed`, `use-auth-check`, `use-content-entrance`, `use-current-user`, `use-file-dropzone`, `use-mobile`, `use-trending-suggestions`, plus voice hooks (`use-audio-stream`, `use-voice-conversation`, `use-voice-input`, `use-voice-player`). Additional hooks in `lib/hooks/`: `use-copy-to-clipboard`, `use-media-query`.

Supporting modules: `lib/analytics/` (event tracking), `lib/config/` (env validation, model loading), `lib/schema/` (tool input schemas), `lib/auth/` (current user resolution).

## Design Workflow (Pencil Wireframes)

Polymorph uses Pencil (`.pen` files) for wireframing UI before implementation. The primary wireframe file is `polymorph.pen` at the project root.

### When to wireframe first

- **New pages or major UI sections** — always wireframe before writing code
- **Complex layouts** (multi-panel views, dashboards, dense information displays) — wireframe to resolve layout decisions cheaply
- **Significant redesigns** of existing screens — wireframe the target state

### When to skip wireframes

- Small tweaks, bug fixes, or adjustments to existing UI
- Non-visual work (API routes, data logic, tooling)
- Component-level changes where the layout is already established

### Workflow

1. **Open the wireframe:** Use `get_editor_state()` to check if a `.pen` file is active, or `open_document()` to open `polymorph.pen`
2. **Pull design context:** Use `get_guidelines(topic)` for layout patterns and `get_style_guide()` for visual direction. The project's design system lives in `.impeccable.md`
3. **Read the wireframe:** Use `batch_get()` and `snapshot_layout()` to understand the layout structure. Use `get_screenshot()` to see the visual result
4. **Implement from the wireframe:** Translate the wireframe layout, spacing, hierarchy, and component choices into React code. The wireframe is the spec — match it
5. **Validate visually:** After implementation, compare the browser output against the wireframe. Use `webapp-testing` for screenshot verification when precision matters

### Wireframe maintenance

Wireframes are **planning tools, not documentation**. Once code ships, the wireframe's job is done.

- **Don't back-port small changes.** If you remove a button, adjust spacing, or swap a component in code, the code is the updated design. Don't touch the wireframe.
- **Update the wireframe when redesigning.** Before a significant change to an existing screen, update the relevant frame to reflect the _new_ target state, then implement from it.
- **Wireframes naturally drift from the live app — that's fine.** They represent decisions already made. Only bring them current when actively using them to plan the next change.
- **Color, typography, and token changes don't go in wireframes.** That's `.impeccable.md` territory.

### Rules

- **Wireframe is the source of truth for layout — during implementation.** While building from a wireframe, don't improvise layout decisions it already specifies. If the wireframe is wrong, update it first, then update the code. After implementation, the code becomes the source of truth.
- **Design tokens come from `.impeccable.md`.** The wireframe defines _where_; the design system defines _how_.
- **The user has no design or development background.** Wireframes are their primary tool for communicating visual intent. Read them carefully and ask clarifying questions if the wireframe is ambiguous rather than guessing.

## Code Conventions

### Skill Invocation Policy (Claude Code)

To keep quality consistent, Claude Code should automatically invoke the following project-scoped skills based on task type:

**Important UX rule:** Users should not need to say the word "skill" or mention skill names. Infer intent from normal requests and invoke relevant skills automatically.

- **Bug, test failure, unexpected behavior** → `systematic-debugging`
- **Multi-step feature, refactor, migration** → `writing-plans` (before implementation)
- **Before claiming done / opening PR** → `verification-before-completion`
- **When preparing for review** → `requesting-code-review`
- **When applying review feedback** → `receiving-code-review`
- **UI behavior changes / interaction regressions** → `webapp-testing`
- **Canvas artifact issues** (preview iframe, compile pipeline, diagnostics) → `harden`
- **Supabase/Postgres schema/query/perf changes** → `supabase-postgres-best-practices`
- **Next.js App Router architecture decisions** → `nextjs-app-router-patterns`
- **New page, major UI section, or complex layout** → Pencil wireframe workflow (see "Design Workflow" section above), then `frontend-design`
- **Any creative/visual work** → `brainstorming` (before wireframing or implementation)

#### Precedence rules

1. Prefer **process/quality skills first** (debugging/planning/verification/review).
2. Then apply **domain skills** (Next.js, Supabase, testing) for implementation details.
3. If multiple skills could apply, invoke all relevant ones in this order:
   `systematic-debugging` → `writing-plans` → domain skill(s) → `verification-before-completion` → review skill(s).

#### Prompting hint for reliable auto-selection

When tasks are ambiguous, begin with:
"Select and invoke any relevant skills before answering, then proceed."

### Quality Standards

- **Make the change, don't describe it.** When you identify a fix or improvement, implement it directly using the available tools. Never explain what needs to change and wait for permission — read the file, propose the edit, and apply it in one pass. The user can always revert.
- **Fix every warning and error you encounter.** Never dismiss issues as "pre-existing," "unrelated to our changes," or "from a previous session." If you see it, you own it. Either fix it immediately or explicitly flag it to the user as something that needs attention — do not silently pass over it.
- Before claiming any task is complete, run `bun lint` and `bun typecheck`. If either produces warnings or errors, fix them — all of them, not just the ones your changes introduced.

### Investigation & Verification Standards

**A hypothesis is not a conclusion.** Before declaring a root cause found or a fix correct:

- **Read the actual code.** Don't reason about what a file probably contains — open it. A root cause claim must cite a specific file and line number.
- **Trace the full path.** For bugs: follow the execution path from symptom → call site → implementation. Don't stop at the first plausible explanation.
- **Verify, then fix.** Confirm the problem exists where you think it does before writing a fix. If you can write a failing test or log statement that proves the bug, do it.
- **State your evidence.** When reporting a root cause, include the specific evidence (file:line, actual value, error message). "This is likely because..." is a hypothesis — say so explicitly, then go verify it.
- **Don't trust your own prior analysis.** If you identified a probable cause in a previous step, re-check it before acting on it. Codebase state may have changed, or the initial read may have been incomplete.

This applies to all debugging, architecture questions, and any claim that something "should work" or "is broken." The bar is: **could you point a skeptical reviewer to the exact evidence?** If not, keep investigating.

### Formatting (Prettier)

No semicolons, single quotes, no trailing commas, 2-space indent, avoid arrow parens, LF line endings.

### Import Order (ESLint enforced)

Strict import sorting via `simple-import-sort`:

1. `react`, `next`
2. Third-party (`@?\\w`)
3. Internal in order: `@/types` → `@/config` → `@/lib` → `@/hooks` → `@/components/ui` → `@/components` → `@/registry` → `@/styles` → `@/app`
4. Side effects, parent imports, relative imports, styles

### Path Aliases

`@/*` maps to project root. Use `@/lib/...`, `@/components/...`, etc.

## Environment

See `docs/getting-started/ENVIRONMENT.md` for full reference. Key variables:

- `DATABASE_URL` — PostgreSQL connection
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway (primary model provider)
- `TAVILY_API_KEY` — search
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `DATABASE_SSL_DISABLED=true` — for local dev with Supabase CLI
- `GUEST_CANVAS_SECRET` — HMAC secret for guest canvas artifact tokens
- `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — Redis for guest rate limiting (required when `ENABLE_GUEST_CHAT=true` in cloud mode)
- `NEXT_PUBLIC_ENABLE_VOICE` — enables voice input/output UI

## Railway & Phoenix Operations

Railway CLI (`railway`, v4.35.2) and Phoenix CLI (`npx @arizeai/phoenix-cli`) manage production infrastructure. MCP servers for both are configured in `.mcp.json`.

### Railway CLI (infrastructure, deploys, env vars)

- `railway status` — show linked project/service/environment
- `railway logs -s phoenix` — stream Phoenix service logs
- `railway logs -s phoenix --since 1h --filter "@level:error"` — recent errors
- `railway logs -s polymorph-evals -n 50` — last 50 evals cron log lines
- `railway variable list -s phoenix` — list Phoenix env vars
- `railway variable set KEY=VALUE -s <service>` — update env var (triggers redeploy)
- `railway restart -s phoenix` — restart without rebuild
- `railway redeploy -s polymorph-evals` — full rebuild + deploy
- `railway open` — open Railway dashboard in browser

### Phoenix CLI (traces, experiments, evals)

All commands require `PHOENIX_API_KEY` set in the shell environment for authenticated access.

- `npx @arizeai/phoenix-cli trace list --endpoint https://phoenix-production-c6b5.up.railway.app --limit 10` — recent traces
- `npx @arizeai/phoenix-cli experiment list --dataset <name>` — list eval experiments
- `npx @arizeai/phoenix-cli span list --span-kind LLM --status-code ERROR` — find LLM errors
- `npx @arizeai/phoenix-cli trace get <trace-id>` — inspect a specific trace

## Key Files

- `app/api/chat/route.ts` — main chat API endpoint (300s timeout)
- `lib/agents/researcher.ts` — ToolLoopAgent orchestration
- `lib/agents/prompts/` — system prompts for search modes
- `lib/tools/search.ts` — multi-provider search tool
- `lib/db/schema.ts` — Drizzle schema with RLS
- `lib/streaming/` — SSE response creation
- `lib/utils/registry.ts` — AI provider registry
- `config/models/` — model configuration JSON files (default.json, cloud.json)
- `proxy.ts` — Supabase session + base URL propagation (Next.js middleware entry point)
- `lib/canvas/` — canvas artifact compile pipeline, validation, service, guest tokens, legacy notice path
- `lib/tools/create-canvas-artifact.ts` — AI tool: create a new canvas artifact in the current chat
- `lib/tools/update-canvas-artifact.ts` — AI tool: update the existing canvas artifact source
- `lib/tools/read-canvas-artifact.ts` — AI tool: read current canvas artifact source (no side effects)
- `components/canvas/` — canvas workspace shell, live preview, CodeMirror editor, diagnostics, version history
- `app/api/canvas-artifacts/` — REST routes for canvas artifact state, drafts, versions, restore, export, diagnostics
- `instrumentation.ts` — OTel registration with Phoenix exporter, HTTPS enforcement via `isProductionTarget()`
- `lib/config/env.ts` — env validation, `isProductionTarget()` for Vercel/Railway production detection
- `lib/utils/telemetry.ts` — `flushTraces()` for serverless span export with timeout
- `services/evals/` — offline LLM-judge evaluation pipeline (Railway cron, own Dockerfile)

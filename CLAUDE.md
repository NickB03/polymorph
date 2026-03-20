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
- `npx supabase start` — local Supabase (DB:44322, API:44321, Studio:44323)

## Architecture

### AI Agent Pipeline

The core flow is: `app/api/chat/route.ts` → `lib/agents/researcher.ts` → tools → streaming response.

- **Researcher agent** (`lib/agents/researcher.ts`): Uses Vercel AI SDK's `ToolLoopAgent` with two modes:
  - **Chat mode**: max 20 steps, forced optimized search, tools: `[search, fetch, displayPlan, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayCallout, displayTimeline]` + canvas artifact tools
  - **Research mode**: max 50 steps, full search, tools: `[search, fetch, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayCallout, displayTimeline, todoWrite]` + canvas artifact tools
- **Tools** (`lib/tools/`): `search` (Tavily primary, Brave multimedia, plus Exa, SearXNG, Firecrawl), `fetch` (web content extraction), `todo` (task management), `dynamic` (MCP/runtime-defined tools)
- **Model selection** (`lib/utils/model-selection.ts`): Resolves model by search mode + model type (speed/quality). Default: Gemini 3 Flash (speed), Grok 4.1 Fast Reasoning (quality), both via Vercel AI Gateway
- **Provider registry** (`lib/utils/registry.ts`): Wraps multiple AI providers (gateway, openai, anthropic, google, openai-compatible, ollama) via `createProviderRegistry`

### Database (Drizzle + Supabase PostgreSQL)

Schema in `lib/db/schema.ts` with core tables:

- **chats** → **messages** → **parts** (cascade delete)
- `parts` is a wide table storing all message part types (text, reasoning, files, sources, tool calls) with check constraints per type
- All tables use Row-Level Security (RLS) via `current_setting('app.current_user_id')` — users see only their own data, public chats are readable by all
- Server actions in `lib/actions/chat.ts` use `unstable_cache` with revalidation tags

### Streaming

- `lib/streaming/create-chat-stream-response.ts` — authenticated chat streaming
- `lib/streaming/create-ephemeral-chat-stream-response.ts` — anonymous/guest streaming
- Responses are SSE with message parts streamed incrementally

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
- **Source validation** (`lib/canvas/validation/`): Validates and normalizes canvas source before compilation
- **Canvas workspace UI** (`components/canvas/`): Split-view workspace with live preview, CodeMirror editor, diagnostics panel, and version history

### Generative UI

Components render different message part types: `answer-section.tsx`, `search-section.tsx`, `reasoning-section.tsx`, `artifact/` directory for rich artifacts. These map to part types from the `parts` database table.

### Hooks

Custom React hooks in `hooks/`: `use-activity-feed`, `use-auth-check`, `use-content-entrance`, `use-current-user`, `use-file-dropzone`, `use-mobile`, `use-trending-suggestions`. Additional hooks in `lib/hooks/`: `use-copy-to-clipboard`, `use-media-query`.

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
- **Canvas artifact issues** (preview iframe, compile pipeline, diagnostics) → `e2b-sandbox`
- **Supabase/Postgres schema/query/perf changes** → `supabase-postgres-best-practices`
- **Next.js App Router architecture decisions** → `nextjs-app-router-patterns`

#### Precedence rules

1. Prefer **process/quality skills first** (debugging/planning/verification/review).
2. Then apply **domain skills** (Next.js, Supabase, testing) for implementation details.
3. If multiple skills could apply, invoke all relevant ones in this order:
   `systematic-debugging` → `writing-plans` → domain skill(s) (including `e2b-sandbox` when canvas artifacts are involved) → `verification-before-completion` → review skill(s).

#### Prompting hint for reliable auto-selection

When tasks are ambiguous, begin with:
"Select and invoke any relevant skills before answering, then proceed."

### Quality Standards

- **Fix every warning and error you encounter.** Never dismiss issues as "pre-existing," "unrelated to our changes," or "from a previous session." If you see it, you own it. Either fix it immediately or explicitly flag it to the user as something that needs attention — do not silently pass over it.
- Before claiming any task is complete, run `bun lint` and `bun typecheck`. If either produces warnings or errors, fix them — all of them, not just the ones your changes introduced.

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
- `components/canvas/` — canvas workspace shell, live preview, CodeMirror editor, diagnostics, version history
- `app/api/canvas-artifacts/` — REST routes for canvas artifact state, drafts, versions, restore, export, diagnostics

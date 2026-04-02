# GEMINI.md - Polymorph Project Context

## Project Overview

Polymorph is an AI platform with a generative UI for research, creation, and exploration. Research is its first capability, with code generation, image creation, and multimodal features expanding the platform.

**Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Bun, Tailwind CSS v4, shadcn/ui

### Core Technologies

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **Runtime:** Bun
- **AI Orchestration:** Vercel AI SDK (`ToolLoopAgent`)
- **Database:** PostgreSQL (via Supabase) with Drizzle ORM
- **Auth:** Supabase Auth
- **Storage:** Supabase Storage
- **Caching/Rate Limiting:** Upstash Redis
- **Search:** Tavily (primary), Brave (multimedia), Exa, SearXNG, Firecrawl
- **AI Providers:** Google (Gemini 3 Flash), xAI (Grok 4.1 Fast Reasoning) via Vercel AI Gateway
- **Styling:** Tailwind CSS v4 + shadcn/ui
- **Testing:** Vitest
- **Tracing:** Arize Phoenix

## Architecture

### AI Agent Pipeline

The core flow is: `app/api/chat/route.ts` → `lib/agents/researcher.ts` → tools → streaming response.

- **Researcher agent** (`lib/agents/researcher.ts`): Uses Vercel AI SDK's `ToolLoopAgent` with two modes:
  - **Chat mode**: max 20 steps, forced optimized search, tools: `[search, fetch, displayPlan, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayCallout, displayTimeline]` + canvas artifact tools
  - **Research mode**: max 50 steps, full search, tools: `[search, fetch, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayCallout, displayTimeline, todoWrite]` + canvas artifact tools
- **Canvas artifact tools**: `createCanvasArtifact`, `updateCanvasArtifact` — generate and iterate on React SPA artifacts compiled server-side via esbuild + Tailwind CSS v4
- **Tools** (`lib/tools/`): `search` (Tavily primary, Brave multimedia, plus Exa, SearXNG, Firecrawl), `fetch` (web content extraction), `todoWrite` (task management), `dynamic` (MCP/runtime-defined tools)
- **Model selection** (`lib/utils/model-selection.ts`): Resolves model by search mode + model type (speed/quality). Default: Gemini 3 Flash (speed), Grok 4.1 Fast Reasoning (quality), both via Vercel AI Gateway
- **Provider registry** (`lib/utils/registry.ts`): Wraps multiple AI providers (gateway, openai, anthropic, google, openai-compatible, ollama) via `createProviderRegistry`

### Database (Drizzle + Supabase PostgreSQL)

Schema in `lib/db/schema.ts` with core tables:

- **chats** → **messages** → **parts** (cascade delete)
- **canvasArtifacts** → **canvasArtifactVersions** (cascade delete)
- **feedback** — user feedback storage
- `parts` is a wide table storing all message part types (text, reasoning, files, sources, tool calls) with check constraints per type
- All tables use Row-Level Security (RLS) via `current_setting('app.current_user_id')`
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
- **Guest mode** (default): `ENABLE_GUEST_CHAT=true` lets unauthenticated users search immediately. Guest chats are ephemeral (not persisted), use speed-mode models only, and are rate-limited per IP via Upstash Redis.

### Canvas Artifacts

Canvas is the active artifact model. It is always-on (no feature flag gating).

- **Compile pipeline** (`lib/canvas/compiler/`): Server-side esbuild + Tailwind CSS v4 compiles React SPA source into a single self-contained HTML string served via `iframe.srcdoc`
- **One-artifact-per-chat rule:** Each chat maps to at most one canvas artifact
- **Canvas service** (`lib/canvas/service.ts`): CRUD operations with optimistic concurrency (revision counter)
- **Validation** (`lib/canvas/validation/`): Source validation and normalization before compilation
- **Guest security** (`lib/canvas/guest-token.ts`): HMAC-SHA256 signed tokens for guest artifact continuity
- **Workspace UI** (`components/canvas/`): Split-view workspace with live preview, CodeMirror editor, diagnostics panel, and version history

### Observability (Arize Phoenix)

OpenTelemetry tracing to a self-hosted Arize Phoenix instance, gated by `ENABLE_TRACING=true`.

- **Instrumentation** (`instrumentation.ts`): Registers OTel with Phoenix OTLP exporter. Uses `isProductionTarget()` from `lib/config/env.ts` to enforce HTTPS on the collector endpoint in production environments (Vercel, Railway, or generic `NODE_ENV=production`). Sets `deployment_environment` attribute from `VERCEL_ENV`, `RAILWAY_ENVIRONMENT`, or `NODE_ENV`.
- **Telemetry** (`lib/utils/telemetry.ts`): `flushTraces()` forces pending spans to export before serverless shutdown via `Promise.race` with configurable timeout. Warns on timeout or missing `forceFlush` provider.
- **Production detection** (`lib/config/env.ts`): `isProductionTarget()` consolidates Vercel (`VERCEL_ENV`, `VERCEL_TARGET_ENV`), Railway (`RAILWAY_ENVIRONMENT`), and generic `NODE_ENV` checks into a single reusable function.

### Evals Service

Offline evaluation pipeline (`services/evals/`) running as a Railway cron service:

- **Sampler** (`services/evals/src/sampler.ts`): Queries recent chats from Supabase Postgres using parameterized SQL with safe `parseCitations()` JSON parsing
- **Evaluators** (`services/evals/src/evaluators/`): Three LLM-judge evaluators (faithfulness, search relevance, response quality) built with a shared factory pattern (`create-evaluator.ts`). Shared `extractVerdict()` uses word-boundary matching to prevent substring false positives
- **Config** (`services/evals/src/config.ts`): NaN-safe `validInt()` parsing for `SAMPLE_SIZE` and `LOOKBACK_HOURS`
- **Robustness**: `closeDb()` guaranteed on all exit paths; `withRetry()` validates `maxAttempts >= 1`

### Generative UI

Components render different message part types: `answer-section.tsx`, `search-section.tsx`, `reasoning-section.tsx`, `canvas/` directory for canvas artifacts. These map to part types from the `parts` database table.

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
- `bun run chat` — CLI chat tool (`scripts/chat-cli.ts`)
- `bun run build:template` — build artifact template
- `npx supabase start` — local Supabase (DB:44322, API:44321, Studio:44323)

## Code Conventions

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

### Quality Standards

- Fix every warning and error encountered. Run `bun lint` and `bun typecheck` before claiming any task is complete.
- New tools go in `lib/tools/` and are registered in `lib/agents/researcher.ts`.
- Database changes go in `lib/db/schema.ts` with Drizzle Kit migrations.

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
- `next.config.mjs` — Next.js configuration
- `lib/canvas/` — canvas artifact compile pipeline, validation, service, guest tokens
- `lib/tools/create-canvas-artifact.ts` — AI tool: create a new canvas artifact
- `lib/tools/update-canvas-artifact.ts` — AI tool: update existing canvas artifact source
- `lib/tools/read-canvas-artifact.ts` — AI tool: read current canvas artifact source (no side effects)
- `app/api/canvas-artifacts/` — REST routes for canvas artifact state, drafts, versions, export
- `components/canvas/` — canvas workspace shell, live preview, CodeMirror editor, diagnostics
- `instrumentation.ts` — OTel registration with Phoenix exporter and HTTPS enforcement
- `lib/config/env.ts` — environment validation, `isProductionTarget()` for Vercel/Railway detection
- `lib/utils/telemetry.ts` — `flushTraces()` for serverless span export with timeout
- `services/evals/` — offline LLM-judge evaluation pipeline (Railway cron)
- `docs/architecture/DECISIONS.md` — architectural decisions

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
- **Tracing:** Langfuse

## Architecture

### AI Agent Pipeline

The core flow is: `app/api/chat/route.ts` → `lib/agents/researcher.ts` → tools → streaming response.

- **Researcher agent** (`lib/agents/researcher.ts`): Uses Vercel AI SDK's `ToolLoopAgent` with two modes:
  - **Chat mode**: max 20 steps, forced optimized search, tools: `[search, fetch, displayPlan, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayCallout, displayTimeline]` + artifact tools when `ENABLE_ARTIFACTS=true`
  - **Research mode**: max 50 steps, full search, tools: `[search, fetch, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, displayCallout, displayTimeline, todoWrite]` + artifact tools when `ENABLE_ARTIFACTS=true`
- **Artifact tools** (gated by `ENABLE_ARTIFACTS=true`): `createWebappArtifact`, `updateWebappArtifact`, `getArtifactStatus`, `restartArtifactPreview` — generate and iterate on React SPA artifacts in E2B sandboxes
- **Tools** (`lib/tools/`): `search` (Tavily primary, Brave multimedia, plus Exa, SearXNG, Firecrawl), `fetch` (web content extraction), `todo` (task management), `dynamic` (MCP/runtime-defined tools)
- **Model selection** (`lib/utils/model-selection.ts`): Resolves model by search mode + model type (speed/quality). Default: Gemini 3 Flash (speed), Grok 4.1 Fast Reasoning (quality), both via Vercel AI Gateway
- **Provider registry** (`lib/utils/registry.ts`): Wraps multiple AI providers (gateway, openai, anthropic, google, openai-compatible, ollama) via `createProviderRegistry`

### Database (Drizzle + Supabase PostgreSQL)

Schema in `lib/db/schema.ts` with seven tables:

- **chats** → **messages** → **parts** (cascade delete)
- **artifacts** → **artifactRevisions** + **artifactRuntimeSessions** (cascade delete)
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

### Artifacts (E2B)

React SPA artifact generation in E2B sandboxes, gated by `ENABLE_ARTIFACTS=true`:

- **Runtime adapter** (`lib/artifacts/runtime/e2b-runtime.ts`): HTTP-backed E2B sandbox operations (create session, write files, build, preview, destroy)
- **Template** (`lib/artifacts/templates/react-spa/`): Immutable Vite + React + Tailwind template with preinstalled shadcn/Radix UI components
- **Validation** (`lib/artifacts/validation/`): Import normalization and source validation against template manifest
- **Guest security** (`lib/artifacts/guest-token.ts`): HMAC-SHA256 signed tokens for guest artifact continuity
- **Workspace UI** (`components/artifact/`): Split-view workspace with Preview, Code, and Logs tabs; error recovery panel

### Generative UI

Components render different message part types: `answer-section.tsx`, `search-section.tsx`, `reasoning-section.tsx`, `artifact/` directory for rich artifacts. These map to part types from the `parts` database table.

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
- `ENABLE_ARTIFACTS` — set to `true` to enable artifact generation tools (default: `false`)
- `E2B_API_KEY` — E2B sandbox API key (required when artifacts enabled)
- `GUEST_ARTIFACT_SECRET` — HMAC secret for guest artifact tokens (required when artifacts enabled)

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
- `lib/artifacts/` — E2B artifact runtime, validation, guest tokens, observability
- `lib/tools/*-artifact*.ts` — artifact tool definitions (create, update, status, restart)
- `app/api/artifacts/` — artifact workspace action endpoints (refresh, retry)
- `components/artifact/` — workspace shell, preview frame, code viewer, error panel
- `docs/architecture/DECISIONS.md` — architectural decisions

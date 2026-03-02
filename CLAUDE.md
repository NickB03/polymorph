# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Vana v2 is an AI-powered answer engine with generative UI. It provides a chat interface that performs multi-step research using tools (search, fetch, questions) and generates answers with citations.

**Stack:** Next.js 16 (App Router), React 19, TypeScript (strict), Bun, Tailwind CSS v4, shadcn/ui

## Commands

- `bun dev` — dev server on port 43100
- `bun run build` — production build
- `bun lint` — ESLint
- `bun typecheck` — TypeScript checking
- `bun format` — Prettier format
- `bun format:check` — Prettier check
- `bun run test` — Vitest (single run)
- `bun run test:watch` — Vitest watch mode
- `bun run migrate` — run Drizzle migrations
- `npx supabase start` — local Supabase (DB:44322, API:44321, Studio:44323)

## Architecture

### AI Agent Pipeline

The core flow is: `app/api/chat/route.ts` → `lib/agents/researcher.ts` → tools → streaming response.

- **Researcher agent** (`lib/agents/researcher.ts`): Uses Vercel AI SDK's `ToolLoopAgent` with two modes:
  - **Quick mode**: max 20 steps, forced optimized search, tools: `[search, fetch, displayPlan, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList]`
  - **Adaptive mode**: max 50 steps, full search, tools: `[search, fetch, displayTable, displayChart, displayCitations, displayLinkPreview, displayOptionList, todoWrite]` (todoWrite when writer available)
- **Tools** (`lib/tools/`): `search` (Tavily primary, Brave for multimedia), `fetch` (web content extraction), `question` (interactive), `todo` (task management)
- **Model selection** (`lib/utils/model-selection.ts`): Resolves model by search mode + model type (speed/quality). Default: Gemini 3 Flash (speed), Grok 4.1 Fast Reasoning (quality), both via Vercel AI Gateway
- **Provider registry** (`lib/utils/registry.ts`): Wraps multiple AI providers (gateway, openai, anthropic, google, openai-compatible, ollama) via `createProviderRegistry`

### Database (Drizzle + Supabase PostgreSQL)

Schema in `lib/db/schema.ts` with three core tables:

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
- Guest mode available via `ENABLE_GUEST_CHAT=true` with rate limiting (Upstash Redis)

### Generative UI

Components render different message part types: `answer-section.tsx`, `search-section.tsx`, `reasoning-section.tsx`, `artifact/` directory for rich artifacts. These map to part types from the `parts` database table.

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

## Environment

See `docs/ENVIRONMENT.md` for full reference. Key variables:

- `DATABASE_URL` — PostgreSQL connection
- `AI_GATEWAY_API_KEY` — Vercel AI Gateway (primary model provider)
- `TAVILY_API_KEY` — search
- `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase
- `DATABASE_SSL_DISABLED=true` — for local dev with Supabase CLI

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

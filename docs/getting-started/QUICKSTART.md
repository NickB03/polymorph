# Quickstart Guide

> **Audience:** New Developer
> **Time:** ~10 minutes

Get Polymorph running locally from scratch.

## Prerequisites

| Tool   | Version    | Install                          |
| ------ | ---------- | -------------------------------- |
| Bun    | v1.3.9     | https://bun.sh                   |
| Docker | Latest     | https://docs.docker.com/install/ |
| Git    | Any recent | https://git-scm.com              |

Docker is required for the local Supabase instance (PostgreSQL, Auth, Storage).

## 1. Clone and Install

```bash
git clone https://github.com/NickB03/polymorph.git
cd polymorph
bun install
```

## 2. Start Local Supabase

```bash
npx supabase start
```

This starts a local Supabase stack using Docker. Polymorph uses **custom ports** to avoid conflicts with other Supabase projects:

| Service  | Port  |
| -------- | ----- |
| Database | 44322 |
| API      | 44321 |
| Studio   | 44323 |

The first run downloads Docker images and may take a few minutes.

## 3. Configure Environment

```bash
cp .env.local.example .env.local
```

Open `.env.local` and set the variables for the default local path:

```bash
# Database -- local Supabase PostgreSQL
DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres
DATABASE_SSL_DISABLED=true

# AI -- Vercel AI Gateway (powers the default shipped models)
AI_GATEWAY_API_KEY=your_vercel_gateway_key
# Search -- Brave (default primary search provider)
BRAVE_SEARCH_API_KEY=your_brave_key
# Or use Tavily as an alternative:
# TAVILY_API_KEY=your_tavily_key
# Auth -- either configure Supabase or enable guest chat for local use
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key from `npx supabase status`>

# Or, for a local-only anonymous path:
ENABLE_GUEST_CHAT=true
```

See [Environment Reference](ENVIRONMENT.md) for the full variable matrix.

Use the Supabase values if you want signed-in auth locally. If you prefer anonymous local testing, you can skip those auth keys and keep only `ENABLE_GUEST_CHAT=true`.

## 4. Run Migrations

```bash
bun run migrate
```

This creates the database tables (`chats`, `messages`, `parts`, `feedback`, and related tables) with Row-Level Security policies.

## 5. Start the Dev Server

```bash
bun dev
```

Open [http://localhost:43100](http://localhost:43100). You should see the Polymorph search interface.

## 6. Your First Search

1. Type a question in the search bar (e.g., "What is the Diataxis documentation framework?")
2. Watch the research agent work -- it searches the web, fetches content, and streams a rich answer
3. Notice the generative UI components: citations, link previews, and structured sections

If you have `ENABLE_GUEST_CHAT=true`, you can search without signing in.

## What Just Happened?

Here's the flow your search triggered:

1. **Browser** sent a request to `/api/chat` via SSE
2. **Chat agent** (`lib/agents/chat/factory.ts` via the registry in `lib/agents/chat/registry.ts`) received the query and selected tools — one of three agents (`search`, `research`, or `build`) based on the requested mode
3. **Search tool** called Brave (or your configured provider) to find relevant web pages
4. **Fetch tool** extracted content from top results
5. **LLM** (via Vercel AI Gateway) synthesized an answer with citations
6. **Streaming** sent message parts back to the browser incrementally
7. **Generative UI** rendered each part as an interactive component

For the full picture, see the [Architecture Overview](../architecture/OVERVIEW.md).

## Next Steps

- [Contributing Guide](../../CONTRIBUTING.md) -- How to add features, write tests, and submit PRs
- [Configuration Guide](CONFIGURATION.md) -- Auth modes, search providers, AI provider options
- [Architecture Overview](../architecture/OVERVIEW.md) -- System design and data flow

## Common Setup Issues

**`npx supabase start` fails with port conflicts:**
Check if ports 44321-44323 are in use: `lsof -i :44321 -i :44322 -i :44323`. Stop other Supabase instances with `npx supabase stop`.

**Database connection fails with SSL errors:**
Make sure `DATABASE_SSL_DISABLED=true` is set in `.env.local`. The local Supabase instance doesn't use SSL.

**App starts but searches fail:**
Verify the configured search provider key is set correctly (`BRAVE_SEARCH_API_KEY`, `TAVILY_API_KEY`, `EXA_API_KEY`, or the provider selected in `SEARCH_API`). Check the terminal for error messages.

For more solutions, see [Troubleshooting](../operations/TROUBLESHOOTING.md).

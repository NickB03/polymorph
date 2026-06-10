# Architecture Tech Stack

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf lists the primary runtime, framework, data, AI, search, tracing, and UI technologies used by Polymorph.

## Tech Stack

| Category  | Technology                                                                                                                                         |
| --------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Framework | Next.js 16 (App Router)                                                                                                                            |
| Runtime   | Bun                                                                                                                                                |
| Language  | TypeScript (strict mode)                                                                                                                           |
| Database  | PostgreSQL via Supabase + Drizzle ORM                                                                                                              |
| Auth      | Supabase Auth                                                                                                                                      |
| AI        | Vercel AI SDK + OpenRouter text defaults; Vercel AI Gateway for image generation and optional routes                                               |
| Search    | Brave (default), Tavily/Exa fallbacks, optional SearXNG/Firecrawl providers                                                                        |
| Artifacts | Canvas artifact compiler + workspace (single-file HTML preview/export)                                                                             |
| Styling   | Tailwind CSS v4 + shadcn/ui                                                                                                                        |
| Testing   | Vitest                                                                                                                                             |
| Tracing   | Arize Phoenix                                                                                                                                      |
| Gen UI    | 11 display tools (tables, charts, geo maps, timelines, citations, callouts, plans, link previews, agent artifacts, option lists, question wizards) |

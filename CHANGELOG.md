# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.2.0] - 2026-05-04

### Added

- App Router `(admin)/` and `(chat)/` route groups, with admin surface gated by `ADMIN_USER_ID`
- Daily Vercel cron at `/api/suggestions/refresh` to refresh trending suggestions (Bearer-auth gated by `CRON_SECRET`)
- Typed search-provider errors with `Retry-After` honoring and jittered exponential backoff
- Inline image generation tool (`generateImage`, Gemini 2.5 Flash Image)
- Image upload as LLM context (multimodal input) for all users
- `readCanvasArtifact` tool for reading current canvas source without side effects
- `displayQuestionWizard` interactive question-flow display tool
- New evaluators: safety, citation accuracy, deterministic tool usage
- Traffic Monitor eval runner; results persisted to `eval_summaries` for the `/admin/evals` dashboard
- Related-questions ticker with auto-rotation; reduced-motion hook
- File validation utilities and Supabase server storage helper for uploads
- `--accent-violet` design token for the Research Agent brand color
- Shared evaluator factory and verdict extractor with word-boundary matching
- ESLint flat config aligned with Next.js 16 (see [`ESLINT-CONVENTIONS.md`](docs/reference/ESLINT-CONVENTIONS.md))
- Phoenix project naming convention `polymorph-{env}`

### Changed

- Default search provider changed from Tavily to Brave (`SEARCH_API=brave`, required env `BRAVE_SEARCH_API_KEY`)
- Migrated observability from Langfuse to Arize Phoenix with OpenInference tracing; production deployments must use an HTTPS collector endpoint
- Renamed `ENABLE_LANGFUSE_TRACING` to `ENABLE_TRACING`
- Replaced Langfuse environment variables with Phoenix equivalents (`PHOENIX_COLLECTOR_ENDPOINT`, `PHOENIX_PROJECT_NAME`, `PHOENIX_API_KEY`)
- Updated start script to respect Railway `PORT` environment variable
- Evals cron cadence messaging aligned with the actual Railway schedule (every 48 hours)
- Canvas artifact system now provides validated React source compilation to persisted single-file HTML with live preview, version history, guest token continuity, and export support
- Research Agent brand color now uses `text-accent-violet` token instead of `text-tip`
- Progress tracker celebration glow uses `var(--success)` token via `color-mix()` instead of hardcoded emerald RGBA
- Consolidated production detection into exported `isProductionTarget()` in `lib/config/env.ts`
- Enhanced `flushTraces()` in `lib/utils/telemetry.ts` with timeout and missing-provider warnings
- Evaluators (faithfulness, relevance, response-quality) refactored to use shared utilities and factory pattern
- Evals dashboard (`/admin/evals`) reorganized around a Suites/History view switcher with a tabbed suite selector, compact alert banner, and an evaluator-breakdown panel with AUTO badges for deterministic rules. View and suite selection persist in the URL (`?view=...&suite=...`).

### Removed

- Demo evals routes and components: `/admin/evals/demo`, `/admin/evals/demo-mixed`, `/admin/evals/demo-redesign`, plus orphaned `dashboard/header.tsx`, `dashboard/kpi-strip.tsx`, `dashboard/combined-trend.tsx`, `lib/evals/helpers/combined-trend.ts`, and `widgets/alert-banner.tsx` (replaced by `dashboard-v2/compact-alert.tsx`)

### Fixed

- Evals dashboard empty state: hid the non-functional view switcher (previously rendered as an interactive radio group with a no-op `onChange`)
- Evals skip `response_quality` for refusal cases and add `expectsRefusal` flag
- SQL injection risk in evals sampler: replaced `sql.raw()` interpolation with parameterized `make_interval(hours => $1)` query
- `extractVerdict` substring false positive where "faithful" matched inside "unfaithful", inflating faithfulness scores
- Evals entrypoint now guarantees `closeDb()` runs on fatal error paths (previously leaked Postgres connections)
- `parseInt` NaN guard (`validInt()`) in evals config prevents silent corruption from non-numeric env vars
- `maxAttempts` validation in retry utility prevents undefined throw when value is 0 or negative
- Safe `JSON.parse` wrapper for citations in evals sampler, matching the existing `parseSearchResults` pattern
- Evals runners split Phoenix HTTP and Postgres write failures into distinct `PHOENIX UNAVAILABLE` and `DB WRITE FAILED` error labels so DB outages are no longer misdiagnosed as Phoenix downtime
- Threshold-failure throw in `runJudgedSuite` now survives a DB write outage (threshold check moved before the DB persist)
- Sampler `tool_data` CTE now references real columns on the `parts` table (eliminates empty tool context in eval samples)

## [0.1.0] - 2026-02-28

### Added

- AI platform with generative UI
- Researcher agent with chat mode (20 steps) and research mode (50 steps)
- Multi-provider search via Tavily (primary), Brave (multimedia), Exa, SearXNG, and Firecrawl
- Web content extraction with fetch tool
- Todo/planning tools for structured research workflows
- 8 generative UI display tools: tables, charts, timelines, citations, callouts, plans, link previews, option lists
- Streaming chat responses via SSE with incremental message parts
- Generative UI components for answers, search results, reasoning, and artifacts
- Canvas artifact generation with validated React source compilation, guest tokens, and observability
- Model selection with Gemini 3 Flash (speed) and Grok 4.1 Fast Reasoning (quality) via Vercel AI Gateway
- Provider registry supporting gateway, OpenAI, Anthropic, Google, openai-compatible, and Ollama
- Drizzle ORM schema with seven tables (chats, messages, parts, artifacts, artifactRevisions, artifactRuntimeSessions, feedback) with Row-Level Security
- Supabase Auth integration with browser, server, and middleware client patterns
- Guest chat mode with Upstash Redis rate limiting
- Voice mode with speech input, TTS playback, and voice overlay
- Activity feed and inspector panels
- Dynamic/MCP tool support for runtime-defined tools
- Langfuse tracing integration
- CLI chat tool (`bun run chat`)
- Sidebar navigation with chat history management
- Vercel + Supabase deployment configuration with Docker build workflows
- CI pipeline with GitHub Actions for linting, type checking, and builds
- Local development environment setup with Supabase CLI
- Polymorph branding and UI customization

### Fixed

- CI and Docker build workflow failures including bash shell configuration
- Planning tool usage and display tool rendering
- Type safety improvements for boolean coercion and semantic HTML elements
- Comprehensive type safety, accessibility, validation, and edge case fixes
- Formatting consistency across documentation and components

### Changed

- Custom branding and UI configuration for Polymorph
- Standardized model configuration on AI Gateway providers
- Updated shadcn/ui components and dependencies

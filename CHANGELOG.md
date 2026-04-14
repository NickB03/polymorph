# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Image generation tool (`generateImage`) with Gemini Flash for inline image creation
- Image upload as LLM context for all users — multimodal input support
- `readCanvasArtifact` tool for reading current canvas artifact source without side effects
- `displayQuestionWizard` display tool for interactive question flows in generative UI
- Safety evaluator for LLM response safety assessment (`services/evals/src/evaluators/safety.ts`)
- Citation accuracy evaluator for verifying citation quality (`services/evals/src/evaluators/citation-accuracy.ts`)
- Tool usage evaluator (deterministic) for validating agent tool selection (`services/evals/src/evaluators/tool-usage.ts`)
- Traffic monitor eval runner (`services/evals/src/runners/traffic-monitor.ts`)
- Traffic monitor suite results now persist to `eval_summaries` so the admin `/evals` dashboard renders them
- Admin `/evals` dashboard renders Capability and Traffic Monitor as parallel suite sections with per-suite ring, latest run, trend chart, and evaluator bars
- Related questions ticker with auto-rotation (`hooks/use-ticker-rotation.ts`)
- File validation utilities for upload restrictions (`lib/utils/file-validation.ts`)
- Supabase server storage helper (`lib/supabase/server-storage.ts`)
- Inline file URL processing for streaming (`lib/streaming/helpers/inline-file-urls.ts`)
- `--accent-violet` design token (OKLCH hue ~293) for the Research Agent brand color, with light and dark mode definitions
- Evaluator factory (`services/evals/src/evaluators/create-evaluator.ts`) eliminating ~60% boilerplate across LLM evaluators
- Shared `extractVerdict` + `asString` utilities (`services/evals/src/evaluators/extract-verdict.ts`) with word-boundary matching to prevent substring false positives

### Changed

- Default search provider changed from Tavily to Brave
- Migrated observability from Langfuse to Arize Phoenix with OpenInference tracing
- Renamed `ENABLE_LANGFUSE_TRACING` to `ENABLE_TRACING`
- Replaced Langfuse environment variables with Phoenix equivalents (`PHOENIX_COLLECTOR_ENDPOINT`, `PHOENIX_PROJECT_NAME`, `PHOENIX_API_KEY`)
- Updated start script to respect Railway `PORT` environment variable
- Canvas artifact system now provides validated React source compilation to persisted single-file HTML with live preview, version history, guest token continuity, and export support
- Research Agent brand color now uses `text-accent-violet` token instead of `text-tip`
- Progress tracker celebration glow uses `var(--success)` token via `color-mix()` instead of hardcoded emerald RGBA
- Consolidated production detection into exported `isProductionTarget()` in `lib/config/env.ts`
- Enhanced `flushTraces()` in `lib/utils/telemetry.ts` with timeout and missing-provider warnings
- Evaluators (faithfulness, relevance, response-quality) refactored to use shared utilities and factory pattern

### Fixed

- Evals skip `response_quality` for refusal cases and add `expectsRefusal` flag
- SQL injection risk in evals sampler: replaced `sql.raw()` interpolation with parameterized `make_interval(hours => $1)` query
- `extractVerdict` substring false positive where "faithful" matched inside "unfaithful", inflating faithfulness scores
- Evals entrypoint now guarantees `closeDb()` runs on fatal error paths (previously leaked Postgres connections)
- `parseInt` NaN guard (`validInt()`) in evals config prevents silent corruption from non-numeric env vars
- `maxAttempts` validation in retry utility prevents undefined throw when value is 0 or negative
- Safe `JSON.parse` wrapper for citations in evals sampler, matching the existing `parseSearchResults` pattern
- Evals runners split Phoenix HTTP and Postgres write failures into distinct `PHOENIX UNAVAILABLE` and `DB WRITE FAILED` error labels so DB outages are no longer misdiagnosed as Phoenix downtime
- Threshold-failure throw in `runJudgedSuite` now survives a DB write outage (threshold check moved before the DB persist)

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

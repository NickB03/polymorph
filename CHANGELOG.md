# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.3.0] - 2026-09-16

### Added

- Graphify knowledge-graph corpus persisted in git, with a merge driver and CI freshness guard (#256), split long docs for ingest (#253), and long-lived assistant support (Add Graphify assistant support)
- `tool_selection` LLM-judge evaluator, bringing the evals pipeline to 9 evaluators (#220, corrected in docs by #242)
- bklit chart visualizations in `/admin/evals` (#218)
- Low-cost weekly portfolio eval canary alongside the existing regression suite (#261)
- First-run Polymorph demo popup and README demo reel/GIF (#237, #222, #223, #247, #246, docs: improve README demo video quality)
- Tier-1 test coverage for auth, search, rate-limit, and RLS, plus coverage/typecheck CI guardrails (#244)
- `/api/health` now reports tracing-registration state and resolved OpenInference span-content masking state, so a blind-deploy or a masking-flag typo is visible without opening Phoenix (#263)
- AI SDK 7 and OpenTelemetry SDK 2.x adopted across the app and `services/evals`, with `@ai-sdk/otel` registered in `instrumentation.ts` (this branch)
- `prefers-reduced-motion` handling for chart tooltips/axes and the voice orb animation (this branch)
- Skip-to-content link, `id="main-content"` focus targets, and accessible names/mobile touch targets across chat and tool UI (this branch)

### Changed

- Manifest-driven Tool UI runtime; 5 display tools migrated to the directory pattern (#197, Add manifest-driven Tool UI runtime)
- Chat stack aligned with the AI SDK v6 contract, then migrated again to AI SDK 7 on this branch (Align chat stack with AI SDK v6 contract; this branch)
- `render-message` legacy compatibility paths reduced; `parts` table and backward-compat code removed from the DB layer (#202, #200)
- DeepSeek reasoning now streams with per-step Thoughts disclosures coalesced, and DeepSeek models mirror through the Gateway fallback (#234, #226)
- Text models standardized on OpenRouter, with fallback when the OpenRouter key is missing (#224, #225)
- Docs corrected for accuracy drift against current source: eval count (9, not 7), configurable `DAILY_CHAT_LIMIT`, `FILE-INDEX.md` entries (#243, #242), and agent-instruction stale references (#251)
- Dependency refresh: Next 16.3.5, React 19.3, `tailwind-merge` 3, `next-themes` 0.4, `sonner` 2, `lucide-react` 1.x, `@supabase/ssr`, `@vercel/analytics`, `jsdom` 30, `exa-js` 2, `streamdown` 2; unused `node-html-parser` dependency dropped (this branch)
- `services/types.ts` reformatted for Prettier 3.9 (this branch)

### Fixed

- Canvas fullscreen view sandboxed (`Content-Security-Policy: sandbox allow-scripts`) to block session-cookie exfiltration via attacker-controlled canvas HTML (#252)
- Security audit fixes: open-redirect bypass via backslash/control-char paths, raw upstream error text no longer reflected to clients, empty first-turn token-budget handling, unbounded crawl concurrency bounded, JSDOM leak closed, pooled-connection deadlock in `updateChatVisibility`, Redis rate-limit timer leak, and other correctness/resource issues from a full-codebase audit (#257)
- Security hardening: timing-safe comparison for cron/eval shared secrets, clamped pagination on `/api/chats`, validated and rate-limited site-feedback submissions, feedback `SELECT` policy restricted to row owner (#255)
- Four silent gaps in Phoenix span coverage: aborted chats now flush traces unconditionally, `OPENINFERENCE_HIDE_INPUTS`/`OUTPUTS` now actually mask AI SDK span input/output, image-generation and trending-suggestions LLM calls are now traced (#263)
- Golden eval validator now judges production-shaped context; fail-fast on invalid eval config, fail-closed gating (safety hard gate, judge-error separation), replay drop-rate gate applied to capability/regression suites, judge-call timeouts (#262)
- Empty chat routes (#241); `DateTicker` key collisions when month/day labels repeat (#238)
- Optimistic-concurrency and atomic-counter fixes for canvas and rate-limit, dead surface removed (this branch)
- Tool/binary context counting, tool-pair integrity, and restored span metadata in streaming (this branch)

### Security

- Server Action exposure, an SSRF sink, and unauthenticated feedback writes closed — guests can no longer submit message feedback (this branch)
- 78 of 80 audit-flagged dependency vulnerabilities patched across root and `services/evals` (#254)
- Ollama startup validation check removed as dead code once its per-request callers were removed in #257 (#258)

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

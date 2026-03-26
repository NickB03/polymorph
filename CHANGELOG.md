# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed

- Canvas artifact system now provides validated React source compilation to persisted single-file HTML with live preview, version history, guest token continuity, and export support

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

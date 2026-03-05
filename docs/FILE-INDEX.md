# File Index

Comprehensive index of every file in the Polymorph repository, organized by directory. Each entry includes the file path and a one-line description.

## Table of Contents

- [Root Files](#root-files)
- [App Routes](#app-routes)
- [Components](#components)
  - [Core Components](#core-components)
  - [Auth Components](#auth-components)
  - [Message & Chat Components](#message--chat-components)
  - [Search & Results Components](#search--results-components)
  - [Artifact Components](#artifact-components)
  - [Inspector Components](#inspector-components)
  - [Sidebar Components](#sidebar-components)
  - [Tool UI Components](#tool-ui-components)
  - [UI Primitives](#ui-primitives)
- [Core Library](#core-library)
  - [Agents](#agents)
  - [Tools](#tools)
  - [Search Providers](#search-providers)
  - [Streaming](#streaming)
  - [Database](#database)
  - [Server Actions](#server-actions)
  - [Schema (Zod)](#schema-zod)
  - [Types](#types)
  - [Config](#config)
  - [Auth](#auth)
  - [Supabase](#supabase)
  - [Rate Limiting](#rate-limiting)
  - [Analytics](#analytics)
  - [Utils](#utils)
  - [External Clients](#external-clients)
  - [Lib Hooks](#lib-hooks)
  - [Constants](#constants)
- [Top-Level Hooks](#top-level-hooks)
- [Config Files](#config-files)
- [Scripts](#scripts)
- [Database Migrations](#database-migrations)
- [Supabase](#supabase-config)
- [Documentation](#documentation)
- [GitHub](#github)
- [Public Assets](#public-assets)
- [Tests](#tests)

---

## Root Files

| File                  | Purpose                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| `proxy.ts`            | Next.js middleware entry point; propagates Supabase session and base URL headers to downstream requests |
| `instrumentation.ts`  | Registers OpenTelemetry with Langfuse exporter and initializes Ollama validation on server startup      |
| `next.config.mjs`     | Next.js configuration; sets allowed remote image patterns for YouTube, Google, and Brave                |
| `drizzle.config.ts`   | Drizzle Kit configuration; points schema at `@/lib/db/schema.ts` and outputs migrations to `drizzle/`   |
| `vitest.config.mts`   | Vitest configuration; sets jsdom environment, path aliases, and setup file                              |
| `vitest.setup.ts`     | Test setup file; mocks Next.js cache functions and sets dummy env vars                                  |
| `package.json`        | Project manifest with scripts, dependencies, and metadata                                               |
| `tsconfig.json`       | TypeScript configuration with strict mode and `@/` path alias                                           |
| `postcss.config.mjs`  | PostCSS configuration for Tailwind CSS                                                                  |
| `prettier.config.js`  | Prettier configuration (no semicolons, single quotes, no trailing commas)                               |
| `.eslintrc.json`      | ESLint configuration with import sorting rules                                                          |
| `components.json`     | shadcn/ui configuration for component generation                                                        |
| `docker-compose.yaml` | Docker Compose stack defining Polymorph app and Redis services                                          |
| `Dockerfile`          | Multi-stage Docker build for production deployment                                                      |
| `.gitignore`          | Git ignore rules for node_modules, .next, env files, etc.                                               |
| `.mcp.json`           | MCP (Model Context Protocol) configuration                                                              |
| `CLAUDE.md`           | AI coding assistant instructions and project conventions                                                |
| `GEMINI.md`           | Gemini-specific AI assistant instructions                                                               |
| `README.md`           | Project overview, setup guide, and feature summary                                                      |
| `CHANGELOG.md`        | Version history and release notes                                                                       |
| `CONTRIBUTING.md`     | Contribution guidelines and development workflow                                                        |
| `CODE_OF_CONDUCT.md`  | Community code of conduct                                                                               |
| `SECURITY.md`         | Security policy and vulnerability reporting                                                             |
| `LICENSE`             | Apache 2.0 license                                                                                      |

---

## App Routes

### Pages

| File                      | Purpose                                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------------------- |
| `app/layout.tsx`          | Root layout with font loading, theme provider, sidebar, header, artifact container, and analytics |
| `app/page.tsx`            | Home page; resolves current user and renders the Chat component                                   |
| `app/globals.css`         | Global CSS with Tailwind directives and custom theme variables                                    |
| `app/manifest.ts`         | PWA manifest with app name, icons, and display settings                                           |
| `app/favicon.ico`         | Browser favicon                                                                                   |
| `app/icon.png`            | 192px app icon for PWA                                                                            |
| `app/apple-icon.png`      | Apple touch icon                                                                                  |
| `app/opengraph-image.png` | OpenGraph social sharing image                                                                    |

### Search Routes

| File                       | Purpose                                                                                                      |
| -------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `app/search/page.tsx`      | Search page; reads `?q=` query param, generates a chat ID, and renders Chat with initial query               |
| `app/search/[id]/page.tsx` | Existing chat page; loads chat by ID from database, generates metadata, and renders Chat with saved messages |
| `app/search/loading.tsx`   | Loading skeleton shown during search page transitions                                                        |

### Auth Routes

| File                                | Purpose                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| `app/auth/login/page.tsx`           | Login page rendering the LoginForm component                   |
| `app/auth/sign-up/page.tsx`         | Sign-up page rendering the SignUpForm component                |
| `app/auth/sign-up-success/page.tsx` | Post-signup confirmation page prompting email verification     |
| `app/auth/forgot-password/page.tsx` | Forgot password page rendering ForgotPasswordForm              |
| `app/auth/update-password/page.tsx` | Password update page rendering UpdatePasswordForm              |
| `app/auth/error/page.tsx`           | Auth error page displaying error messages from query params    |
| `app/auth/oauth/route.ts`           | OAuth callback route; exchanges auth code for Supabase session |
| `app/auth/confirm/route.ts`         | Email confirmation route; verifies OTP token hash              |

### API Routes

| File                               | Purpose                                                                                                                                             |
| ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/chat/route.ts`            | Main chat endpoint (POST, 300s timeout); handles auth, rate limiting, model selection, and delegates to authenticated or ephemeral stream responses |
| `app/api/chats/route.ts`           | Chat history endpoint (GET); returns paginated list of user chats                                                                                   |
| `app/api/feedback/route.ts`        | Feedback endpoint (POST); records thumbs up/down scores to Langfuse and updates message metadata                                                    |
| `app/api/upload/route.ts`          | File upload endpoint (POST); validates file type/size and uploads to Supabase Storage                                                               |
| `app/api/advanced-search/route.ts` | SearXNG advanced search endpoint (POST); performs cached deep-crawl searches with relevance scoring                                                 |

---

## Components

### Core Components

| File                              | Purpose                                                                                       |
| --------------------------------- | --------------------------------------------------------------------------------------------- |
| `components/chat.tsx`             | Main chat orchestrator; manages `useChat`, file uploads, message sections, and error handling |
| `components/chat-messages.tsx`    | Renders the scrollable message list, grouped into user/assistant sections                     |
| `components/chat-panel.tsx`       | Chat input panel with textarea, send/stop buttons, search mode selector, and file upload      |
| `components/render-message.tsx`   | Routes each message part to the appropriate section renderer (text, tool, dynamic tool)       |
| `components/header.tsx`           | Top navigation bar with sidebar trigger, feedback button, and user/guest menu                 |
| `components/app-sidebar.tsx`      | Application sidebar with logo, new chat button, and chat history                              |
| `components/theme-provider.tsx`   | Wraps `next-themes` ThemeProvider for dark/light mode support                                 |
| `components/drag-overlay.tsx`     | Full-screen overlay shown during file drag-and-drop                                           |
| `components/error-modal.tsx`      | Modal dialog displaying chat error details                                                    |
| `components/default-skeleton.tsx` | Skeleton loading placeholders for search and message sections                                 |

### Auth Components

| File                                  | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `components/login-form.tsx`           | Login form with email/password fields and OAuth providers             |
| `components/sign-up-form.tsx`         | Sign-up form with name, email, password fields                        |
| `components/forgot-password-form.tsx` | Forgot password form for email-based password reset                   |
| `components/update-password-form.tsx` | Password update form for setting a new password                       |
| `components/auth-modal.tsx`           | Modal prompting unauthenticated users to sign in                      |
| `components/guest-menu.tsx`           | Dropdown menu for guest users with sign-in option                     |
| `components/user-menu.tsx`            | Dropdown menu for authenticated users with theme, links, and sign-out |
| `components/current-user-avatar.tsx`  | Avatar component displaying the current user's profile image          |

### Message & Chat Components

| File                                 | Purpose                                                                                      |
| ------------------------------------ | -------------------------------------------------------------------------------------------- |
| `components/message.tsx`             | Renders markdown answer text with streaming support, math (KaTeX), GFM, and citation linking |
| `components/answer-section.tsx`      | Renders the assistant's text answer with citation context, copy, and feedback actions        |
| `components/collapsible-message.tsx` | Wraps tool invocations in a collapsible container with header and status                     |
| `components/message-actions.tsx`     | Action bar below messages with copy, thumbs up/down, share, and regenerate buttons           |
| `components/action-buttons.tsx`      | Reusable action button row for message interactions                                          |
| `components/retry-button.tsx`        | Button to retry a failed or aborted message generation                                       |
| `components/chat-error.tsx`          | Inline error display for failed chat messages                                                |
| `components/chat-share.tsx`          | Dialog for sharing a chat via public link                                                    |
| `components/related-questions.tsx`   | Renders follow-up question suggestions after an answer                                       |
| `components/citation-context.tsx`    | React context provider supplying citation data to nested components                          |
| `components/citation-link.tsx`       | Inline citation link rendered within markdown text                                           |
| `components/custom-link.tsx`         | Custom markdown link component that handles citation-style references                        |
| `components/user-text-section.tsx`   | Renders user message text with file attachment indicators                                    |

### Search & Results Components

| File                                   | Purpose                                                                        |
| -------------------------------------- | ------------------------------------------------------------------------------ |
| `components/search-section.tsx`        | Renders search tool invocation with query, status indicator, and result counts |
| `components/search-results.tsx`        | Displays search result cards with title, URL, and snippet                      |
| `components/search-results-image.tsx`  | Image grid for search result images                                            |
| `components/search-mode-selector.tsx`  | Toggle selector for Chat vs Research search modes                              |
| `components/model-type-selector.tsx`   | Toggle selector for Speed vs Quality model types                               |
| `components/fetch-section.tsx`         | Renders fetch tool invocation showing URL being retrieved                      |
| `components/source-favicons.tsx`       | Row of favicon images for cited sources                                        |
| `components/video-search-results.tsx`  | Renders video search results with thumbnails                                   |
| `components/video-result-grid.tsx`     | Grid layout for video result cards                                             |
| `components/video-carousel-dialog.tsx` | Fullscreen dialog carousel for browsing video results                          |
| `components/data-section.tsx`          | Renders structured data tool output                                            |
| `components/section.tsx`               | Generic section wrapper with title and collapsible behavior                    |

### Process & Research Components

| File                                      | Purpose                                                                        |
| ----------------------------------------- | ------------------------------------------------------------------------------ |
| `components/research-process-section.tsx` | Renders the multi-step research process (plan, search, fetch steps)            |
| `components/process-header.tsx`           | Header for research process sections with step count                           |
| `components/process-rail.tsx`             | Vertical rail UI showing research step progression                             |
| `components/reasoning-section.tsx`        | Renders model reasoning/thinking output                                        |
| `components/tool-badge.tsx`               | Small badge showing tool name during invocation                                |
| `components/tool-section.tsx`             | Routes tool invocations to search, fetch, question, or todo section components |
| `components/tool-todo-display.tsx`        | Renders todo/task list tool output                                             |
| `components/todo-list-content.tsx`        | Renders todo list items with status indicators                                 |
| `components/dynamic-tool-display.tsx`     | Renders dynamic/MCP tool invocations via the tool UI registry                  |
| `components/question-confirmation.tsx`    | Renders the interactive question tool with selectable options                  |

### File & Upload Components

| File                                | Purpose                                                        |
| ----------------------------------- | -------------------------------------------------------------- |
| `components/file-upload-button.tsx` | Button that opens a file picker for uploading attachments      |
| `components/uploaded-file-list.tsx` | Displays list of uploaded files with status and remove actions |
| `components/attachment-preview.tsx` | Preview component for attached files (images, PDFs)            |
| `components/user-file-section.tsx`  | Renders user-uploaded file attachments in the message stream   |

### Feedback Components

| File                                 | Purpose                                                               |
| ------------------------------------ | --------------------------------------------------------------------- |
| `components/feedback-modal.tsx`      | Site-wide feedback modal with sentiment selection and free-text input |
| `components/external-link-items.tsx` | Menu items linking to external resources (GitHub, docs)               |
| `components/theme-menu-items.tsx`    | Theme switching menu items (light, dark, system)                      |

### Artifact Components

| File                                              | Purpose                                                                     |
| ------------------------------------------------- | --------------------------------------------------------------------------- |
| `components/artifact/artifact-root.tsx`           | Root wrapper providing ArtifactProvider and container                       |
| `components/artifact/artifact-context.tsx`        | React context for artifact panel state (open/close, active part)            |
| `components/artifact/artifact-content.tsx`        | Part type dispatcher routing to search, reasoning, todo, or generic content |
| `components/artifact/chat-artifact-container.tsx` | Resizable split layout between chat and artifact/inspector panel            |
| `components/artifact/tool-invocation-content.tsx` | Tool part dispatcher for search, fetch, and question tool artifacts         |
| `components/artifact/search-artifact-content.tsx` | Renders search results, images, and videos in the artifact panel            |
| `components/artifact/reasoning-content.tsx`       | Renders model reasoning text in the artifact panel                          |
| `components/artifact/todo-invocation-content.tsx` | Renders todo list output in the artifact panel                              |

### Inspector Components

| File                                        | Purpose                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `components/inspector/inspector-drawer.tsx` | Mobile drawer for the inspector panel using bottom sheet                 |
| `components/inspector/inspector-panel.tsx`  | Desktop panel showing artifact content (search, reasoning, todo details) |

### Sidebar Components

| File                                           | Purpose                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `components/sidebar/chat-menu-item.tsx`        | Individual chat item in the sidebar history with rename and delete actions |
| `components/sidebar/chat-history-client.tsx`   | Client component that fetches and renders paginated chat history           |
| `components/sidebar/chat-history-skeleton.tsx` | Skeleton placeholder for chat history loading state                        |
| `components/sidebar/clear-history-action.tsx`  | Action button to clear all chat history                                    |

### Tool UI Components

The `components/tool-ui/` directory contains generative UI components rendered by the AI agent's display tools. Each tool has an adapter, schema, and presentational component.

| File                              | Purpose                                                                       |
| --------------------------------- | ----------------------------------------------------------------------------- |
| `components/tool-ui/index.ts`     | Barrel export for all tool UI components and registry                         |
| `components/tool-ui/registry.tsx` | Tool UI registry mapping tool names to render functions via schema validation |

#### Callout Tool

| File                                      | Purpose                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `components/tool-ui/callout/index.ts`     | Barrel export for Callout component                              |
| `components/tool-ui/callout/_adapter.tsx` | Adapter re-exporting `cn` utility for Callout                    |
| `components/tool-ui/callout/callout.tsx`  | Styled callout box with variant-specific icons and color theming |
| `components/tool-ui/callout/schema.ts`    | Zod schema and serialization types for callout data              |

#### Citation Tool

| File                                            | Purpose                                                            |
| ----------------------------------------------- | ------------------------------------------------------------------ |
| `components/tool-ui/citation/index.ts`          | Barrel export for Citation and CitationList                        |
| `components/tool-ui/citation/_adapter.tsx`      | Adapter mapping displayCitations tool output to CitationList props |
| `components/tool-ui/citation/citation.tsx`      | Single citation card with favicon, title, snippet, and link        |
| `components/tool-ui/citation/citation-list.tsx` | Grid layout rendering multiple Citation cards                      |
| `components/tool-ui/citation/schema.ts`         | Zod schema and serialization types for citation data               |

#### Data Table Tool

| File                                           | Purpose                                                                                  |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `components/tool-ui/data-table/index.tsx`      | Barrel export for DataTable component                                                    |
| `components/tool-ui/data-table/_adapter.tsx`   | Adapter mapping displayTable tool output to DataTable props                              |
| `components/tool-ui/data-table/data-table.tsx` | Sortable, formatted data table with column headers and row data                          |
| `components/tool-ui/data-table/formatters.tsx` | Cell value formatters for number, currency, percent, date, link, badge, and rating types |
| `components/tool-ui/data-table/types.ts`       | TypeScript type definitions for data table structures                                    |
| `components/tool-ui/data-table/utilities.ts`   | Sorting, formatting, and column detection utilities                                      |
| `components/tool-ui/data-table/schema.ts`      | Zod schema and serialization types for data table data                                   |

#### Link Preview Tool

| File                                               | Purpose                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `components/tool-ui/link-preview/index.ts`         | Barrel export for LinkPreview component                             |
| `components/tool-ui/link-preview/_adapter.tsx`     | Adapter mapping displayLinkPreview tool output to LinkPreview props |
| `components/tool-ui/link-preview/link-preview.tsx` | Rich link preview card with image, title, description, and domain   |
| `components/tool-ui/link-preview/schema.ts`        | Zod schema and serialization types for link preview data            |

#### Option List Tool

| File                                             | Purpose                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `components/tool-ui/option-list/index.tsx`       | Barrel export for OptionList component                               |
| `components/tool-ui/option-list/_adapter.tsx`    | Adapter mapping displayOptionList tool output to OptionList props    |
| `components/tool-ui/option-list/option-list.tsx` | Interactive option list with single/multi select and submit behavior |
| `components/tool-ui/option-list/selection.ts`    | Selection state management helpers for option list                   |
| `components/tool-ui/option-list/schema.ts`       | Zod schema and serialization types for option list data              |

#### Plan Tool

| File                                   | Purpose                                                      |
| -------------------------------------- | ------------------------------------------------------------ |
| `components/tool-ui/plan/index.tsx`    | Barrel export for Plan and PlanCompact components            |
| `components/tool-ui/plan/_adapter.tsx` | Adapter mapping displayPlan tool output to Plan props        |
| `components/tool-ui/plan/plan.tsx`     | Plan display with step list, status indicators, and progress |
| `components/tool-ui/plan/progress.ts`  | Progress calculation utilities for plan steps                |
| `components/tool-ui/plan/schema.ts`    | Zod schema and serialization types for plan data             |

#### Timeline Tool

| File                                       | Purpose                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `components/tool-ui/timeline/index.ts`     | Barrel export for Timeline component                             |
| `components/tool-ui/timeline/_adapter.tsx` | Adapter re-exporting `cn` utility for Timeline                   |
| `components/tool-ui/timeline/timeline.tsx` | Vertical timeline with category-specific icons and color theming |
| `components/tool-ui/timeline/schema.ts`    | Zod schema and serialization types for timeline data             |

#### Shared Tool UI

| File                                                  | Purpose                                                   |
| ----------------------------------------------------- | --------------------------------------------------------- |
| `components/tool-ui/shared/index.ts`                  | Barrel export for shared tool UI utilities                |
| `components/tool-ui/shared/_adapter.tsx`              | Base adapter with shared parsing and error handling logic |
| `components/tool-ui/shared/contract.ts`               | Type contracts for tool UI adapter interface              |
| `components/tool-ui/shared/action-buttons.tsx`        | Shared action button component for tool cards             |
| `components/tool-ui/shared/actions-config.ts`         | Configuration for available tool card actions             |
| `components/tool-ui/shared/use-action-buttons.tsx`    | Hook for managing tool card action button state           |
| `components/tool-ui/shared/embedded-actions.ts`       | Utilities for embedded action handling in tool outputs    |
| `components/tool-ui/shared/parse.ts`                  | Safe JSON parsing utilities for tool output data          |
| `components/tool-ui/shared/schema.ts`                 | Shared Zod schema fragments used across tool UI schemas   |
| `components/tool-ui/shared/media/index.ts`            | Barrel export for media utilities                         |
| `components/tool-ui/shared/media/aspect-ratio.ts`     | Aspect ratio calculation for media elements               |
| `components/tool-ui/shared/media/format-utils.ts`     | Formatting utilities for media display                    |
| `components/tool-ui/shared/media/overlay-gradient.ts` | CSS gradient overlay generation for media cards           |
| `components/tool-ui/shared/media/safe-navigation.ts`  | Safe URL navigation with validation                       |
| `components/tool-ui/shared/media/sanitize-href.ts`    | URL sanitization to prevent XSS via href attributes       |

### UI Primitives

shadcn/ui-based primitives and custom UI components.

| File                                 | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `components/ui/index.ts`             | Barrel export for button, tooltip, and tooltip-button       |
| `components/ui/button.tsx`           | Button component with size and variant props                |
| `components/ui/tooltip.tsx`          | Tooltip component wrapping Radix UI Tooltip                 |
| `components/ui/tooltip-button.tsx`   | Button with integrated tooltip                              |
| `components/ui/alert-dialog.tsx`     | Confirmation dialog for destructive actions                 |
| `components/ui/avatar.tsx`           | User avatar with image and fallback                         |
| `components/ui/carousel.tsx`         | Embla-based carousel/slider component                       |
| `components/ui/checkbox.tsx`         | Checkbox input component                                    |
| `components/ui/collapsible.tsx`      | Radix UI Collapsible component                              |
| `components/ui/command.tsx`          | Command palette / combobox component                        |
| `components/ui/dialog.tsx`           | Modal dialog component                                      |
| `components/ui/drawer.tsx`           | Bottom sheet drawer component (Vaul)                        |
| `components/ui/hover-card.tsx`       | Hover-triggered card component                              |
| `components/ui/label.tsx`            | Form label component                                        |
| `components/ui/password-input.tsx`   | Password input with show/hide toggle                        |
| `components/ui/select.tsx`           | Dropdown select component                                   |
| `components/ui/sidebar.tsx`          | Sidebar layout component with collapse/expand support       |
| `components/ui/skeleton.tsx`         | Loading skeleton placeholder                                |
| `components/ui/slider.tsx`           | Range slider input component                                |
| `components/ui/sonner.tsx`           | Toast notification component (Sonner)                       |
| `components/ui/spinner.tsx`          | Loading spinner animation                                   |
| `components/ui/status-indicator.tsx` | Animated status dot indicator                               |
| `components/ui/switch.tsx`           | Toggle switch component                                     |
| `components/ui/toggle.tsx`           | Toggle button component                                     |
| `components/ui/animated-logo.tsx`    | Animated Polymorph logo displayed during loading states     |
| `components/ui/icons.tsx`            | Custom SVG icon components (Polymorph logo, provider logos) |

---

## Core Library

### Agents

| File                                             | Purpose                                                                                                             |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `lib/agents/researcher.ts`                       | Creates the ToolLoopAgent with search/fetch/display tools; configures Chat (20 steps) and Research (50 steps) modes |
| `lib/agents/title-generator.ts`                  | Generates concise 3-5 word chat titles using an LLM                                                                 |
| `lib/agents/generate-related-questions.ts`       | Streams 3 follow-up question suggestions using structured output                                                    |
| `lib/agents/prompts/search-mode-prompts.ts`      | System prompts for Chat mode and Research mode search behaviors                                                     |
| `lib/agents/prompts/related-questions-prompt.ts` | System prompt for related question generation                                                                       |

### Tools

| File                                | Purpose                                                                                          |
| ----------------------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/tools/search.ts`               | Multi-provider search tool with streaming progress; supports general and optimized search types  |
| `lib/tools/fetch.ts`                | Web content extraction tool; supports regular HTML fetch and API-based extraction (Jina, Tavily) |
| `lib/tools/question.ts`             | Clarifying question tool; presents options to the user for frontend confirmation                 |
| `lib/tools/todo.ts`                 | Task list management tool; creates and updates structured todo items                             |
| `lib/tools/display-citations.ts`    | Display tool that renders a formatted citation list                                              |
| `lib/tools/display-link-preview.ts` | Display tool that renders a rich link preview card                                               |
| `lib/tools/display-plan.ts`         | Display tool that renders a step-by-step research plan                                           |
| `lib/tools/display-table.ts`        | Display tool that renders a formatted data table with column types                               |
| `lib/tools/display-option-list.ts`  | Display tool that renders an interactive option list for user selection                          |
| `lib/tools/display-callout.ts`      | Display tool that renders a styled callout box with variant-specific icons and colors            |
| `lib/tools/display-timeline.ts`     | Display tool that renders a chronological event timeline with category styling                   |
| `lib/tools/dynamic.ts`              | Factory for creating runtime-defined tools (MCP tools, user-defined functions)                   |

### Search Providers

| File                                      | Purpose                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `lib/tools/search/providers/index.ts`     | Provider factory; creates search provider instances by type (Tavily, Brave, Exa, SearXNG, Firecrawl) |
| `lib/tools/search/providers/base.ts`      | Abstract base class and interface for search providers                                               |
| `lib/tools/search/providers/tavily.ts`    | Tavily search provider; primary provider for web search with image support                           |
| `lib/tools/search/providers/brave.ts`     | Brave Search provider; used for multimedia (video, image, news) content                              |
| `lib/tools/search/providers/exa.ts`       | Exa search provider; neural search with content extraction                                           |
| `lib/tools/search/providers/firecrawl.ts` | Firecrawl search provider; web, news, and image search via Firecrawl API                             |
| `lib/tools/search/providers/searxng.ts`   | SearXNG search provider; self-hosted meta-search engine integration                                  |

### Streaming

| File                                                     | Purpose                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `lib/streaming/create-chat-stream-response.ts`           | Authenticated chat streaming; handles message persistence, title generation, context pruning, and related questions |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Guest/anonymous chat streaming; no persistence, context pruning only                                                |
| `lib/streaming/types.ts`                                 | TypeScript interfaces for stream configuration (BaseStreamConfig)                                                   |
| `lib/streaming/helpers/prepare-messages.ts`              | Prepares messages for streaming by loading chat history and handling new/existing chats                             |
| `lib/streaming/helpers/persist-stream-results.ts`        | Persists streamed response messages and chat title to the database                                                  |
| `lib/streaming/helpers/stream-related-questions.ts`      | Generates and streams related follow-up questions alongside the main response                                       |
| `lib/streaming/helpers/strip-reasoning-parts.ts`         | Strips reasoning parts from messages to avoid OpenAI API compatibility issues                                       |
| `lib/streaming/helpers/types.ts`                         | TypeScript interfaces for streaming context (StreamContext)                                                         |

### Database

| File                  | Purpose                                                                                          |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/db/schema.ts`    | Drizzle schema defining `chats`, `messages`, `parts`, and `feedback` tables with RLS policies    |
| `lib/db/index.ts`     | Database client initialization with connection pooling, SSL config, and restricted user support  |
| `lib/db/relations.ts` | Drizzle relation definitions (chats -> messages -> parts)                                        |
| `lib/db/actions.ts`   | Database CRUD operations (create/load/update/delete chats, messages, parts) with RLS enforcement |
| `lib/db/with-rls.ts`  | RLS helper that sets `app.current_user_id` in PostgreSQL session for row-level security          |
| `lib/db/migrate.ts`   | Standalone migration runner script using Drizzle Kit                                             |

### Server Actions

| File                           | Purpose                                                                        |
| ------------------------------ | ------------------------------------------------------------------------------ |
| `lib/actions/chat.ts`          | Server actions for chat operations with `unstable_cache` and revalidation tags |
| `lib/actions/feedback.ts`      | Server action to update message feedback score in the database and Langfuse    |
| `lib/actions/site-feedback.ts` | Server action to submit site-wide user feedback (sentiment + message)          |

### Schema (Zod)

| File                     | Purpose                                                                    |
| ------------------------ | -------------------------------------------------------------------------- |
| `lib/schema/search.tsx`  | Zod schema for search tool input (query, type, content_types, max_results) |
| `lib/schema/fetch.tsx`   | Zod schema for fetch tool input (url, type)                                |
| `lib/schema/question.ts` | Zod schema for question tool input (question, options, allowInput)         |
| `lib/schema/related.tsx` | Zod schema for related questions output (array of 3 questions)             |

### Types

| File                               | Purpose                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `lib/types/index.ts`               | Core type definitions for SearchResults, SearchResultItem, SearXNG types, and UploadedFile |
| `lib/types/search.ts`              | SearchMode type definition (`'chat' \| 'research'`)                                        |
| `lib/types/models.ts`              | Model interface (id, name, provider, providerId, providerOptions)                          |
| `lib/types/model-type.ts`          | ModelType definition (`'speed' \| 'quality'`)                                              |
| `lib/types/agent.ts`               | ResearcherTools type, ResearcherAgent alias, and per-tool UIToolInvocation types           |
| `lib/types/ai.ts`                  | Extended AI SDK types: UIMessage, UIMessageMetadata, UITools, UIDataTypes, Part, ToolPart  |
| `lib/types/dynamic-tools.ts`       | Type definitions for MCP client, dynamic tool configuration, and DynamicToolPart variants  |
| `lib/types/message-persistence.ts` | Database message part types (DBMessagePart, ToolState) and metadata schemas                |

### Config

| File                               | Purpose                                                                              |
| ---------------------------------- | ------------------------------------------------------------------------------------ |
| `lib/config/model-types.ts`        | Retrieves model assignments by search mode and model type from JSON config           |
| `lib/config/load-models-config.ts` | Loads and validates model configuration from JSON files (default.json, cloud.json)   |
| `lib/config/search-modes.ts`       | Search mode UI configuration (Chat and Research labels, descriptions, icons, colors) |
| `lib/config/ollama-validator.ts`   | Validates configured Ollama models are available and compatible on server startup    |

### Auth

| File                           | Purpose                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------- |
| `lib/auth/get-current-user.ts` | Gets current authenticated user from Supabase; supports auth-disabled mode for personal deployments |

### Supabase

| File                         | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `lib/supabase/client.ts`     | Browser-side Supabase client using `createBrowserClient`                         |
| `lib/supabase/server.ts`     | Server-side Supabase client using `createServerClient` with cookie-based session |
| `lib/supabase/middleware.ts` | Middleware helper that refreshes Supabase auth session on each request           |
| `lib/supabase/storage.ts`    | Uploads files to Supabase Storage bucket with sanitized file paths               |

### Rate Limiting

| File                            | Purpose                                                                         |
| ------------------------------- | ------------------------------------------------------------------------------- |
| `lib/rate-limit/guest-limit.ts` | Guest user daily rate limiting via Upstash Redis (default 10/day)               |
| `lib/rate-limit/chat-limits.ts` | Authenticated user daily chat rate limiting via Upstash Redis (default 100/day) |

### Analytics

| File                                | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `lib/analytics/index.ts`            | Barrel export for analytics module (trackChatEvent, calculateConversationTurn) |
| `lib/analytics/types.ts`            | Type definitions for ChatEventData and AnalyticsProvider interface             |
| `lib/analytics/track-chat-event.ts` | Tracks chat events to Vercel Analytics (cloud deployments only)                |
| `lib/analytics/utils.ts`            | Calculates conversation turn number from message history                       |

### Utils

| File                           | Purpose                                                                                 |
| ------------------------------ | --------------------------------------------------------------------------------------- |
| `lib/utils/index.ts`           | Core utilities: `generateUUID`, `cn` (classname merger), `sanitizeUrl`, `createModelId` |
| `lib/utils/registry.ts`        | AI provider registry wrapping OpenAI, Anthropic, Google, Ollama, and Vercel AI Gateway  |
| `lib/utils/model-selection.ts` | Resolves the appropriate model based on search mode and model type cookie preferences   |
| `lib/utils/context-window.ts`  | Token counting, context window management, and message truncation using tiktoken        |
| `lib/utils/citation.ts`        | Citation extraction, processing, and mapping from search results to inline references   |
| `lib/utils/message-mapping.ts` | Bidirectional mapping between AI SDK UIMessage format and database message/part records |
| `lib/utils/message-utils.ts`   | Helpers for extracting text content from message parts                                  |
| `lib/utils/domain.ts`          | Extracts display-friendly domain name from URLs (e.g., "google" from "www.google.com")  |
| `lib/utils/url.ts`             | Constructs base URL from Next.js request headers (x-forwarded-proto, x-host)            |
| `lib/utils/cookies.ts`         | Client-side cookie get/set/remove utilities                                             |
| `lib/utils/search-config.ts`   | Environment-aware search provider configuration and tool description generation         |
| `lib/utils/retry.ts`           | Exponential backoff retry utility for database operations                               |
| `lib/utils/perf-logging.ts`    | Conditional performance logging (enabled via `ENABLE_PERF_LOGGING`)                     |
| `lib/utils/perf-tracking.ts`   | Development-only counters for auth calls and DB operations                              |
| `lib/utils/telemetry.ts`       | Checks if Langfuse tracing is enabled via environment variable                          |

### External Clients

| File                      | Purpose                                                        |
| ------------------------- | -------------------------------------------------------------- |
| `lib/firecrawl/index.ts`  | Barrel export for Firecrawl client and types                   |
| `lib/firecrawl/client.ts` | Firecrawl API client for web search and image search           |
| `lib/firecrawl/types.ts`  | Type definitions for Firecrawl API requests and responses      |
| `lib/ollama/client.ts`    | Ollama API client for listing models and checking capabilities |
| `lib/ollama/types.ts`     | Type definitions for Ollama model responses and capabilities   |

### Lib Hooks

| File                                 | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `lib/hooks/use-copy-to-clipboard.ts` | Hook for copying text to clipboard with timeout-based reset |
| `lib/hooks/use-media-query.ts`       | Hook for tracking CSS media query match state               |

### Constants

| File                     | Purpose                                      |
| ------------------------ | -------------------------------------------- |
| `lib/constants/index.ts` | Application constants (`CHAT_ID = 'search'`) |

---

## Top-Level Hooks

| File                              | Purpose                                                                   |
| --------------------------------- | ------------------------------------------------------------------------- |
| `hooks/use-mobile.tsx`            | Hook detecting mobile viewport (< 768px breakpoint)                       |
| `hooks/use-auth-check.tsx`        | Hook checking Supabase auth state and subscribing to auth changes         |
| `hooks/use-current-user-name.ts`  | Hook fetching the current user's display name from Supabase session       |
| `hooks/use-current-user-image.ts` | Hook fetching the current user's avatar URL from Supabase session         |
| `hooks/use-file-dropzone.ts`      | Hook managing file drag-and-drop, validation, and upload to `/api/upload` |

---

## Config Files

| File                         | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `config/models/default.json` | Default model configuration mapping search modes and model types to AI models    |
| `config/models/cloud.json`   | Cloud deployment model configuration with production-optimized model assignments |

---

## Scripts

| File                  | Purpose                                                        |
| --------------------- | -------------------------------------------------------------- |
| `scripts/chat-cli.ts` | CLI script for testing the chat API endpoint from the terminal |
| `scripts/README.md`   | Documentation for available scripts                            |

---

## Database Migrations

The `drizzle/` directory contains Drizzle ORM migration files and snapshots.

| File                                                     | Purpose                                              |
| -------------------------------------------------------- | ---------------------------------------------------- |
| `drizzle/schema.ts`                                      | Drizzle schema re-export (used by Drizzle Kit)       |
| `drizzle/relations.ts`                                   | Drizzle relations re-export (used by Drizzle Kit)    |
| `drizzle/0000_black_lifeguard.sql`                       | Initial migration: creates chats, messages tables    |
| `drizzle/0001_thin_supreme_intelligence.sql`             | Adds visibility column to chats                      |
| `drizzle/0002_material_crystal.sql`                      | Adds parts table for structured message storage      |
| `drizzle/0003_heavy_whirlwind.sql`                       | Adds indexes for query performance                   |
| `drizzle/0004_natural_wallow.sql`                        | Adds feedback metadata to messages                   |
| `drizzle/0005_awesome_riptide.sql`                       | Adds RLS policies for multi-user security            |
| `drizzle/0006_brainy_wrecking_crew.sql`                  | Refines RLS policies and adds public chat visibility |
| `drizzle/0007_illegal_mephistopheles.sql`                | Adds file attachment columns to parts                |
| `drizzle/0008_glamorous_riptide.sql`                     | Adds check constraints for part type validation      |
| `drizzle/0009_thankful_may_parker.sql`                   | Adds feedback table for site-wide feedback           |
| `drizzle/0010_lonely_kang.sql`                           | Adds metadata and search mode columns                |
| `drizzle/meta/_journal.json`                             | Migration journal tracking applied migrations        |
| `drizzle/meta/0000_snapshot.json` - `0010_snapshot.json` | Schema snapshots for each migration                  |

---

## Supabase Config

| File                   | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `supabase/config.toml` | Supabase CLI local development configuration (ports, auth settings) |
| `supabase/.gitignore`  | Ignores Supabase CLI generated files                                |

---

## Documentation

| File                                | Purpose                                                                                                                                   |
| ----------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/ARCHITECTURE.md`              | System architecture with diagrams for agent pipeline, streaming, DB schema, and UI component tree                                         |
| `docs/API.md`                       | API endpoint reference for chat, chats, feedback, upload, and advanced-search routes                                                      |
| `docs/GENERATIVE-UI.md`             | Generative UI system architecture; display tools, Tool UI registry, adapter pattern, schema validation, and adding new tools              |
| `docs/RESEARCH-AGENT.md`            | Research agent deep technical reference; ToolLoopAgent pattern, search modes, tool system, model selection, and context window management |
| `docs/CONFIGURATION.md`             | Configuration guide for models, search providers, and feature flags                                                                       |
| `docs/DEPLOYMENT.md`                | Deployment guide for Vercel, Docker, and self-hosted setups                                                                               |
| `docs/DOCKER.md`                    | Docker-specific setup and configuration instructions                                                                                      |
| `docs/ENVIRONMENT.md`               | Complete environment variable reference                                                                                                   |
| `docs/MODEL-CONFIGURATION.md`       | Guide for configuring AI model profiles (default, cloud, Ollama)                                                                          |
| `docs/SEARCH-PROVIDERS.md`          | Search provider setup guide (Tavily, Brave, Exa, Firecrawl, SearXNG)                                                                      |
| `docs/STREAMING.md`                 | Streaming architecture and SSE protocol documentation                                                                                     |
| `docs/TROUBLESHOOTING.md`           | Common issues and debugging guide                                                                                                         |
| `docs/DECISIONS.md`                 | Architectural decision records (ADRs)                                                                                                     |
| `docs/runbooks/day-2-operations.md` | Operational runbook for monitoring, maintenance, and incident response                                                                    |

---

## GitHub

| File                                         | Purpose                                                                  |
| -------------------------------------------- | ------------------------------------------------------------------------ |
| `.github/workflows/ci.yml`                   | CI workflow: runs lint, typecheck, and tests on push/PR to main          |
| `.github/workflows/release.yml`              | Release workflow: creates GitHub releases on version tags                |
| `.github/workflows/docker-build.yml`         | Docker build workflow: builds and pushes container image on push to main |
| `.github/ISSUE_TEMPLATE/bug_report.yml`      | Bug report issue template                                                |
| `.github/ISSUE_TEMPLATE/feature_request.yml` | Feature request issue template                                           |
| `.github/PULL_REQUEST_TEMPLATE.md`           | Pull request template with checklist                                     |

---

## Public Assets

| File                                  | Purpose                                              |
| ------------------------------------- | ---------------------------------------------------- |
| `public/images/vana-v-mark.png`       | Polymorph "V" mark logo                              |
| `public/images/vana-wordmark.png`     | Polymorph full wordmark logo                         |
| `public/images/vana-v-48.png`         | 48px Polymorph icon for sidebar collapsed state      |
| `public/images/vana-icon-512.png`     | 512px Polymorph icon for PWA                         |
| `public/images/placeholder-image.png` | Placeholder image for missing thumbnails             |
| `public/screenshot-2026-02-07.png`    | Application screenshot for README and social sharing |

---

## Tests

Test files are co-located with their source files using `__tests__/` directories.

| File                                                                    | Purpose                                          |
| ----------------------------------------------------------------------- | ------------------------------------------------ |
| `app/api/feedback/__tests__/route.test.ts`                              | Tests for the feedback API route                 |
| `components/__tests__/research-process-section.test.tsx`                | Tests for the research process section component |
| `lib/utils/__tests__/citation.test.ts`                                  | Tests for citation extraction and processing     |
| `lib/utils/__tests__/context-window.test.ts`                            | Tests for token counting and message truncation  |
| `lib/utils/__tests__/domain.test.ts`                                    | Tests for domain name extraction                 |
| `lib/utils/__tests__/model-selection.test.ts`                           | Tests for model resolution logic                 |
| `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts` | Tests for ephemeral streaming                    |
| `lib/streaming/__tests__/prune-messages-integration.test.ts`            | Integration tests for message pruning            |
| `lib/streaming/helpers/__tests__/prepare-messages.test.ts`              | Tests for message preparation                    |
| `lib/actions/__tests__/feedback.test.ts`                                | Tests for feedback server actions                |
| `lib/actions/__tests__/chat.test.ts`                                    | Tests for chat server actions                    |
| `lib/db/__tests__/rls-policies.integration.test.ts`                     | Integration tests for RLS policy enforcement     |
| `lib/db/__tests__/with-rls.test.ts`                                     | Tests for RLS helper functions                   |
| `lib/rate-limit/__tests__/guest-limit.test.ts`                          | Tests for guest rate limiting logic              |

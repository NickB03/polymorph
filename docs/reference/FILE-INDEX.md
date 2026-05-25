# File Index

> **Audience:** Contributor
> **See also:** [Architecture Overview](../architecture/OVERVIEW.md) for high-level context

Comprehensive index of every file in the Polymorph repository, organized by directory. Each entry includes the file path and a one-line description.

## Table of Contents

- [Root Files](#root-files)
- [App Routes](#app-routes)
- [Components](#components)
  - [Core Components](#core-components)
  - [Auth Components](#auth-components)
  - [Message & Chat Components](#message--chat-components)
  - [Search & Results Components](#search--results-components)
  - [Motion Components](#motion-components)
  - [Canvas Components](#canvas-components)
  - [Inspector Components](#inspector-components)
  - [Sidebar Components](#sidebar-components)
  - [Activity Components](#activity-components)
  - [Voice Components](#voice-components)
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
  - [Voice](#voice)
  - [Motion](#motion)
  - [Utils](#utils)
  - [External Clients](#external-clients)
  - [Lib Hooks](#lib-hooks)
  - [Constants](#constants)
  - [Canvas](#canvas)
- [Top-Level Hooks](#top-level-hooks)
- [Config Files](#config-files)
- [Scripts](#scripts)
- [Database Migrations](#database-migrations)
- [Supabase](#supabase-config)
- [Documentation](#documentation)
- [GitHub](#github)
- [Public Assets](#public-assets)
- [Evals Service](#evals-service)
- [Tests](#tests)

---

## Root Files

| File                  | Purpose                                                                                                                                    |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `proxy.ts`            | Next.js middleware entry point; propagates Supabase session and base URL headers to downstream requests                                    |
| `instrumentation.ts`  | Registers OpenTelemetry with Phoenix exporter (HTTPS enforced via `isProductionTarget()`); initializes Ollama validation on server startup |
| `next.config.mjs`     | Next.js configuration; sets allowed remote image patterns for YouTube, Google, and Brave                                                   |
| `drizzle.config.ts`   | Drizzle Kit configuration; points schema at `@/lib/db/schema.ts` and outputs migrations to `drizzle/`                                      |
| `vitest.config.mts`   | Vitest configuration; sets jsdom environment, path aliases, and setup file                                                                 |
| `vitest.setup.ts`     | Test setup file; mocks Next.js cache functions and sets dummy env vars                                                                     |
| `package.json`        | Project manifest with scripts, dependencies, and metadata                                                                                  |
| `tsconfig.json`       | TypeScript configuration with strict mode and `@/` path alias                                                                              |
| `postcss.config.mjs`  | PostCSS configuration for Tailwind CSS                                                                                                     |
| `prettier.config.js`  | Prettier configuration (no semicolons, single quotes, no trailing commas)                                                                  |
| `components.json`     | shadcn/ui configuration for component generation                                                                                           |
| `docker-compose.yaml` | Docker Compose stack defining Polymorph app and Redis services                                                                             |
| `Dockerfile`          | Multi-stage Docker build for production deployment                                                                                         |
| `.gitignore`          | Git ignore rules for node_modules, .next, env files, etc.                                                                                  |
| `.mcp.json`           | MCP (Model Context Protocol) configuration                                                                                                 |
| `eslint.config.mjs`   | ESLint 9 flat config (replaces `.eslintrc.json`); Next 16 compatible, import sort rules, shared ignores                                    |
| `vercel.json`         | Vercel project config; declares the daily cron `GET /api/suggestions/refresh` at `0 14 * * *`                                              |
| `CLAUDE.md`           | AI coding assistant instructions and project conventions                                                                                   |
| `GEMINI.md`           | Gemini-specific AI assistant instructions                                                                                                  |
| `README.md`           | Project overview, setup guide, and feature summary                                                                                         |
| `CHANGELOG.md`        | Version history and release notes                                                                                                          |
| `CONTRIBUTING.md`     | Contribution guidelines and development workflow                                                                                           |
| `CODE_OF_CONDUCT.md`  | Community code of conduct                                                                                                                  |
| `SECURITY.md`         | Security policy and vulnerability reporting                                                                                                |
| `LICENSE`             | Apache 2.0 license                                                                                                                         |

---

## App Routes

The App Router is split into two route groups (`(chat)/` and `(admin)/`) plus non-grouped `api/` and `auth/` trees. Route groups don't affect the URL; they isolate layouts and access-control boundaries.

### Root + shared

| File                      | Purpose                                                                                     |
| ------------------------- | ------------------------------------------------------------------------------------------- |
| `app/layout.tsx`          | Root layout with font loading, theme provider, sidebar, header, canvas shell, and analytics |
| `app/globals.css`         | Global CSS with Tailwind directives and custom theme variables                              |
| `app/manifest.ts`         | PWA manifest with app name, icons, and display settings                                     |
| `app/favicon.ico`         | Browser favicon                                                                             |
| `app/icon.png`            | 192px app icon for PWA                                                                      |
| `app/apple-icon.png`      | Apple touch icon                                                                            |
| `app/opengraph-image.png` | OpenGraph social sharing image                                                              |
| `app/error.tsx`           | Global error boundary page with retry button                                                |

### `(chat)` route group — default shell

| File                                       | URL                     | Purpose                                                                                                      |
| ------------------------------------------ | ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| `app/(chat)/layout.tsx`                    | —                       | Shell layout for the default chat surface                                                                    |
| `app/(chat)/page.tsx`                      | `/`                     | Home page; resolves current user and renders the Chat component                                              |
| `app/(chat)/search/page.tsx`               | `/search`               | Search page; reads `?q=` query param, generates a chat ID, and renders Chat with initial query               |
| `app/(chat)/search/[id]/page.tsx`          | `/search/[id]`          | Existing chat page; loads chat by ID from database, generates metadata, and renders Chat with saved messages |
| `app/(chat)/search/loading.tsx`            | —                       | Loading skeleton shown during search page transitions                                                        |
| `app/(chat)/demo/question-wizard/page.tsx` | `/demo/question-wizard` | Demo route for the `displayQuestionWizard` generative UI tool                                                |

### `(admin)` route group — admin surface

| File                                  | URL            | Purpose                                                                                                                                                         |
| ------------------------------------- | -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/(admin)/layout.tsx`              | —              | Admin layout: `force-dynamic`; redirects unauthenticated users to `/auth/login`, then calls `notFound()` unless the session matches `ADMIN_USER_ID`             |
| `app/(admin)/admin/evals/page.tsx`    | `/admin/evals` | Evals dashboard v2 — "Suites" and "Run history" views with per-suite drilldown; URL state via `?view=` and `?suite=`; evaluator breakdown and comparison panels |
| `app/(admin)/admin/evals/loading.tsx` | —              | Loading state for the evals dashboard                                                                                                                           |

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

| File                                   | Purpose                                                                                                                                                                             |
| -------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app/api/chat/route.ts`                | Main chat endpoint (POST, 300s timeout); handles auth, rate limiting, model selection, and delegates to authenticated or ephemeral stream responses                                 |
| `app/api/chats/route.ts`               | Chat history endpoint (GET); returns paginated list of user chats                                                                                                                   |
| `app/api/feedback/route.ts`            | Feedback endpoint (POST); records thumbs up/down scores and updates message metadata                                                                                                |
| `app/api/upload/route.ts`              | File upload endpoint (POST); validates file type/size and uploads to Supabase Storage                                                                                               |
| `app/api/advanced-search/route.ts`     | SearXNG advanced search endpoint (POST); performs cached deep-crawl searches with relevance scoring                                                                                 |
| `app/api/suggestions/route.ts`         | Trending suggestions endpoint; reads the `trending_suggestions_cache` singleton and blends dynamic suggestions with static rotation                                                 |
| `app/api/suggestions/refresh/route.ts` | Vercel cron target (GET, 60s timeout); Bearer-auth via `CRON_SECRET`; regenerates trending suggestions and upserts the singleton cache row                                          |
| `app/api/voice/synthesize/route.ts`    | TTS synthesis endpoint (POST); synthesizes text to speech via OpenAI or ElevenLabs                                                                                                  |
| `app/api/health/route.ts`              | Health check endpoint; returns server status and database connectivity for monitoring                                                                                               |
| `app/api/evals/run/route.ts`           | Secret-authenticated eval runner endpoint (POST); replays capability, regression, smoke, and traffic-monitor conversations through the researcher pipeline without chat persistence |

### Canvas API Routes

| File                                                                 | Purpose                                                                                     |
| -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `app/api/canvas-artifacts/[artifactId]/route.ts`                     | Load canvas artifact state (GET); supports Supabase auth and guest token                    |
| `app/api/canvas-artifacts/[artifactId]/draft/route.ts`               | Update draft source with optimistic concurrency (PATCH); compiles via esbuild + Tailwind v4 |
| `app/api/canvas-artifacts/[artifactId]/versions/route.ts`            | Create immutable version snapshot of the current draft (POST)                               |
| `app/api/canvas-artifacts/[artifactId]/restore/route.ts`             | Restore a previous version as the current draft (POST); uses optimistic concurrency         |
| `app/api/canvas-artifacts/[artifactId]/export/route.ts`              | Export compiled HTML as a downloadable `.html` file attachment (GET)                        |
| `app/api/canvas-artifacts/[artifactId]/runtime-diagnostics/route.ts` | Persist runtime diagnostics (errors, warnings) from the preview iframe (POST)               |
| `app/api/canvas-artifacts/[artifactId]/view/route.ts`                | Serve compiled HTML for inline embedding or preview (GET)                                   |
| `app/api/canvas-assets/image-proxy/route.ts`                         | Proxy image search results for canvas artifacts via Brave; SSRF-safe redirect (GET)         |

---

## Components

### Core Components

| File                                | Purpose                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `components/chat.tsx`               | Main chat orchestrator; manages `useChat`, file uploads, message sections, and error handling |
| `components/chat-messages.tsx`      | Renders the scrollable message list, grouped into user/assistant sections                     |
| `components/chat-panel.tsx`         | Chat input panel with textarea, send/stop buttons, three-mode selector, and file upload       |
| `components/chat-request.ts`        | Chat request utilities including guest canvas token extraction from messages                  |
| `components/render-message.tsx`     | Routes each message part to the appropriate section renderer (text, tool, dynamic tool)       |
| `components/polymorph-wordmark.tsx` | Animated Polymorph wordmark with rotating suffix words                                        |
| `components/header.tsx`             | Top navigation bar with sidebar trigger, feedback button, and user/guest menu                 |
| `components/app-sidebar.tsx`        | Application sidebar with logo, new chat button, and chat history                              |
| `components/theme-provider.tsx`     | Wraps `next-themes` ThemeProvider for dark/light mode support                                 |
| `components/drag-overlay.tsx`       | Full-screen overlay shown during file drag-and-drop                                           |
| `components/error-modal.tsx`        | Modal dialog displaying chat error details                                                    |
| `components/default-skeleton.tsx`   | Skeleton loading placeholders for search and message sections                                 |

### Auth Components

| File                                  | Purpose                                                               |
| ------------------------------------- | --------------------------------------------------------------------- |
| `components/login-form.tsx`           | Login form with email/password fields and OAuth providers             |
| `components/sign-up-form.tsx`         | Sign-up form with name, email, password fields                        |
| `components/forgot-password-form.tsx` | Forgot password form for email-based password reset                   |
| `components/update-password-form.tsx` | Password update form for setting a new password                       |
| `components/auth-modal.tsx`           | Modal prompting unauthenticated users to sign in                      |
| `components/guest-menu.tsx`           | Dropdown menu for guest users with sign-in option                     |
| `components/guest-signup-nudge.tsx`   | Inline nudge encouraging guest users to sign up after repeated use    |
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
| `components/mode-selector.tsx`         | Three-mode selector for Search, Research, and Build with animated active pill  |
| `components/fetch-section.tsx`         | Renders fetch tool invocation showing URL being retrieved                      |
| `components/source-favicons.tsx`       | Row of favicon images for cited sources                                        |
| `components/video-search-results.tsx`  | Renders video search results with thumbnails                                   |
| `components/video-result-grid.tsx`     | Grid layout for video result cards                                             |
| `components/video-carousel-dialog.tsx` | Fullscreen dialog carousel for browsing video results                          |
| `components/data-section.tsx`          | Renders structured data tool output                                            |
| `components/section.tsx`               | Generic section wrapper with title and collapsible behavior                    |

### Motion Components

Shared motion primitives used by the chat and Tool UI surfaces.

| File                                    | Purpose                                                               |
| --------------------------------------- | --------------------------------------------------------------------- |
| `components/motion/tool-card-mount.tsx` | Mount wrapper that animates only newly streamed tool cards            |
| `components/motion/pill-presence.tsx`   | AnimatePresence wrapper for the active mode pill in the mode selector |
| `components/motion/stagger-list.tsx`    | Ordered-list wrapper with capped child staggering for long timelines  |

### Process & Research Components

| File                                      | Purpose                                                             |
| ----------------------------------------- | ------------------------------------------------------------------- |
| `components/research-process-section.tsx` | Renders the multi-step research process (plan, search, fetch steps) |
| `components/research-plan.tsx`            | Renders the research plan using the Plan tool UI component          |
| `components/research-status-line.tsx`     | Status line showing research mode with streaming indicator          |
| `components/process-header.tsx`           | Header for research process sections with step count                |
| `components/process-rail.tsx`             | Vertical rail UI showing research step progression                  |
| `components/reasoning-section.tsx`        | Renders model reasoning/thinking output                             |
| `components/tool-badge.tsx`               | Small badge showing tool name during invocation                     |
| `components/tool-section.tsx`             | Routes tool invocations to search or fetch section components       |
| `components/todo-list-content.tsx`        | Renders todo list items with status indicators                      |
| `components/dynamic-tool-display.tsx`     | Renders dynamic/MCP tool invocations via the tool UI registry       |

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

### Canvas Components

| File                                             | Purpose                                                                             |
| ------------------------------------------------ | ----------------------------------------------------------------------------------- |
| `components/canvas/canvas-root.tsx`              | Provider + shell wrapper that mounts the canvas workspace                           |
| `components/canvas/canvas-context.tsx`           | React context for canvas artifact state, draft updates, and version management      |
| `components/canvas/chat-canvas-shell.tsx`        | Resizable split-pane layout (desktop + mobile) containing chat and canvas workspace |
| `components/canvas/canvas-workspace.tsx`         | Main workspace with Preview, Code, and Diagnostics tabs                             |
| `components/canvas/canvas-preview.tsx`           | Live preview rendering compiled HTML via `iframe.srcdoc`                            |
| `components/canvas/canvas-editor.tsx`            | CodeMirror 6 editor for viewing and editing canvas artifact source                  |
| `components/canvas/canvas-diagnostics-panel.tsx` | Panel displaying runtime errors and warnings from the preview iframe                |
| `components/canvas/canvas-version-history.tsx`   | Version history panel with save, restore, and version listing                       |

### Inspector Components

| File                                        | Purpose                                                                   |
| ------------------------------------------- | ------------------------------------------------------------------------- |
| `components/inspector/inspector-drawer.tsx` | Mobile drawer for the inspector panel using bottom sheet                  |
| `components/inspector/inspector-panel.tsx`  | Desktop panel showing inspector content (search, reasoning, todo details) |

### Sidebar Components

| File                                           | Purpose                                                                    |
| ---------------------------------------------- | -------------------------------------------------------------------------- |
| `components/sidebar/chat-menu-item.tsx`        | Individual chat item in the sidebar history with rename and delete actions |
| `components/sidebar/chat-history-client.tsx`   | Client component that fetches and renders paginated chat history           |
| `components/sidebar/chat-history-skeleton.tsx` | Skeleton placeholder for chat history loading state                        |

### Activity Components

| File                                           | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `components/activity/activity-root.tsx`        | Root wrapper providing ActivityProvider                     |
| `components/activity/activity-context.tsx`     | React context for activity feed state and event dispatching |
| `components/activity/activity-panel.tsx`       | Desktop panel showing real-time search and fetch activity   |
| `components/activity/activity-drawer.tsx`      | Mobile drawer for the activity feed using bottom sheet      |
| `components/activity/activity-search-item.tsx` | Renders a search event item in the activity feed            |
| `components/activity/activity-fetch-item.tsx`  | Renders a fetch event item in the activity feed             |

### Admin Components

| File                                      | Purpose                                                                                                 |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| `components/admin/admin-sidebar.tsx`      | Admin surface sidebar navigation (evals enabled; feedback / traffic / users / flags / settings stubbed) |
| `components/admin/admin-sidebar.test.tsx` | Tests for the admin sidebar nav items and active-state highlighting                                     |

### Evals Dashboard Components

The dashboard tree has three sibling directories: `dashboard-v2/` (current IA — "Evaluation Summary" with Suites/Run history views and per-suite drilldown), `dashboard/` (legacy primitives reused by v2), and `glossary/` (term-rendering helpers used in tooltips and label cells).

| File                                                       | Purpose                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `components/evals/dashboard-v2/dashboard.tsx`              | Top-level orchestrator: handles the empty-state branch, owns the `TooltipProvider` wrap and CSS-driven enter animations, routes Suites/History via `?view=`, drills into a chosen suite via `?suite=`, defaults to the latest attention suite when a threshold alert exists, and composes `PhoenixInsightStrip`, `SuiteSelector`, `EvaluatorBreakdown`, `CollapsibleComparison`, plus legacy primitives `ActivityList`/`ScoreFeature` from `components/evals/dashboard/` |
| `components/evals/dashboard-v2/view-switcher.tsx`          | URL-state-driven `radiogroup` switcher between "Suites" (`?view=suites`) and "Run history" (`?view=history`)                                                                                                                                                                                                                                                                                                                                                             |
| `components/evals/dashboard-v2/suite-selector.tsx`         | ARIA `tablist` for the per-suite drilldown. Reads suite display copy from `lib/evals/display.ts`: `capability` → "Test Suite", `trafficMonitor` → "Production Evals", `regression` → "Regression Tests"; marks the current attention suite with a "Needs attention" status                                                                                                                                                                                               |
| `components/evals/dashboard-v2/evaluator-breakdown.tsx`    | Per-evaluator score breakdown for a suite run; renders `AutoBadge` next to deterministic evaluators (`deterministic_prechecks`, `tool_usage`) and uses suite-aware diagnostic status copy so Production Evals show monitoring alerts instead of release-gate blocks                                                                                                                                                                                                      |
| `components/evals/dashboard-v2/collapsible-comparison.tsx` | Comparison panel between latest and prior runs (collapsible)                                                                                                                                                                                                                                                                                                                                                                                                             |
| `components/evals/dashboard-v2/attention.ts`               | Pure helper module for dashboard suite focus: maps persisted suite IDs to URL suite IDs, chooses the default suite, and builds Phoenix insight copy from `lib/evals/helpers/alerts.ts:getLatestThresholdAlert`                                                                                                                                                                                                                                                           |
| `components/evals/dashboard-v2/phoenix-insight.tsx`        | Threshold-breach insight strip that explains why a suite needs attention, keeps nontechnical suite names, links to the Phoenix experiment when available, and lets the operator review the alerting suite                                                                                                                                                                                                                                                                |
| `components/evals/dashboard-v2/auto-badge.tsx`             | Static "auto" pill marking deterministic evaluator rows (e.g. `deterministic_prechecks`, `tool_usage`) so readers can distinguish them from LLM-judge rows in `EvaluatorBreakdown`                                                                                                                                                                                                                                                                                       |
| `components/evals/dashboard-v2/url-state.ts`               | Pure parse/serialize helpers + type guards (`isView`, `isSuiteId`) for the `?view=` and `?suite=` params                                                                                                                                                                                                                                                                                                                                                                 |
| `components/evals/dashboard-v2/use-url-state.ts`           | React hook wrapping `url-state.ts` for component-level reactive URL state                                                                                                                                                                                                                                                                                                                                                                                                |
| `components/evals/dashboard-v2/local-labels.ts`            | Local display-label overrides for the dashboard-v2 surface — exists specifically because the full evaluator name "Deterministic Prechecks" overflows the 2-column row                                                                                                                                                                                                                                                                                                    |
| `components/evals/dashboard/activity-list.tsx`             | Legacy: recent runs activity list (still imported by dashboard-v2)                                                                                                                                                                                                                                                                                                                                                                                                       |
| `components/evals/dashboard/comparison-table.tsx`          | Legacy: tabular comparison primitive (still imported by dashboard-v2)                                                                                                                                                                                                                                                                                                                                                                                                    |
| `components/evals/dashboard/score-bar.tsx`                 | Legacy: horizontal pass-rate bar primitive                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `components/evals/dashboard/score-feature.tsx`             | Legacy: score-with-label feature primitive                                                                                                                                                                                                                                                                                                                                                                                                                               |
| `components/evals/dashboard/shared.ts`                     | Legacy: shared formatters and types used by dashboard primitives                                                                                                                                                                                                                                                                                                                                                                                                         |
| `components/evals/glossary/defined-term.tsx`               | Inline term with hover-popover definition                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `components/evals/glossary/judge-label.tsx`                | Stylized rendering of LLM-judge verdict labels                                                                                                                                                                                                                                                                                                                                                                                                                           |
| `components/evals/glossary/score-cell.tsx`                 | Score cell with embedded glossary tooltip                                                                                                                                                                                                                                                                                                                                                                                                                                |
| `components/evals/glossary/aggregate-breakdown.tsx`        | Aggregate-score breakdown component for evaluator clusters                                                                                                                                                                                                                                                                                                                                                                                                               |

> **Note on test files:** the `dashboard-v2/`, `dashboard/`, and `glossary/` directories contain co-located test files (eight in `dashboard-v2/` alone). They are intentionally omitted from this section — FILE-INDEX is selectively detailed and other component sections (e.g. `tool-ui/`) follow the same convention.

### Voice Components

| File                                     | Purpose                                                     |
| ---------------------------------------- | ----------------------------------------------------------- |
| `components/voice/mic-button.tsx`        | Microphone toggle button for voice input                    |
| `components/voice/speak-button.tsx`      | Text-to-speech playback toggle button                       |
| `components/voice/voice-mode-toggle.tsx` | Toggle button to enter/exit voice conversation mode         |
| `components/voice/voice-orb.tsx`         | Animated voice orb for active voice conversation mode       |
| `components/voice/voice-settings.tsx`    | Voice settings panel with provider and voice ID preferences |

### Tool UI Components

The `components/tool-ui/` directory contains generative UI components rendered by the AI agent's display tools. Each tool has an adapter, schema, and presentational component.

| File                                                  | Purpose                                                                                    |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `components/tool-ui/index.ts`                         | Barrel export for all tool UI components and registry                                      |
| `components/tool-ui/registry.tsx`                     | Tool UI compatibility facade mapping tool names to result renderers via schema validation  |
| `components/tool-ui/renderer-catalog.tsx`             | Client renderer catalog for manifest display tool outputs                                  |
| `components/tool-ui/interactive-renderer-catalog.tsx` | Client renderer catalog for interactive display tool parts                                 |
| `components/tool-ui/tool-part-registry.tsx`           | Tool-part dispatcher; delegates migrated interactive tools to module-local client adapters |
| `components/tool-ui/competitor-research-result.tsx`   | Dedicated result component for the `competitorResearch` specialist                         |
| `components/tool-ui/canvas-artifact-card.tsx`         | Inline chat card surfacing the current canvas artifact (status, preview, errors)           |
| `components/tool-ui/tool-error-boundary.tsx`          | Error boundary component wrapping tool UI renders with fallback display                    |

#### Callout Tool

| File                                      | Purpose                                                          |
| ----------------------------------------- | ---------------------------------------------------------------- |
| `components/tool-ui/callout/index.ts`     | Barrel export for Callout component                              |
| `components/tool-ui/callout/_adapter.tsx` | Adapter re-exporting `cn` utility for Callout                    |
| `components/tool-ui/callout/callout.tsx`  | Styled callout box with variant-specific icons and color theming |
| `components/tool-ui/callout/schema.ts`    | Zod schema and serialization types for callout data              |

#### Chart Tool

| File                                    | Purpose                                                 |
| --------------------------------------- | ------------------------------------------------------- |
| `components/tool-ui/chart/index.tsx`    | Barrel export for Chart component                       |
| `components/tool-ui/chart/_adapter.tsx` | Adapter mapping displayChart tool output to Chart props |
| `components/tool-ui/chart/chart.tsx`    | Bar and line chart component using Recharts             |
| `components/tool-ui/chart/schema.ts`    | Zod schema and serialization types for chart data       |

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

#### Generate Image Tool

| File                                                   | Purpose                                                         |
| ------------------------------------------------------ | --------------------------------------------------------------- |
| `components/tool-ui/generate-image/index.tsx`          | Barrel export for GenerateImage component and schema            |
| `components/tool-ui/generate-image/generate-image.tsx` | Image display component with expandable lightbox and download   |
| `components/tool-ui/generate-image/schema.ts`          | Zod schema and serialization types for generate-image tool data |

#### Geo Map Tool

| File                                                  | Purpose                                                             |
| ----------------------------------------------------- | ------------------------------------------------------------------- |
| `components/tool-ui/geo-map/index.tsx`                | Barrel export for GeoMap component                                  |
| `components/tool-ui/geo-map/_adapter.tsx`             | Adapter re-exporting shared UI helpers for the geo-map surface      |
| `components/tool-ui/geo-map/geo-map.tsx`              | Public facade component for the `displayGeoMap` Tool UI surface     |
| `components/tool-ui/geo-map/geo-map-engine.tsx`       | Leaflet engine handling tiles, clustering, fitting, and interaction |
| `components/tool-ui/geo-map/geo-map-icons.ts`         | Marker icon builders for dot, emoji, and image markers              |
| `components/tool-ui/geo-map/geo-map-overlays.tsx`     | Popup and tooltip overlay rendering for map primitives              |
| `components/tool-ui/geo-map/geo-map-theme.module.css` | Leaflet shell theme overrides for light/dark basemaps               |
| `components/tool-ui/geo-map/schema.ts`                | Zod schema for markers, routes, polygons, viewport, and clustering  |

#### Link Preview Tool

| File                                               | Purpose                                                             |
| -------------------------------------------------- | ------------------------------------------------------------------- |
| `components/tool-ui/link-preview/index.ts`         | Barrel export for LinkPreview component                             |
| `components/tool-ui/link-preview/_adapter.tsx`     | Adapter mapping displayLinkPreview tool output to LinkPreview props |
| `components/tool-ui/link-preview/link-preview.tsx` | Rich link preview card with image, title, description, and domain   |
| `components/tool-ui/link-preview/schema.ts`        | Zod schema and serialization types for link preview data            |

#### Agent Artifact Tool

| File                                                    | Purpose                                                                                       |
| ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `components/tool-ui/agent-artifact/index.tsx`           | Barrel export for AgentArtifact component and serializable schema helpers                     |
| `components/tool-ui/agent-artifact/_adapter.tsx`        | Provenance boundary re-exporting local `Button` and `cn` for the adapted upstream component   |
| `components/tool-ui/agent-artifact/agent-artifact.tsx`  | Inline artifact component with preview/code/raw tabs, copy action, metadata, and download URL |
| `components/tool-ui/agent-artifact/schema.ts`           | Zod schema and serialization types for `displayAgentArtifact` payloads                        |
| `components/tool-ui/agent-artifact/README.md`           | Source provenance notes for the Agent Kit community port                                      |
| `components/tool-ui/agent-artifact/UPSTREAM-LICENSE.md` | Retained upstream non-commercial license notice for the adapted component                     |

#### Option List Tool

| File                                             | Purpose                                                              |
| ------------------------------------------------ | -------------------------------------------------------------------- |
| `components/tool-ui/option-list/index.tsx`       | Barrel export for OptionList component                               |
| `components/tool-ui/option-list/_adapter.tsx`    | Adapter mapping displayOptionList tool output to OptionList props    |
| `components/tool-ui/option-list/option-list.tsx` | Interactive option list with single/multi select and submit behavior |
| `components/tool-ui/option-list/selection.ts`    | Selection state management helpers for option list                   |
| `components/tool-ui/option-list/schema.ts`       | Zod schema and serialization types for option list data              |

#### Question Wizard Tool

| File                                                     | Purpose                                                                   |
| -------------------------------------------------------- | ------------------------------------------------------------------------- |
| `components/tool-ui/question-wizard/index.tsx`           | Barrel export for QuestionWizard component                                |
| `components/tool-ui/question-wizard/_adapter.tsx`        | Adapter mapping displayQuestionWizard tool output to QuestionWizard props |
| `components/tool-ui/question-wizard/question-wizard.tsx` | Multi-step interactive wizard component driving `displayQuestionWizard`   |
| `components/tool-ui/question-wizard/schema.ts`           | Zod schema and serialization types for question-wizard data               |

#### Plan Tool

| File                                         | Purpose                                                      |
| -------------------------------------------- | ------------------------------------------------------------ |
| `components/tool-ui/plan/index.tsx`          | Barrel export for Plan and PlanCompact components            |
| `components/tool-ui/plan/_adapter.tsx`       | Adapter mapping displayPlan tool output to Plan props        |
| `components/tool-ui/plan/plan.tsx`           | Plan display with step list, status indicators, and progress |
| `components/tool-ui/plan/from-todo-write.ts` | Maps todoWrite tool output to Plan component format          |
| `components/tool-ui/plan/progress.ts`        | Progress calculation utilities for plan steps                |
| `components/tool-ui/plan/schema.ts`          | Zod schema and serialization types for plan data             |

#### Timeline Tool

| File                                       | Purpose                                                          |
| ------------------------------------------ | ---------------------------------------------------------------- |
| `components/tool-ui/timeline/index.ts`     | Barrel export for Timeline component                             |
| `components/tool-ui/timeline/_adapter.tsx` | Adapter re-exporting `cn` utility for Timeline                   |
| `components/tool-ui/timeline/timeline.tsx` | Vertical timeline with category-specific icons and color theming |
| `components/tool-ui/timeline/schema.ts`    | Zod schema and serialization types for timeline data             |

#### Progress Tracker Tool

| File                                                       | Purpose                                                      |
| ---------------------------------------------------------- | ------------------------------------------------------------ |
| `components/tool-ui/progress-tracker/index.tsx`            | Barrel export for ProgressTracker component                  |
| `components/tool-ui/progress-tracker/_adapter.tsx`         | Adapter mapping tool output to ProgressTracker props         |
| `components/tool-ui/progress-tracker/progress-tracker.tsx` | Visual progress tracker with step completion indicators      |
| `components/tool-ui/progress-tracker/schema.ts`            | Zod schema and serialization types for progress tracker data |

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
| `components/ui/accordion.tsx`        | Collapsible accordion component                             |
| `components/ui/alert-dialog.tsx`     | Confirmation dialog for destructive actions                 |
| `components/ui/animated-logo.tsx`    | Animated Polymorph logo displayed during loading states     |
| `components/ui/avatar.tsx`           | User avatar with image and fallback                         |
| `components/ui/badge.tsx`            | Badge label component with variants                         |
| `components/ui/button.tsx`           | Button component with size and variant props                |
| `components/ui/card.tsx`             | Card container component with header, content, and footer   |
| `components/ui/carousel.tsx`         | Embla-based carousel/slider component                       |
| `components/ui/chart.tsx`            | Chart wrapper component for Recharts integration            |
| `components/ui/checkbox.tsx`         | Checkbox input component                                    |
| `components/ui/collapsible.tsx`      | Radix UI Collapsible component                              |
| `components/ui/command.tsx`          | Command palette / combobox component                        |
| `components/ui/dialog.tsx`           | Modal dialog component                                      |
| `components/ui/drawer.tsx`           | Bottom sheet drawer component (Vaul)                        |
| `components/ui/dropdown-menu.tsx`    | Dropdown menu component                                     |
| `components/ui/hover-card.tsx`       | Hover-triggered card component                              |
| `components/ui/icons.tsx`            | Custom SVG icon components (Polymorph logo, provider logos) |
| `components/ui/input.tsx`            | Text input component                                        |
| `components/ui/label.tsx`            | Form label component                                        |
| `components/ui/password-input.tsx`   | Password input with show/hide toggle                        |
| `components/ui/popover.tsx`          | Popover overlay component                                   |
| `components/ui/select.tsx`           | Dropdown select component                                   |
| `components/ui/separator.tsx`        | Visual separator / divider component                        |
| `components/ui/sheet.tsx`            | Side panel sheet component                                  |
| `components/ui/sidebar.tsx`          | Sidebar layout component with collapse/expand support       |
| `components/ui/skeleton.tsx`         | Loading skeleton placeholder                                |
| `components/ui/slider.tsx`           | Range slider input component                                |
| `components/ui/sonner.tsx`           | Toast notification component (Sonner)                       |
| `components/ui/spinner.tsx`          | Loading spinner animation                                   |
| `components/ui/status-indicator.tsx` | Animated status dot indicator                               |
| `components/ui/switch.tsx`           | Toggle switch component                                     |
| `components/ui/table.tsx`            | Data table component with header, body, and row styles      |
| `components/ui/textarea.tsx`         | Multi-line text input component                             |
| `components/ui/toggle.tsx`           | Toggle button component                                     |
| `components/ui/tooltip.tsx`          | Tooltip component wrapping Radix UI Tooltip                 |
| `components/ui/tooltip-button.tsx`   | Button with integrated tooltip                              |

---

## Core Library

### Agents

| File                                                 | Purpose                                                                          |
| ---------------------------------------------------- | -------------------------------------------------------------------------------- |
| `lib/agents/researcher.ts`                           | Compatibility shim that delegates to the chat agent registry                     |
| `lib/agents/chat/registry.ts`                        | Resolves chat agent IDs from `searchMode`, `userMode`, and `intent`              |
| `lib/agents/chat/route-handler.ts`                   | Injects selected agent factories into authenticated and guest stream primitives  |
| `lib/agents/chat/factory.ts`                         | Shared `ToolLoopAgent` creation for chat, research, and build agents             |
| `lib/agents/chat/search.ts`                          | Search/chat agent definition and search pacing wrappers                          |
| `lib/agents/chat/research.ts`                        | Research agent definition, active tools, and `competitorResearch` activation     |
| `lib/agents/chat/build.ts`                           | Build agent definition with artifact-intake prompt wiring                        |
| `lib/agents/chat/specialists.ts`                     | Specialist registry metadata                                                     |
| `lib/agents/chat/specialists/competitor-research.ts` | Live competitor research specialist tool, schemas, and structured output builder |
| `lib/agents/title-generator.ts`                      | Generates concise 3-5 word chat titles using an LLM                              |
| `lib/agents/generate-related-questions.ts`           | Streams 3 follow-up question suggestions using structured output                 |
| `lib/agents/generate-trending-suggestions.ts`        | Generates trending topic suggestions for the homepage                            |
| `lib/agents/prompts/search-mode-prompts.ts`          | System prompts for Chat mode and Research mode search behaviors                  |
| `lib/agents/prompts/related-questions-prompt.ts`     | System prompt for related question generation                                    |

### Tools

| File                                                                          | Purpose                                                                                                               |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `lib/tools/search.ts`                                                         | Multi-provider search tool with streaming progress; supports general and optimized search types                       |
| `lib/tools/fetch.ts`                                                          | Web content extraction tool; supports regular HTML fetch and API-based extraction (Jina, Tavily)                      |
| `lib/tools/todo.ts`                                                           | Task list management tool; creates and updates structured todo items                                                  |
| `lib/tools/tool-ui/`                                                          | Manifest runtime helpers for Tool UI metadata, community sources, server tools, and validation                        |
| `lib/tools/tool-ui/metadata.ts`                                               | Tool UI manifest metadata for tool names, mode availability, and interactive continuation types                       |
| `lib/tools/tool-ui/community-sources.ts`                                      | Community source inventory for npm packages, ported components, licenses, public imports, and local adapter ownership |
| `lib/tools/tool-ui/server.ts`                                                 | Helpers for passive and client-resolved AI SDK display tools                                                          |
| `lib/tools/tool-ui/server-catalog.ts`                                         | Server-only catalog mapping manifest display tools to AI SDK server tools                                             |
| `lib/tools/tool-ui/client-output-validation.ts`                               | Validates client-resolved interactive outputs against tool output schemas before persistence                          |
| `lib/tools/create-canvas-artifact.ts`                                         | Compatibility re-export for the canvas artifact create module                                                         |
| `lib/tools/create-canvas-artifact/`                                           | AI tool module: schema, server tool, and result renderer for creating canvas artifacts                                |
| `lib/tools/create-canvas-artifact/{schema.ts,server.ts,result.tsx,index.ts}`  | Module-local contract, server tool, result adapter, and public exports                                                |
| `lib/tools/display-callout.ts`                                                | Display tool that renders a styled callout box with variant-specific icons and colors                                 |
| `lib/tools/display-agent-artifact.ts`                                         | Compatibility re-export for the Agent Artifact display module                                                         |
| `lib/tools/display-agent-artifact/`                                           | Display tool module: schema, server tool, and result renderer for inline agent artifacts                              |
| `lib/tools/display-agent-artifact/{schema.ts,server.ts,result.tsx,index.ts}`  | Module-local contract, server tool, result adapter, and public exports                                                |
| `lib/tools/display-chart.ts`                                                  | Display tool that renders bar and line charts                                                                         |
| `lib/tools/display-citations.ts`                                              | Compatibility re-export for the citations display module                                                              |
| `lib/tools/display-citations/`                                                | Display tool module: schema, server tool, and result renderer for citation lists                                      |
| `lib/tools/display-citations/{schema.ts,server.ts,result.tsx,index.ts}`       | Module-local contract, server tool, result adapter, and public exports                                                |
| `lib/tools/display-geo-map.ts`                                                | Display tool that renders interactive geo maps with markers, routes, polygons, and clustering                         |
| `lib/tools/display-link-preview.ts`                                           | Compatibility re-export for the link preview display module                                                           |
| `lib/tools/display-link-preview/`                                             | Display tool module: schema, server tool, and result renderer for link previews                                       |
| `lib/tools/display-link-preview/{schema.ts,server.ts,result.tsx,index.ts}`    | Module-local contract, server tool, result adapter, and public exports                                                |
| `lib/tools/display-option-list.ts`                                            | Compatibility re-export for the option list display module                                                            |
| `lib/tools/display-option-list/`                                              | Interactive display tool module: schema, frontend-resolved server tool, and client adapter                            |
| `lib/tools/display-option-list/{schema.ts,server.ts,client.tsx,index.ts}`     | Module-local contract, frontend-resolved server tool, client adapter, and public exports                              |
| `lib/tools/display-plan.ts`                                                   | Display tool that renders a step-by-step research plan                                                                |
| `lib/tools/display-question-wizard.ts`                                        | Compatibility re-export for the question wizard display module                                                        |
| `lib/tools/display-question-wizard/`                                          | Interactive display tool module: schema, frontend-resolved server tool, and client adapter                            |
| `lib/tools/display-question-wizard/{schema.ts,server.ts,client.tsx,index.ts}` | Module-local contract, frontend-resolved server tool, client adapter, and public exports                              |
| `lib/tools/display-table.ts`                                                  | Display tool that renders a formatted data table with column types                                                    |
| `lib/tools/display-timeline.ts`                                               | Display tool that renders a chronological event timeline with category styling                                        |
| `lib/tools/dynamic.ts`                                                        | Factory for creating runtime-defined tools (MCP tools, user-defined functions)                                        |
| `lib/tools/generate-image.ts`                                                 | Compatibility re-export for the image generation module                                                               |
| `lib/tools/generate-image/`                                                   | AI tool module: schema, server tool, and result renderer for generated images                                         |
| `lib/tools/generate-image/{schema.ts,server.ts,result.tsx,index.ts}`          | Module-local contract, server tool, result adapter, and public exports                                                |
| `lib/tools/geocode-address.ts`                                                | AI tool: resolves place names or addresses into ranked coordinate candidates                                          |
| `lib/tools/get-directions.ts`                                                 | AI tool: computes road-following directions with route points, distance, and duration labels                          |
| `lib/tools/get-isochrone.ts`                                                  | AI tool: computes reachability polygons from a center point and travel-time budget                                    |
| `lib/tools/get-static-map-image.ts`                                           | AI tool: builds shareable static MapTiler PNG URLs with optional markers                                              |
| `lib/tools/read-canvas-artifact.ts`                                           | Compatibility re-export for the canvas artifact read module                                                           |
| `lib/tools/read-canvas-artifact/`                                             | AI tool module: schema and server tool for reading current canvas artifact source                                     |
| `lib/tools/read-canvas-artifact/{schema.ts,server.ts,index.ts}`               | Module-local contract, server tool, and public exports                                                                |
| `lib/tools/update-canvas-artifact.ts`                                         | Compatibility re-export for the canvas artifact update module                                                         |
| `lib/tools/update-canvas-artifact/`                                           | AI tool module: schema, server tool, and result renderer for updating canvas artifacts                                |
| `lib/tools/update-canvas-artifact/{schema.ts,server.ts,result.tsx,index.ts}`  | Module-local contract, server tool, result adapter, and public exports                                                |

### Search Providers

| File                                      | Purpose                                                                                              |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `lib/tools/search/providers/index.ts`     | Provider factory; creates search provider instances by type (Tavily, Brave, Exa, SearXNG, Firecrawl) |
| `lib/tools/search/providers/base.ts`      | Abstract base class and interface for search providers                                               |
| `lib/tools/search/providers/brave.ts`     | Brave Search provider; default primary provider with multimedia support (video, image, news)         |
| `lib/tools/search/providers/tavily.ts`    | Tavily search provider; fallback provider for web search with image support                          |
| `lib/tools/search/providers/exa.ts`       | Exa search provider; neural search with content extraction                                           |
| `lib/tools/search/providers/firecrawl.ts` | Firecrawl search provider; web, news, and image search via Firecrawl API                             |
| `lib/tools/search/providers/searxng.ts`   | SearXNG search provider; self-hosted meta-search engine integration                                  |
| `lib/tools/search/providers/errors.ts`    | Typed `SearchProviderError` and `createHttpSearchError` (retryable flag, `Retry-After` parsing)      |

### Streaming

| File                                                     | Purpose                                                                                                             |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `lib/streaming/create-chat-stream-response.ts`           | Authenticated chat streaming; handles message persistence, title generation, context pruning, and related questions |
| `lib/streaming/create-ephemeral-chat-stream-response.ts` | Guest/anonymous chat streaming; no persistence, context pruning only                                                |
| `lib/streaming/eval-chat-runner.ts`                      | Runs eval chats through the researcher agent without persistence; used by `/api/evals/run`                          |
| `lib/streaming/types.ts`                                 | TypeScript interfaces for stream configuration (BaseStreamConfig)                                                   |
| `lib/streaming/helpers/prepare-messages.ts`              | Prepares canonical AI SDK `UIMessage` history, including native interactive output continuations                    |
| `lib/streaming/helpers/persist-stream-results.ts`        | Persists streamed response messages and chat title to the database                                                  |
| `lib/streaming/helpers/has-pending-interactive-tool.ts`  | Checks if the response has pending interactive tools awaiting user input                                            |
| `lib/streaming/helpers/inline-file-urls.ts`              | Downloads HTTPS file URLs and inlines them as binary data for providers that cannot fetch externally                |
| `lib/streaming/helpers/stream-related-questions.ts`      | Generates and streams related follow-up questions alongside the main response                                       |
| `lib/streaming/helpers/strip-reasoning-parts.ts`         | Strips reasoning parts from messages to avoid OpenAI API compatibility issues                                       |
| `lib/streaming/helpers/types.ts`                         | TypeScript interfaces for streaming context (StreamContext)                                                         |

### Database

| File                  | Purpose                                                                                                                                                                                                                                                                                                                      |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/db/schema.ts`    | Drizzle schema defining `chats`, `messages` with non-null canonical `ui_message`, `feedback`, `canvas_artifacts`, `eval_summaries`, `eval_case_results`, and `trending_suggestions_cache` with RLS policies, including eval summary metadata columns (`judge_*`, corpus/dataset/template versions, app SHA, sample/lookback) |
| `lib/db/index.ts`     | Database client initialization with connection pooling, SSL config, and restricted user support                                                                                                                                                                                                                              |
| `lib/db/actions.ts`   | Database CRUD operations with RLS; writes and reads canonical `messages.ui_message` payloads                                                                                                                                                                                                                                 |
| `lib/db/admin.ts`     | Privileged DB client factory (`getPrivilegedDb`) bypassing RLS for cron/service writes (e.g., suggestions refresh)                                                                                                                                                                                                           |
| `lib/db/constants.ts` | Database constants (query limits, default values)                                                                                                                                                                                                                                                                            |
| `lib/db/with-rls.ts`  | RLS helper that sets `app.current_user_id` in PostgreSQL session for row-level security                                                                                                                                                                                                                                      |
| `lib/db/migrate.ts`   | Standalone migration runner script using Drizzle Kit                                                                                                                                                                                                                                                                         |

### Server Actions

| File                           | Purpose                                                                                      |
| ------------------------------ | -------------------------------------------------------------------------------------------- |
| `lib/actions/chat.ts`          | Server actions for chat operations with direct chat loading and write-side revalidation tags |
| `lib/actions/feedback.ts`      | Server action to update message feedback score in the database                               |
| `lib/actions/site-feedback.ts` | Server action to submit site-wide user feedback (sentiment + message)                        |

### Schema (Zod)

| File                    | Purpose                                                                    |
| ----------------------- | -------------------------------------------------------------------------- |
| `lib/schema/search.tsx` | Zod schema for search tool input (query, type, content_types, max_results) |
| `lib/schema/fetch.tsx`  | Zod schema for fetch tool input (url, type)                                |
| `lib/schema/related.ts` | Zod schema for related questions output (array of 3 questions)             |

### Types

| File                               | Purpose                                                                                    |
| ---------------------------------- | ------------------------------------------------------------------------------------------ |
| `lib/types/index.ts`               | Core type definitions for SearchResults, SearchResultItem, SearXNG types, and UploadedFile |
| `lib/types/search.ts`              | Backend `SearchMode` plus UI-facing `UserMode` definitions and mapping helpers             |
| `lib/types/models.ts`              | Model interface (id, name, provider, providerId, providerOptions)                          |
| `lib/types/model-type.ts`          | ModelType definition (`'speed' \| 'quality'`)                                              |
| `lib/types/agent.ts`               | ResearcherTools type, ResearcherAgent alias, and manifest-derived tool invocation types    |
| `lib/types/ai.ts`                  | Extended AI SDK types: UIMessage, UIMessageMetadata, UITools, UIDataTypes, Part, ToolPart  |
| `lib/types/dynamic-tools.ts`       | Type definitions for MCP client, dynamic tool configuration, and DynamicToolPart variants  |
| `lib/types/message-persistence.ts` | Database message part types (DBMessagePart, ToolState) and metadata schemas                |

### Config

| File                               | Purpose                                                                                                             |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `lib/config/model-types.ts`        | Retrieves model assignments by search mode and model type from JSON config                                          |
| `lib/config/load-models-config.ts` | Loads and validates model configuration from JSON files (default.json, cloud.json)                                  |
| `lib/config/search-modes.ts`       | Search/Research/Build UI configuration including backend mode and optional intent mapping                           |
| `lib/config/env.ts`                | Environment variable validation, type-safe access, and exported `isProductionTarget()` for Vercel/Railway detection |
| `lib/config/ollama-validator.ts`   | Validates configured Ollama models are available and compatible on server startup                                   |

### Auth

| File                           | Purpose                                                                                                     |
| ------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `lib/auth/get-current-user.ts` | Gets current authenticated user from Supabase; supports auth-disabled mode for personal deployments         |
| `lib/auth/is-admin.ts`         | Admin role check: matches the current Supabase session's user ID against the single `ADMIN_USER_ID` env var |

### Supabase

| File                             | Purpose                                                                          |
| -------------------------------- | -------------------------------------------------------------------------------- |
| `lib/supabase/client.ts`         | Browser-side Supabase client using `createBrowserClient`                         |
| `lib/supabase/middleware.ts`     | Middleware helper that refreshes Supabase auth session on each request           |
| `lib/supabase/server.ts`         | Server-side Supabase client using `createServerClient` with cookie-based session |
| `lib/supabase/server-storage.ts` | Server-side Supabase admin client for uploading generated images to Storage      |
| `lib/supabase/storage.ts`        | Uploads files to Supabase Storage bucket with sanitized file paths               |

### Rate Limiting

| File                                   | Purpose                                                                                          |
| -------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `lib/rate-limit/guest-limit.ts`        | Guest user daily rate limiting via Upstash Redis (default 10/day)                                |
| `lib/rate-limit/chat-limits.ts`        | Authenticated user daily chat rate limiting via Upstash Redis (default 100/day)                  |
| `lib/rate-limit/canvas-limits.ts`      | Per-minute rate limits for canvas operations (draft, version, restore, diagnostics, image-proxy) |
| `lib/rate-limit/per-minute-limiter.ts` | Generic per-minute rate limiter using Redis with in-memory fallback                              |
| `lib/rate-limit/voice-limits.ts`       | Per-minute rate limit for voice TTS synthesis requests                                           |
| `lib/rate-limit/redis.ts`              | Upstash Redis client initialization and configuration                                            |
| `lib/rate-limit/memory-limiter.ts`     | In-memory rate limiter fallback when Redis is unavailable                                        |

### Analytics

| File                                | Purpose                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------ |
| `lib/analytics/index.ts`            | Barrel export for analytics module (trackChatEvent, calculateConversationTurn) |
| `lib/analytics/types.ts`            | Type definitions for ChatEventData and AnalyticsProvider interface             |
| `lib/analytics/track-chat-event.ts` | Tracks chat events to Vercel Analytics (cloud deployments only)                |
| `lib/analytics/utils.ts`            | Calculates conversation turn number from message history                       |

### Voice

| File                        | Purpose                                                                     |
| --------------------------- | --------------------------------------------------------------------------- |
| `lib/voice/tts-provider.ts` | TTS provider abstraction; resolves and synthesizes via OpenAI or ElevenLabs |
| `lib/voice/config.ts`       | Voice feature configuration and environment flag checks                     |
| `lib/voice/usage.ts`        | Voice usage tracking and quota management                                   |

### Motion

| File                                | Purpose                                                                  |
| ----------------------------------- | ------------------------------------------------------------------------ |
| `lib/motion/tokens.ts`              | Shared motion timing, easing, and distance tokens for chat motion        |
| `lib/motion/variants.ts`            | Reduced-motion-aware variants derived from the shared token set          |
| `lib/motion/hydration-boundary.tsx` | Tracks which tool-part IDs existed at first paint so history stays still |
| `lib/motion/part-ids.ts`            | Extracts stable tool-part identifiers from messages for motion decisions |

### Utils

| File                                  | Purpose                                                                                                     |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `lib/utils/index.ts`                  | Core utilities: `generateUUID`, `cn` (classname merger), `sanitizeUrl`, `createModelId`                     |
| `lib/utils/registry.ts`               | AI provider registry wrapping OpenAI, Anthropic, Google, Ollama, and Vercel AI Gateway                      |
| `lib/utils/model-selection.ts`        | Resolves the appropriate model based on search mode and model type cookie preferences                       |
| `lib/utils/context-window.ts`         | Token counting, context window management, and message truncation using tiktoken                            |
| `lib/utils/citation.ts`               | Citation extraction, processing, and mapping from search results to inline references                       |
| `lib/utils/message-mapping.ts`        | Maps AI SDK UIMessage and DB parts; restores registered rich dynamic tools                                  |
| `lib/utils/message-utils.ts`          | Helpers for extracting text content from message parts                                                      |
| `lib/utils/domain.ts`                 | Extracts display-friendly domain name from URLs (e.g., "google" from "www.google.com")                      |
| `lib/utils/file-validation.ts`        | Allowed file types, size limits, and validation constants for uploads                                       |
| `lib/utils/cookies.ts`                | Client-side cookie get/set/remove utilities                                                                 |
| `lib/utils/json-error.ts`             | Utility for creating structured JSON error responses with code and message                                  |
| `lib/utils/search-config.ts`          | Environment-aware search provider configuration and tool description generation                             |
| `lib/utils/search-mode.ts`            | Atomic searchMode cookie sync with CustomEvent dispatch                                                     |
| `lib/utils/model-type.ts`             | Atomic modelType cookie sync with CustomEvent dispatch                                                      |
| `lib/utils/retry.ts`                  | Exponential backoff retry utility for database operations                                                   |
| `lib/utils/perf-logging.ts`           | Conditional performance logging (enabled via `ENABLE_PERF_LOGGING`)                                         |
| `lib/utils/perf-tracking.ts`          | Development-only counters for auth calls and DB operations                                                  |
| `lib/utils/app-metadata.ts`           | Generates Next.js Metadata object (title, description, OG images) from public origin                        |
| `lib/utils/otel-context-processor.ts` | SpanProcessor that propagates OpenInference context attributes (session.id, user.id) to spans               |
| `lib/utils/public-origin.ts`          | Resolves the app's public origin URL from `NEXT_PUBLIC_APP_URL` with localhost fallback                     |
| `lib/utils/telemetry.ts`              | Tracing utilities: checks if tracing is enabled, `flushTraces()` with timeout and missing-provider warnings |

### External Clients

| File                           | Purpose                                                                    |
| ------------------------------ | -------------------------------------------------------------------------- |
| `lib/firecrawl/index.ts`       | Barrel export for Firecrawl client and types                               |
| `lib/firecrawl/client.ts`      | Firecrawl API client for web search and image search                       |
| `lib/firecrawl/types.ts`       | Type definitions for Firecrawl API requests and responses                  |
| `lib/tools/maptiler/client.ts` | Shared MapTiler client for JSON API calls and static/public URL generation |
| `lib/ollama/client.ts`         | Ollama API client for listing models and checking capabilities             |
| `lib/ollama/types.ts`          | Type definitions for Ollama model responses and capabilities               |

### Lib Hooks

| File                                 | Purpose                                                     |
| ------------------------------------ | ----------------------------------------------------------- |
| `lib/hooks/use-copy-to-clipboard.ts` | Hook for copying text to clipboard with timeout-based reset |

### Constants

| File                                   | Purpose                                                                                    |
| -------------------------------------- | ------------------------------------------------------------------------------------------ |
| `lib/constants/index.ts`               | Application constants (`CHAT_ID = 'search'`)                                               |
| `lib/constants/build-templates.ts`     | Build template cards (website, game, dashboard) for canvas artifact creation               |
| `lib/constants/default-suggestions.ts` | Default prompt suggestions used as instant state and fallback for trending suggestions API |

### Evals (app-side)

Data access and view helpers backing the admin `/admin/evals` dashboard. The offline cron that _writes_ these rows lives under `services/evals/`.

| File                            | Purpose                                                                                                                                                                      |
| ------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `lib/evals/queries.ts`          | Server-side queries over `eval_summaries` and `eval_case_results` (`getEvalsDashboard`, capability/regression/traffic-monitor selectors, case diagnostics, and run metadata) |
| `lib/evals/types.ts`            | Shared type definitions for eval suites, summaries, case diagnostics, failure modes, and dashboard data shapes                                                               |
| `lib/evals/display.ts`          | Central display copy for eval suites (`Test Suite`, `Production Evals`, `Regression Tests`) plus model-summary formatting helpers                                            |
| `lib/evals/diagnostics.ts`      | Case-diagnostic helpers for evaluator-specific case results, failure-mode counts, failure keys, and score ordering                                                           |
| `lib/evals/evaluator-labels.ts` | Human-readable labels for evaluator IDs                                                                                                                                      |
| `lib/evals/glossary.ts`         | Term definitions and `snapshotSuiteKey` helper powering the `components/evals/glossary/` tooltip and label-rendering UI                                                      |
| `lib/evals/helpers/alerts.ts`   | Builds dashboard alert payloads from threshold-breached snapshots; defines `DashboardAlert` shape; consumed by the dashboard attention helper and Phoenix insight strip      |

### Canvas

Server-side compile pipeline, validation, service layer, and guest token support for canvas artifacts.

| File                                                      | Purpose                                                                                              |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| `lib/canvas/service.ts`                                   | Canvas CRUD service: load state, update draft, save/restore versions, export, record diagnostics     |
| `lib/canvas/compiler/compile-canvas-artifact.ts`          | Orchestrates the full compile pipeline: validate source, esbuild bundle, Tailwind CSS, assemble HTML |
| `lib/canvas/compiler/build-tailwind-css.ts`               | Generates Tailwind CSS v4 from the bundled source using the Tailwind compiler                        |
| `lib/canvas/compiler/assemble-canvas-html.ts`             | Assembles the final single-file HTML from bundled JS and CSS                                         |
| `lib/canvas/pre-processors/run-pre-processors.ts`         | Runs all AST pre-processors on canvas source before compilation                                      |
| `lib/canvas/pre-processors/fix-hallucinated-imports.ts`   | Removes or comments out imports for packages not in the allowed list                                 |
| `lib/canvas/pre-processors/fix-missing-default-export.ts` | Adds a default export when the App component exists but isn't exported                               |
| `lib/canvas/validation/validate-canvas-source.ts`         | Validates and normalizes canvas source before compilation                                            |
| `lib/canvas/allowed-packages.ts`                          | Derives the allowed import list from vendor chunk definitions for canvas artifacts                   |
| `lib/canvas/inject-viewport-fit.ts`                       | Injects base CSS so canvas content fills the iframe viewport without overflow                        |
| `lib/canvas/serve-canvas-html.ts`                         | Shared handler for serving compiled canvas HTML (inline or as download) with auth                    |
| `lib/canvas/guest-token.ts`                               | HMAC-SHA256 guest token signing, verification, and rotation for scoped artifact access               |
| `lib/canvas/tool-context.ts`                              | Context object passed to canvas AI tools with chat/artifact identity and guest token                 |
| `lib/canvas/constants.ts`                                 | Canvas system constants (max source size, revision limits, compile timeouts)                         |

---

## Top-Level Hooks

| File                                  | Purpose                                                                   |
| ------------------------------------- | ------------------------------------------------------------------------- |
| `hooks/use-activity-feed.ts`          | Hook for activity stream display                                          |
| `hooks/use-auth-check.tsx`            | Hook checking Supabase auth state and subscribing to auth changes         |
| `hooks/use-content-entrance.ts`       | Hook for content display entrance logic                                   |
| `hooks/use-current-user.ts`           | Hook fetching the current user's session data from Supabase               |
| `hooks/use-file-dropzone.ts`          | Hook managing file drag-and-drop, validation, and upload to `/api/upload` |
| `hooks/use-mobile.tsx`                | Hook detecting mobile viewport (< 768px breakpoint)                       |
| `hooks/use-prefers-reduced-motion.ts` | Hook tracking the `prefers-reduced-motion` media query                    |
| `hooks/use-ticker-rotation.ts`        | Hook for timed item rotation with enter/exit animation phases             |
| `hooks/use-trending-suggestions.ts`   | Hook for fetching and displaying trending topic suggestions               |
| `hooks/use-voice-conversation.ts`     | Hook orchestrating full voice conversation mode (input + playback)        |
| `hooks/use-voice-input.ts`            | Hook managing voice input via browser speech recognition API              |
| `hooks/use-voice-player.ts`           | Hook managing TTS audio playback via server-side synthesis                |

---

## Config Files

| File                         | Purpose                                                                          |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `config/models/default.json` | Default model configuration mapping search modes and model types to AI models    |
| `config/models/cloud.json`   | Cloud deployment model configuration with production-optimized model assignments |

---

## Scripts

| File                             | Purpose                                                                                                                                                                           |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scripts/build-canvas-vendor.ts` | Populates `public/canvas-vendor/` (the vendor chunk used by the canvas iframe runtime); rebuild via `bun run build:canvas-vendor`                                                 |
| `scripts/chat-cli.ts`            | CLI script for testing the chat API endpoint from the terminal                                                                                                                    |
| `scripts/seed-eval-summaries.ts` | Seeds the `eval_summaries` table with synthetic current-roster data for `/admin/evals` development and browser QA; wired as `bun run seed:evals` and `bun run seed:evals:dry-run` |
| `scripts/README.md`              | Documentation for available scripts                                                                                                                                               |

---

## Database Migrations

The `drizzle/` directory contains Drizzle ORM migration files and snapshots.

| File                                                     | Purpose                                                         |
| -------------------------------------------------------- | --------------------------------------------------------------- |
| `drizzle/0000_black_lifeguard.sql`                       | Initial migration: creates chats, messages tables               |
| `drizzle/0001_thin_supreme_intelligence.sql`             | Adds visibility column to chats                                 |
| `drizzle/0002_material_crystal.sql`                      | Historical sidecar message storage migration                    |
| `drizzle/0003_heavy_whirlwind.sql`                       | Adds indexes for query performance                              |
| `drizzle/0004_natural_wallow.sql`                        | Adds feedback metadata to messages                              |
| `drizzle/0005_awesome_riptide.sql`                       | Adds RLS policies for multi-user security                       |
| `drizzle/0006_brainy_wrecking_crew.sql`                  | Refines RLS policies and adds public chat visibility            |
| `drizzle/0007_illegal_mephistopheles.sql`                | Historical file attachment columns for sidecar message storage  |
| `drizzle/0008_glamorous_riptide.sql`                     | Historical check constraints for sidecar message storage        |
| `drizzle/0009_thankful_may_parker.sql`                   | Adds feedback table for site-wide feedback                      |
| `drizzle/0010_lonely_kang.sql`                           | Adds metadata and search mode columns                           |
| `drizzle/0011_tearful_marauders.sql`                     | Adds artifacts, artifact revisions, and runtime sessions tables |
| `drizzle/0012_equal_hiroim.sql`                          | Adds additional artifact schema refinements                     |
| `drizzle/0013_canvas_artifacts.sql`                      | Adds canvas artifacts and canvas artifact versions tables       |
| `drizzle/0014_canvas_artifact_grants.sql`                | Adds canvas artifact grant policies                             |
| `drizzle/meta/_journal.json`                             | Migration journal tracking applied migrations                   |
| `drizzle/meta/0000_snapshot.json` - `0014_snapshot.json` | Schema snapshots for each migration                             |

---

## Supabase Config

| File                   | Purpose                                                             |
| ---------------------- | ------------------------------------------------------------------- |
| `supabase/config.toml` | Supabase CLI local development configuration (ports, auth settings) |
| `supabase/.gitignore`  | Ignores Supabase CLI generated files                                |

---

## Documentation

| File                                                | Purpose                                                                                                                                                                           |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `docs/README.md`                                    | Documentation index and navigation table                                                                                                                                          |
| `docs/getting-started/QUICKSTART.md`                | End-to-end setup guide from clone to first search                                                                                                                                 |
| `docs/getting-started/ENVIRONMENT.md`               | Complete environment variable reference                                                                                                                                           |
| `docs/getting-started/CONFIGURATION.md`             | Configuration guide for models, search providers, and feature flags                                                                                                               |
| `docs/architecture/OVERVIEW.md`                     | System architecture with diagrams for agent pipeline, streaming, DB schema, and UI component tree                                                                                 |
| `docs/architecture/GEO-TOOLS.md`                    | Spatial tooling overview covering geocoding, directions, isochrones, static maps, and `displayGeoMap`                                                                             |
| `docs/architecture/RESEARCH-AGENT.md`               | Research agent deep technical reference; ToolLoopAgent pattern, search modes, tool system, model selection, and context window management                                         |
| `docs/proposals/SKILLS-ROUTING.md`                  | **Proposal** — skills-routing architecture spec; deterministic skill selection, prompt enrichment, validation strategy, non-prod rollout (not yet implemented)                    |
| `docs/architecture/GENERATIVE-UI.md`                | Generative UI system architecture; display tools, Tool UI registry, adapter pattern, schema validation, and adding new tools                                                      |
| `docs/architecture/STREAMING.md`                    | Streaming architecture and SSE protocol documentation                                                                                                                             |
| `docs/architecture/MODEL-CONFIGURATION.md`          | Guide for configuring AI model profiles (default, cloud, Ollama)                                                                                                                  |
| `docs/architecture/SEARCH-PROVIDERS.md`             | Search provider setup guide (Tavily, Brave, Exa, Firecrawl, SearXNG)                                                                                                              |
| `docs/architecture/DECISIONS.md`                    | Architectural decision records (ADRs)                                                                                                                                             |
| `docs/reference/API.md`                             | API endpoint reference for chat, chats, upload, feedback, advanced search, suggestions, voice, health, canvas artifacts, image proxy, evals, rate limiting, and error conventions |
| `docs/reference/FILE-INDEX.md`                      | This file; every file in the repository with a one-line description                                                                                                               |
| `docs/operations/DEPLOYMENT.md`                     | Deployment guide for Vercel, Docker, and self-hosted setups                                                                                                                       |
| `docs/operations/DOCKER.md`                         | Docker-specific setup and configuration instructions                                                                                                                              |
| `docs/operations/TROUBLESHOOTING.md`                | Common issues and debugging guide                                                                                                                                                 |
| `docs/operations/runbooks/day-2-operations.md`      | Operational runbook for monitoring, maintenance, and incident response                                                                                                            |
| `docs/operations/runbooks/browser-qa-auth-admin.md` | Browser QA runbook for authenticated admin routes, local Supabase setup, eval dashboard seed data, preview constraints, and production guardrails                                 |

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
| `.github/CODEOWNERS`                         | Code ownership rules for pull request review assignment                  |

---

## Public Assets

| File                                                    | Purpose                                                            |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `public/images/vana-v-mark.png`                         | Polymorph "V" mark logo                                            |
| `public/images/vana-wordmark.png`                       | Polymorph full wordmark logo                                       |
| `public/images/vana-v-48.png`                           | 48px Polymorph icon for sidebar collapsed state                    |
| `public/images/vana-icon-512.png`                       | 512px Polymorph icon for PWA                                       |
| `public/images/pm_icon.png`                             | Polymorph "PM" icon                                                |
| `public/images/polymorph-sidebar-logo.png`              | Sidebar logo for light mode                                        |
| `public/images/polymorph-sidebar-logo-darkm.png`        | Sidebar logo for dark mode                                         |
| `public/images/polymorph-wordmark.png`                  | Polymorph wordmark logo                                            |
| `public/images/polymorph_pm_symbol_light_hero_256h.png` | 256px Polymorph symbol for hero sections                           |
| `public/images/polymorph_wordmark_hero_transparent.png` | Transparent wordmark for hero sections                             |
| `public/images/polymorph_wordmark_lightmode_black.png`  | Black wordmark for light mode                                      |
| `public/images/placeholder-image.png`                   | Placeholder image for missing thumbnails                           |
| `public/images/build-templates/`                        | SVG thumbnails for build template cards (website, game, dashboard) |

---

## Evals Service

Offline evaluation pipeline (`services/evals/`) for measuring search quality via LLM-as-judge evaluators. Runs against sampled chat data in Phoenix experiments.

| File                                                 | Purpose                                                                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `services/evals/src/index.ts`                        | Evals entrypoint: samples chats, runs evaluators, guarantees `closeDb()` on all exit paths                                                                                                |
| `services/evals/src/config.ts`                       | Configuration with `validInt()` NaN-safe parsing for `SAMPLE_SIZE`, `LOOKBACK_HOURS`, judge model settings                                                                                |
| `services/evals/src/db.ts`                           | Database client for the evals service                                                                                                                                                     |
| `services/evals/src/error.ts`                        | Error helpers for the evals pipeline; `EvalSummaryPersistError` carries the `SuiteRunResult` through DB-write failures so the orchestrator can still apply threshold-breach exits         |
| `services/evals/src/eval-output.ts`                  | Eval output normalization, context formatting, and prompt extraction helpers                                                                                                              |
| `services/evals/src/eval-runner-client.ts`           | HTTP client for dispatching eval cases to the eval runner API endpoint                                                                                                                    |
| `services/evals/src/eval-summary.ts`                 | Persists per-suite eval summaries to `eval_summaries` plus per-case diagnostics to `eval_case_results`; computes evaluator score averages, app/judge metadata, and pass-rate basis points |
| `services/evals/src/judge-config.ts`                 | Judge model configuration with NaN-safe env parsing and reasoning settings                                                                                                                |
| `services/evals/src/judge-model.ts`                  | Creates the LLM judge model client via OpenRouter provider                                                                                                                                |
| `services/evals/src/orchestrator.ts`                 | Orchestrates eval suite execution by dispatching to the configured run mode                                                                                                               |
| `services/evals/src/retry.ts`                        | Exponential backoff retry with `maxAttempts >= 1` validation                                                                                                                              |
| `services/evals/src/retry.test.ts`                   | Tests for retry utility including zero-attempts edge case                                                                                                                                 |
| `services/evals/src/sampler.ts`                      | Samples coherent target turns from recent chats with parameterized SQL using canonical UI messages and citation metadata                                                                  |
| `services/evals/src/types.ts`                        | TypeScript type definitions for eval suites, run modes, cases, and results; exports `PersistedEvalSuite` (`Exclude<EvalSuite, 'smoke'>`)                                                  |
| `services/evals/src/evaluators/citation-accuracy.ts` | Citation accuracy evaluator — checks if citations match source content and claims                                                                                                         |
| `services/evals/src/evaluators/faithfulness.ts`      | Faithfulness evaluator — checks if answers are grounded in search results                                                                                                                 |
| `services/evals/src/evaluators/relevance.ts`         | Search relevance evaluator — checks if retrieved results are relevant to the query                                                                                                        |
| `services/evals/src/evaluators/response-quality.ts`  | Response quality evaluator — overall assessment of answer helpfulness and structure                                                                                                       |
| `services/evals/src/evaluators/safety.ts`            | Safety evaluator — checks responses for harmful, dangerous, or inappropriate content                                                                                                      |
| `services/evals/src/evaluators/tool-usage.ts`        | Tool usage evaluator — deterministic 4-level rubric for tool calls, results, and citations                                                                                                |
| `services/evals/src/golden/index.ts`                 | Golden dataset management with example loading and eval output construction                                                                                                               |
| `services/evals/src/golden/validate.ts`              | Golden dataset validation against evaluators to measure scoring accuracy                                                                                                                  |
| `services/evals/src/runners/capability.ts`           | Capability eval runner — executes the capability test suite                                                                                                                               |
| `services/evals/src/runners/regression.ts`           | Regression eval runner — executes the regression test suite                                                                                                                               |
| `services/evals/src/runners/shared.ts`               | Shared runner utilities for dataset creation, experiment execution, and threshold checks; split try/catch isolates Phoenix vs. DB persistence failures with distinct error labels         |
| `services/evals/src/runners/smoke.ts`                | Smoke test runner — executes lightweight smoke tests via live chat API                                                                                                                    |
| `services/evals/src/runners/traffic-monitor.ts`      | Traffic monitor runner — samples recent production target turns, replays them through `/api/evals/run`, evaluates the replayed output, and persists summaries                             |

---

## Tests

Test files are co-located with their source files using `__tests__/` directories.

| File                                                                    | Purpose                                                                                                   |
| ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `app/api/chat/__tests__/route.test.ts`                                  | Tests for the chat API route                                                                              |
| `app/api/feedback/__tests__/route.test.ts`                              | Tests for the feedback API route                                                                          |
| `app/api/suggestions/__tests__/route.test.ts`                           | Tests for the suggestions API route                                                                       |
| `app/api/advanced-search/__tests__/route.test.ts`                       | Tests for the advanced search API route                                                                   |
| `components/mode-selector.test.tsx`                                     | Tests for the three-mode selector                                                                         |
| `components/__tests__/research-process-section.test.tsx`                | Tests for the research process section component                                                          |
| `components/chat-request.test.ts`                                       | Tests for chat request utilities                                                                          |
| `components/chat.test.tsx`                                              | Tests for the main chat component                                                                         |
| `components/motion/pill-presence.test.tsx`                              | Tests for mode-pill presence and swap behavior                                                            |
| `components/motion/stagger-list.test.tsx`                               | Tests for capped timeline staggering                                                                      |
| `components/motion/tool-card-mount.test.tsx`                            | Tests for new-vs-hydrated tool-card animation                                                             |
| `components/tool-ui/competitor-research-result.test.tsx`                | Tests the dedicated `competitorResearch` result renderer                                                  |
| `components/tool-ui/agent-artifact/agent-artifact.test.tsx`             | Tests AgentArtifact tabs, active version copy, metadata, and download-friendly output                     |
| `components/tool-ui/agent-artifact/schema.test.ts`                      | Tests serializable Agent Artifact payload validation                                                      |
| `components/tool-ui/geo-map/__tests__/schema-mirror.test.ts`            | Tests the mirrored geo-map schema contract                                                                |
| `components/tool-ui/geo-map/__tests__/schema.test.ts`                   | Tests geo-map schema parsing and validation                                                               |
| `components/tool-ui/registry.test.tsx`                                  | Tests manifest renderer catalog sync and named Tool UI result rendering                                   |
| `components/tool-ui/tool-part-registry.test.tsx`                        | Tests module-local interactive dispatch for option list and question wizard tools                         |
| `components/render-message.test.tsx`                                    | Tests assistant message rendering, registered tool UI reloads, and canvas card deduping                   |
| `lib/actions/__tests__/chat.test.ts`                                    | Tests for chat server actions                                                                             |
| `lib/actions/__tests__/feedback.test.ts`                                | Tests for feedback server actions                                                                         |
| `lib/agents/__tests__/generate-trending-suggestions.test.ts`            | Tests for trending suggestions generation                                                                 |
| `lib/agents/__tests__/researcher.test.ts`                               | Tests for the researcher agent                                                                            |
| `lib/agents/__tests__/title-generator.test.ts`                          | Tests for chat title generation                                                                           |
| `lib/agents/chat/__tests__/community-portability.test.ts`               | Tests research activation, toolset execution, Tool UI rendering, and dynamic mapping                      |
| `lib/agents/chat/__tests__/specialists.test.ts`                         | Tests specialist schemas, active tool registration, and live specialist execution                         |
| `lib/db/__tests__/chat-ui-message-load.test.ts`                         | Tests canonical `uiMessage` load preference, manifest Tool UI reload, metadata merge, and upsert behavior |
| `lib/db/__tests__/rls-policies.integration.test.ts`                     | Integration tests for RLS policy enforcement                                                              |
| `lib/db/__tests__/with-rls.test.ts`                                     | Tests for RLS helper functions                                                                            |
| `lib/motion/hydration-boundary.test.tsx`                                | Tests initial tool-part tracking for motion                                                               |
| `lib/motion/part-ids.test.ts`                                           | Tests tool-part ID extraction from message data                                                           |
| `lib/motion/tokens.test.ts`                                             | Tests motion token snapshots                                                                              |
| `lib/motion/variants.test.ts`                                           | Tests reduced-motion variant resolution                                                                   |
| `lib/rate-limit/__tests__/guest-limit.test.ts`                          | Tests for guest rate limiting logic                                                                       |
| `lib/rate-limit/__tests__/rate-limit-fallback.test.ts`                  | Tests for rate limit fallback behavior                                                                    |
| `lib/streaming/__tests__/create-ephemeral-chat-stream-response.test.ts` | Tests for ephemeral streaming                                                                             |
| `lib/streaming/__tests__/prune-messages-integration.test.ts`            | Integration tests for message pruning                                                                     |
| `lib/streaming/helpers/__tests__/prepare-messages.test.ts`              | Tests message preparation and native interactive output continuations                                     |
| `lib/tools/__tests__/module-contract.test.ts`                           | Tests migrated tool folders and compatibility shims expose the stable module contract                     |
| `lib/utils/__tests__/message-mapping-ui-message.test.ts`                | Tests canonical `uiMessage` mapping for text, metadata, passive Tool UI, and interactive outputs          |
| `lib/tools/__tests__/display-geo-map.test.ts`                           | Tests geo-map tool validation and passthrough                                                             |
| `lib/tools/__tests__/fetch.test.ts`                                     | Tests for the fetch tool                                                                                  |
| `lib/tools/__tests__/geocode-address.test.ts`                           | Tests geocoding result normalization and errors                                                           |
| `lib/tools/__tests__/get-directions.test.ts`                            | Tests directions routing outputs and edge cases                                                           |
| `lib/tools/__tests__/get-isochrone.test.ts`                             | Tests isochrone polygon generation and failures                                                           |
| `lib/tools/__tests__/get-static-map-image.test.ts`                      | Tests static map URL generation                                                                           |
| `lib/tools/maptiler/__tests__/client.test.ts`                           | Tests MapTiler client configuration and URL building                                                      |
| `lib/tools/search/providers/__tests__/providers.test.ts`                | Tests for search provider implementations                                                                 |
| `lib/utils/__tests__/citation.test.ts`                                  | Tests for citation extraction and processing                                                              |
| `lib/utils/__tests__/context-window.test.ts`                            | Tests for token counting and message truncation                                                           |
| `lib/utils/__tests__/domain.test.ts`                                    | Tests for domain name extraction                                                                          |
| `lib/utils/__tests__/message-mapping-display-tools.test.ts`             | Tests for display tool message mapping                                                                    |
| `lib/utils/__tests__/message-utils.test.ts`                             | Tests for message utility functions                                                                       |
| `lib/utils/__tests__/model-selection.test.ts`                           | Tests for model resolution logic                                                                          |
| `lib/utils/__tests__/retry.test.ts`                                     | Tests for retry utility                                                                                   |
| `lib/utils/__tests__/search-config.test.ts`                             | Tests for search configuration                                                                            |

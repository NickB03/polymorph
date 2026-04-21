# Documentation Accuracy Audit Plan

> Date: 2026-04-21
> Repo: `/Users/nick/Projects/vana-v2`
> Goal: validate durable GitHub-visible docs against the current source code and config, then patch only verified drift.

## Scope

Primary scope for the first pass:

- Root docs: `README.md`, `SECURITY.md`, `CLAUDE.md`, `GEMINI.md`, `CONTRIBUTING.md`, `CHANGELOG.md`, `CODE_OF_CONDUCT.md`
- Durable docs under `docs/`
  - `docs/README.md`
  - `docs/architecture/*.md`
  - `docs/getting-started/*.md`
  - `docs/operations/*.md`
  - `docs/operations/runbooks/day-2-operations.md`
  - `docs/reference/*.md`

Excluded from the first pass:

- `docs/superpowers/**/*` plan/spec artifacts
- `docs/assets/*` except when needed to keep a diagram in sync with `README.md` / `docs/architecture/OVERVIEW.md`
- `.impeccable.md`

Reason: the primary pass should focus on current product, architecture, onboarding, ops, and policy docs rather than historical planning artifacts.

## Preflight Rules

1. Do not trust one doc to validate another. Every material claim must trace to code, config, tests, or runtime wiring.
2. Classify mismatches before editing:
   - docs drift only
   - real code bug exposed by docs review
   - intentionally aspirational/spec text
3. Preserve local work. The repo already has modified architecture docs and untracked plan files, so audit/edit in small bundles and avoid broad rewrites.
4. When architecture docs change, update `docs/reference/FILE-INDEX.md` in the same bundle if navigation or file descriptions drift.
5. For each bundle, finish with targeted verification:
   - link and path checks
   - targeted grep against source-of-truth files
   - formatting pass for touched markdown

## Agent Assignments

- `Euclid`: top-level + architecture docs
- `Ampere`: getting-started + operations docs
- `Maxwell`: reference docs
- `Descartes`: root GitHub docs

These agents already mapped likely drift hotspots and source-of-truth files; the execution plan below uses their output.

## Execution Order

### Phase 0: Top-level entrypoints

Audit first because these shape reader expectations and point into the rest of the docs.

1. `README.md`
   Source of truth:
   - `app/api/chat/route.ts`
   - `lib/agents/researcher.ts`
   - `lib/utils/model-selection.ts`
   - `lib/utils/registry.ts`
   - `lib/streaming/create-chat-stream-response.ts`
   - `components/tool-ui/registry.tsx`
   - `components/render-message.tsx`
   - geo/search provider files
     Checks:
   - feature bullets vs actual shipped capabilities
   - provider/model wording
   - architecture diagram vs current routing and conditional tool set

2. `docs/README.md`
   Source of truth:
   - the linked docs themselves
     Checks:
   - link rot
   - stale doc names
   - mismatched section labels

3. `docs/assets/architecture-mermaid.md`
   Audit only if `README.md` or `docs/architecture/OVERVIEW.md` diagrams are changed.

### Phase 1: Core architecture bundle

Audit together because they cross-reference the same runtime paths.

1. `docs/architecture/OVERVIEW.md`
2. `docs/architecture/SEARCH-PROVIDERS.md`
3. `docs/architecture/MODEL-CONFIGURATION.md`
4. `docs/architecture/STREAMING.md`
5. `docs/architecture/RESEARCH-AGENT.md`
6. `docs/architecture/GENERATIVE-UI.md`
7. `docs/architecture/GEO-TOOLS.md`
8. `docs/architecture/DECISIONS.md`
9. `docs/architecture/SKILLS-ROUTING.md`

Primary source-of-truth files for this phase:

- `app/api/chat/route.ts`
- `lib/agents/researcher.ts`
- `lib/agents/prompts/search-mode-prompts.ts`
- `lib/streaming/create-chat-stream-response.ts`
- `lib/streaming/create-ephemeral-chat-stream-response.ts`
- `lib/streaming/eval-chat-runner.ts`
- `lib/tools/search.ts`
- `lib/tools/search/providers/*`
- `lib/tools/search/advanced-search.ts`
- `app/api/advanced-search/route.ts`
- `lib/utils/search-config.ts`
- `config/models/default.json`
- `config/models/cloud.json`
- `lib/config/load-models-config.ts`
- `lib/utils/model-selection.ts`
- `lib/utils/registry.ts`
- `components/tool-ui/registry.tsx`
- `components/render-message.tsx`
- `lib/utils/message-mapping.ts`
- `lib/tools/display-*`
- `lib/tools/geocode-address.ts`
- `lib/tools/get-directions.ts`
- `lib/tools/get-isochrone.ts`
- `lib/tools/get-static-map-image.ts`
- `lib/tools/maptiler/client.ts`
- `components/tool-ui/geo-map/*`
- `lib/auth/is-admin.ts`
- `app/(admin)/admin/evals/page.tsx`
- `vercel.json`
- `app/api/suggestions/refresh/route.ts`
- `instrumentation.ts`
- `lib/analytics/track-chat-event.ts`

Known hotspots to verify early:

- search fallback chain and opt-in providers
- `build` mode routing through chat + intent
- `userMode` vs backend `searchMode` metadata
- conditional tool registration for canvas/image/eval contexts
- model config requiring `trendingSuggestions`
- cloud deployment flag semantics
- proposal/spec text in `SKILLS-ROUTING.md` vs shipped behavior

Recommended pass order within the bundle:

1. `OVERVIEW.md`
2. `SEARCH-PROVIDERS.md` + `MODEL-CONFIGURATION.md`
3. `STREAMING.md`
4. `RESEARCH-AGENT.md`
5. `GENERATIVE-UI.md` + `GEO-TOOLS.md`
6. `DECISIONS.md`
7. `SKILLS-ROUTING.md`

### Phase 2: Getting-started + operations bundle

Audit together because env, setup, deployment, and troubleshooting are tightly coupled.

1. `docs/getting-started/CONFIGURATION.md`
2. `docs/getting-started/ENVIRONMENT.md`
3. `docs/getting-started/QUICKSTART.md`
4. `docs/operations/DEPLOYMENT.md`
5. `docs/operations/DOCKER.md`
6. `docs/operations/TROUBLESHOOTING.md`
7. `docs/operations/runbooks/day-2-operations.md`

Primary source-of-truth files for this phase:

- `.env.local.example`
- `lib/config/env.ts`
- `lib/utils/index.ts`
- `lib/utils/registry.ts`
- `lib/tools/search.ts`
- `lib/tools/search/advanced-search.ts`
- `lib/utils/search-config.ts`
- `lib/tools/maptiler/client.ts`
- `lib/tools/get-isochrone.ts`
- `lib/rate-limit/guest-limit.ts`
- `lib/rate-limit/chat-limits.ts`
- `lib/supabase/middleware.ts`
- `lib/utils/public-origin.ts`
- `docker-compose.yaml`
- `Dockerfile`
- `package.json`
- `vercel.json`
- `app/api/suggestions/refresh/route.ts`
- `app/api/health/route.ts`
- `instrumentation.ts`
- `lib/canvas/guest-token.ts`
- `lib/supabase/storage.ts`
- `services/evals/Dockerfile`
- `services/evals/package.json`
- `services/evals/src/config.ts`
- `services/evals/src/judge-config.ts`

Known hotspots to verify early:

- `NEXT_PUBLIC_POLYMORPH_CLOUD_DEPLOYMENT` docs-only references
- actual cloud deployment flags and fallback behavior
- Quickstart “required vars” wording vs real search/auth requirements
- Docker/public-origin defaults
- Vercel cron docs vs `vercel.json` and refresh route
- evals env matrix incompleteness
- troubleshooting guidance for Brave-first search routing and guest-limit behavior

Recommended pass order within the bundle:

1. `CONFIGURATION.md` + `ENVIRONMENT.md`
2. `QUICKSTART.md`
3. `DEPLOYMENT.md` + `DOCKER.md`
4. `TROUBLESHOOTING.md`
5. `day-2-operations.md`

### Phase 3: Reference bundle

Audit together because these docs drift with route and file-tree changes.

1. `docs/reference/API.md`
2. `docs/reference/FILE-INDEX.md`
3. `docs/reference/ESLINT-CONVENTIONS.md`

Primary source-of-truth files for this phase:

- `app/api/**/route.ts`
- helper libs used by routes:
  - `lib/actions/chat.ts`
  - `lib/actions/feedback.ts`
  - `lib/tools/search/advanced-search.ts`
  - `lib/voice/config.ts`
  - `lib/voice/tts-provider.ts`
  - `lib/canvas/service.ts`
  - `lib/canvas/guest-token.ts`
  - `lib/auth/get-current-user.ts`
  - `lib/utils/json-error.ts`
  - `lib/utils/file-validation.ts`
  - `lib/utils/search-mode.ts`
  - `lib/utils/registry.ts`
  - `lib/supabase/middleware.ts`
- repo tree:
  - `app/**`
  - `components/**`
  - `lib/**`
  - `tests/**`
  - `scripts/**`
  - `drizzle/**`
  - `services/evals/**`
  - `public/**`
- lint surfaces:
  - `eslint.config.mjs`
  - `tests/eslint-config.test.ts`
  - `package.json`

Known hotspots to verify early:

- `API.md` route details for feedback, suggestions, and health
- `FILE-INDEX.md` route inventory lag around advanced search, canvas, evals, and observability files
- `ESLINT-CONVENTIONS.md` carve-outs and ignore-path accuracy

Recommended pass order within the bundle:

1. `API.md`
2. `FILE-INDEX.md`
3. `ESLINT-CONVENTIONS.md`

### Phase 4: Root policy/process docs

Split between deep audits and quick consistency checks.

Deep audits:

1. `SECURITY.md`
2. `CLAUDE.md`
3. `GEMINI.md`

Quick consistency checks:

4. `CONTRIBUTING.md`
5. `CHANGELOG.md`
6. `CODE_OF_CONDUCT.md`

Primary source-of-truth files for this phase:

- `app/(admin)/layout.tsx`
- `lib/auth/is-admin.ts`
- `app/api/chat/route.ts`
- `app/api/upload/route.ts`
- `app/api/suggestions/refresh/route.ts`
- `lib/db/schema.ts`
- `lib/db/admin.ts`
- `lib/canvas/**`
- `lib/canvas/validation/validate-canvas-source.ts`
- `app/api/canvas-artifacts/*`
- `lib/config/env.ts`
- `proxy.ts`
- `package.json`
- `eslint.config.mjs`
- `.claude/rules/*.md`
- `docs/getting-started/*.md`
- `docs/architecture/*.md`
- `instrumentation.ts`
- `services/evals/package.json`
- `services/evals/src/*`
- `.github/workflows/{ci,docker-build,release}.yml`
- `.github/ISSUE_TEMPLATE/*`
- `prettier.config.js`
- `config/models/*.json`
- `LICENSE`
- repo GitHub identity

Known hotspots to verify early:

- exact admin route and guest-mode wording in `SECURITY.md`
- command list and “must pass” assertions in `CLAUDE.md`
- provider/model/search/evals wording in `GEMINI.md`
- CI quality-gate and Bun-version drift in `CONTRIBUTING.md`
- release-note/codepath mismatch in `CHANGELOG.md`

## Per-doc Audit Checklist

Use this checklist on every doc, regardless of bundle:

1. Identify all claims that describe:
   - route names or access rules
   - env vars
   - provider/model defaults
   - tool availability
   - job/cron behavior
   - command names
   - test or CI requirements
2. For each claim, attach a source-of-truth file reference.
3. Mark each claim as:
   - `verified`
   - `stale`
   - `needs runtime confirmation`
   - `intentional proposal/spec`
4. Patch only after classification.
5. Re-read the whole doc for stale wording left behind by partial edits.
6. If the doc changed route names, architecture inventory, or file ownership, update linked docs and `docs/reference/FILE-INDEX.md` in the same bundle.

## Verification Commands

Run targeted commands instead of broad repo scans for every doc.

Suggested command patterns:

```bash
rg -n "claim-or-term" app lib components docs services/evals
rg --files app lib components docs services/evals
bun run format:check
bun x prettier --write <touched-docs>
```

Bundle-specific checks:

- architecture/model/search docs:
  - `rg -n "SEARCH_API|BRAVE_SEARCH_API_KEY|TAVILY_API_KEY|EXA_API_KEY|SEARXNG|FIRECRAWL|POLYMORPH_CLOUD_DEPLOYMENT|VANA_CLOUD_DEPLOYMENT|trendingSuggestions|userMode|searchMode" lib app config docs`
- ops/env/docs:
  - `rg -n "NEXT_PUBLIC_POLYMORPH_CLOUD_DEPLOYMENT|CRON_SECRET|PHOENIX|JUDGE_|EVAL_|ENABLE_AUTH|NEXT_PUBLIC_APP_URL" .env.local.example lib app services/evals docs Dockerfile docker-compose.yaml vercel.json`
- reference docs:
  - `rg -n "export async function|NextResponse|route.ts" app/api`
  - `rg -n "eslint-disable|no-restricted-imports|report-unused-disable-directives" eslint.config.mjs tests package.json`

## Deliverables

For each bundle, produce:

1. a verified finding list
2. the doc patches
3. any real code bugs uncovered by docs review, called out separately from docs drift
4. targeted verification notes

Final output for the full audit:

- `ready` / `not ready` status per doc
- list of docs patched
- list of docs intentionally left unchanged because they were already accurate
- list of code bugs exposed by the docs audit

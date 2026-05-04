# Contributing to Polymorph

Thank you for your interest in contributing to Polymorph! This document provides guidelines and instructions for contributing.

## Code of Conduct

By participating in this project, you are expected to uphold our [Code of Conduct](CODE_OF_CONDUCT.md).

## Prerequisites

- **Bun** 1.3.9 (matches CI and the `engines` pin in `package.json`)
- **Node.js** 18+
- **Docker** (required for Supabase CLI local development)
- **Git**

## How to Contribute

### Reporting Issues

- Check if the issue already exists in this repository's GitHub Issues
- Use the issue templates when creating a new issue
- Provide as much context as possible

### Pull Requests

1. Fork the repository
2. Create a new branch from `main`:
   ```bash
   git checkout -b feat/your-feature-name
   ```
3. Make your changes
4. Commit your changes using conventional commits:
   ```bash
   git commit -m "feat: add new feature"
   ```
5. Push to your fork
6. Open a Pull Request

### Commit Convention

We use conventional commits. Examples:

- `feat: add new feature`
- `fix: resolve issue with X`
- `docs: update README`
- `chore: update dependencies`
- `refactor: improve code structure`

### Development Setup

1. Clone the repository and install dependencies:

   ```bash
   git clone https://github.com/NickB03/polymorph.git
   cd polymorph
   bun install
   ```

2. Set up environment variables:

   ```bash
   cp .env.local.example .env.local
   ```

   See [Environment Reference](docs/getting-started/ENVIRONMENT.md) for the full variable reference.

3. Start local Supabase (requires Docker):

   ```bash
   npx supabase start
   ```

   This uses custom ports: DB on 44322, API on 44321, Studio on 44323.

4. Run database migrations:

   ```bash
   bun run migrate
   ```

5. Start the dev server:

   ```bash
   bun dev
   ```

   The app runs on [http://localhost:43100](http://localhost:43100).

For troubleshooting setup issues, see [Troubleshooting](docs/operations/TROUBLESHOOTING.md).

## Quality Gate

All of the following checks must pass before submitting a PR. These are also enforced by GitHub Actions CI on every push:

```bash
bun lint && bun typecheck && bun format:check && bun run test && bun run build
```

You can fix auto-fixable lint and format issues with:

```bash
bun lint --fix
bun format
```

## Code Style

### Formatting (Prettier)

- No semicolons
- Single quotes
- No trailing commas
- 2-space indentation
- Avoid arrow parens where possible
- LF line endings

### Import Order (ESLint enforced)

Imports are sorted by the `simple-import-sort` ESLint plugin. The required order:

```typescript
// 1. React / Next.js
import { useState } from 'react'
import { useRouter } from 'next/navigation'

// 2. Third-party packages
import { tool } from 'ai'
import { z } from 'zod'

// 3. Internal paths (ordered by depth)
import { SearchResults } from '@/lib/types'
import { getModel } from '@/lib/utils/registry'
import { useCurrentUser } from '@/hooks/use-current-user'
import { Button } from '@/components/ui/button'
import { SearchSection } from '@/components/search-section'
```

Run `bun lint --fix` to auto-sort imports.

### Path Aliases

Always use `@/` path aliases instead of relative imports:

```typescript
// Correct
import { getModel } from '@/lib/utils/registry'

// Avoid
import { getModel } from '../../../lib/utils/registry'
```

## Testing

- **Framework:** Vitest
- **Test location:** Co-located `__tests__/` directories next to source files
- **Run once:** `bun run test`
- **Watch mode:** `bun run test:watch`

When adding new functionality, include tests where practical. Tests should focus on logic and edge cases rather than implementation details.

## Adding a New Tool

Three chat agents (`search`, `research`, `build`) share a common toolset wired through `lib/agents/chat/`. Each agent declares its own `*_AGENT_ACTIVE_TOOLS` array; canvas and image tools are registered conditionally inside `factory.ts` based on context. To add a new tool:

1. **Create the tool module.** Most tools live in their own directory under `lib/tools/<my-tool>/` with `schema.ts` (Zod input/output), `server.ts` (the `tool({ ... })` definition), and — if it renders inline — `client.tsx`, `result.tsx`, and `_adapter.tsx`. See `lib/tools/display-link-preview/` or `lib/tools/generate-image/` as templates. Single-file tools (e.g. `lib/tools/display-callout.ts`) are fine for tools without a separate UI surface.

2. **Add the tool to the shared type and factory** in `lib/agents/chat/toolset.ts`:
   - Add a property to the `ChatAgentTools` type.
   - Import the tool and return it from `createChatAgentTools()`.
   - For tools that need request-scoped context (a userId, canvas emitter, etc.), follow the pattern of `createCanvasArtifactTool(canvasToolContext)` — accept context as a factory arg in `CreateChatAgentToolsArgs`.

3. **Activate the tool per agent.** Add the tool's key to the relevant `*_AGENT_ACTIVE_TOOLS` array in `lib/agents/chat/search.ts`, `research.ts`, or `build.ts` (or all three). Tools that should only appear when canvas or image-gen context is present go through the conditional `activeTools.push(...)` blocks in `lib/agents/chat/factory.ts` instead.

4. **Wire the UI component** if the tool produces visible output. Add the renderer to `components/tool-ui/<my-tool>/`, register it in `components/tool-ui/registry.tsx`, and map the tool's raw output to component props via an `_adapter.tsx`. Existing examples like `components/tool-ui/citation/` and `components/tool-ui/geo-map/` show the full pattern.

5. **Persist new message-part types** in `lib/db/schema.ts` only if the tool needs a part shape that doesn't fit the existing `parts` table conventions. Most display tools don't need schema changes.

> Note: `lib/agents/researcher.ts` is now a thin compatibility shim around `createChatAgent`. New tool registrations belong in `lib/agents/chat/`, not in `researcher.ts`.

## Architecture Reference

For a detailed understanding of the system architecture, data flow, and component relationships, see [Architecture Overview](docs/architecture/OVERVIEW.md).

## License

By contributing, you agree that your contributions will be licensed under the Apache-2.0 License.

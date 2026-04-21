# Security Policy

## Supported Versions

| Version       | Supported |
| ------------- | --------- |
| `main` branch | Yes       |

Only the latest commit on the `main` branch receives security updates.

## Reporting a Vulnerability

If you discover a security vulnerability, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

1. Use [GitHub's private vulnerability reporting](https://github.com/NickB03/polymorph/security/advisories/new) to submit a description of the vulnerability, steps to reproduce, and any relevant logs or screenshots.
2. You will receive an acknowledgment within **48 hours**.
3. We will investigate and provide a fix or mitigation plan within **90 days** of the initial report.
4. Once a fix is released, we will publicly disclose the vulnerability with credit to the reporter (unless anonymity is requested).

## Security Model

### Authentication

Polymorph uses [Supabase Auth](https://supabase.com/docs/guides/auth) for user authentication.

- Session tokens are refreshed automatically via Next.js middleware (`proxy.ts` → `lib/supabase/middleware.ts`). The middleware runs on every non-static request and refreshes the session; it is not the layer that protects individual routes.
- Route-level access control happens in each route's layout/handler, not middleware:
  - `/` (root chat) — public when `ENABLE_GUEST_CHAT=true` (default); otherwise requires sign-in.
  - `/auth/*` — always public (login, sign-up, forgot-password, confirm, OAuth, etc.).
  - `/share/*` — public read-only chat sharing.
  - `/api/chat` — accepts guest traffic when `ENABLE_GUEST_CHAT=true`; otherwise requires an authenticated session. IP-rate-limited for guests in cloud deployments.
  - `/api/suggestions/refresh` — **not** user auth. Requires `Authorization: Bearer <CRON_SECRET>`. Intended only for the Vercel daily cron.
  - `/admin/*` — under the `app/(admin)/` route group. `app/(admin)/layout.tsx` redirects unauthenticated requests to `/auth/login`, then returns `notFound()` unless `isAdminUserId(user.id)` matches the single configured `ADMIN_USER_ID` env var.
- Authentication can be disabled for local development with `ENABLE_AUTH=false` (not permitted when `POLYMORPH_CLOUD_DEPLOYMENT=true`). In that mode API handlers use an anonymous user ID, but the admin route group still requires a Supabase session and a matching `ADMIN_USER_ID`; anonymous requests never gain admin access.

### Row-Level Security (RLS)

All database tables enforce PostgreSQL Row-Level Security via `current_setting('app.current_user_id')`:

- **chats** -- Users can only read, create, update, and delete their own chats. Chats with `visibility = 'public'` are readable by anyone.
- **messages** -- Access is granted only when the user owns the parent chat (verified via `EXISTS` subquery).
- **parts** -- Access is granted only when the user owns the parent chat (verified via join through `messages` to `chats`).
- **canvasArtifacts**, **canvasArtifactVersions** -- Access scoped to the owning user via the parent chat chain.
- **artifacts**, **artifactRevisions**, **artifactRuntimeSessions** -- Legacy artifact tables; access scoped to the owning user via the parent artifact/chat chain.
- **feedback** -- Anyone can insert feedback; all feedback is readable (no sensitive user data stored).

RLS is enabled on every table (`enableRLS()` in the Drizzle schema at `lib/db/schema.ts`).

### File Upload Restrictions

The upload endpoint (`app/api/upload/route.ts`) enforces the following:

- **Authentication required** -- only logged-in users can upload files.
- **Maximum file size** -- 5 MB.
- **Allowed MIME types** -- `image/png`, `image/jpeg`, `image/gif`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`.
- Files are stored in a Supabase Storage bucket scoped per user.

### Rate Limiting

- **Guest chat** -- daily request limits enforced via Upstash Redis in cloud deployments when `ENABLE_GUEST_CHAT=true`.
- **Authenticated users** -- overall chat limits enforced via Upstash Redis in cloud deployments.
- Rate-limit state is stored in Redis and is not persisted in the primary database.

### Scheduled job secrets

- `CRON_SECRET` protects the Vercel cron endpoint `/api/suggestions/refresh`. The handler rejects any request whose `Authorization` header does not match `Bearer <CRON_SECRET>` (401). Rotate in the Vercel dashboard if leaked.
- `ADMIN_USER_ID` is a Supabase user ID — not a secret per se, but a gate: only requests whose authenticated session's `user.id` matches this string can access `/admin/*`.

### Guest Mode Isolation

- Guest sessions are ephemeral and are not persisted to the database.
- Guest sessions default to the `speed` model type.
- Guest chat requires `ENABLE_GUEST_CHAT=true`; otherwise, unauthenticated requests receive `401 Unauthorized`.

### Canvas Artifact Isolation

Canvas artifacts are compiled from a locked virtual file set and rendered inside a sandboxed iframe:

- **Source validation** -- only the allowed canvas files (`App.tsx`, `components.tsx`, `styles.css`, `meta.json`) are accepted. Arbitrary npm packages, Node.js APIs, remote script injection, and unsupported files are rejected before compile.
- **Server-side compile pipeline** -- the server bundles validated source with `esbuild`, generates Tailwind CSS, and persists single-file HTML. User source is compiled, not executed, during this step.
- **Sandboxed preview** -- rendered HTML is shown through `iframe.srcdoc` with `sandbox="allow-scripts"` and a locked CSP. Runtime diagnostics are posted back through a narrow `postMessage` contract.
- **Guest canvas tokens** -- HMAC-SHA256 signed guest tokens (`GUEST_CANVAS_SECRET`) scope guest access to a specific `chatId` + `artifactId`. Verification is fail-closed, and successful write operations rotate the token.

## Out of Scope

The following are **not** considered vulnerabilities under this policy:

- Denial-of-service attacks against the application or infrastructure.
- Social engineering of project maintainers or contributors.
- Vulnerabilities in third-party dependencies that are already publicly disclosed (please open a regular issue to help us track the upgrade).
- Issues that require physical access to a user's device.
- Missing security headers or best-practice deviations that do not lead to a concrete exploit.

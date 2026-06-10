# Environment Local Setup

> **Audience:** New Developer | Contributor
> **Prerequisites:** [Environment Reference](ENVIRONMENT.md)

This leaf covers local environment setup and implementation details for guest chat and cloud mode.

## Local setup workflow

1. `cp .env.local.example .env.local`
2. Start local Supabase CLI: `npx supabase start`
   - **Note:** This project uses a custom port range (**4432x**) to avoid conflicts with other Supabase projects.
3. Fill required variables in `.env.local`:
   - `DATABASE_URL=postgresql://postgres:postgres@localhost:44322/postgres`
   - `OPENROUTER_API_KEY=[YOUR_OPENROUTER_KEY]`
   - `BRAVE_SEARCH_API_KEY=[YOUR_BRAVE_SEARCH_KEY]` (or another `SEARCH_API` provider)
   - `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:44321`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY=[YOUR_SUPABASE_ANON_KEY]`
   - `DATABASE_SSL_DISABLED=true` (Required for local DB)
   - If you want anonymous local access instead of Supabase Auth, set `ENABLE_GUEST_CHAT=true` and skip the Supabase keys above.
4. **Docker Networking:** If running the app via Docker, the container must use `host.docker.internal:44322` for the database URL (this is pre-configured in `docker-compose.yaml`).
5. `bun run migrate`
6. `bun dev`

## Implementation Details

### Guest Chat (`ENABLE_GUEST_CHAT`)

Guest mode lets unauthenticated users search immediately without signing in — reducing friction and letting users experience the product before creating an account.

- Set `ENABLE_GUEST_CHAT=true` to allow unauthenticated users to search.
- Leave it unset or set it to `false` to require sign-in before any search.
- Guest sessions are ephemeral: chats are not persisted, and the UI defaults guests to speed-mode models.
- `GUEST_CHAT_DAILY_LIMIT` (default: `10`) caps daily searches per IP. It is enforced only in cloud mode when Redis is configured; otherwise the app allows requests without applying the guest limit.

### Cloud Mode (`POLYMORPH_CLOUD_DEPLOYMENT`)

- Enabling this mode turns on the cloud-only code paths used for analytics and rate limiting.
- If `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are present, guest and authenticated chat limits are enforced through Redis.
- If Redis is missing or unreachable, the app still boots and the limit checks fall back to allow-all / in-memory behavior.

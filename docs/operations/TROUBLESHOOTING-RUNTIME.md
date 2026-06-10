# Troubleshooting Runtime Issues

> **Audience:** New Developer | Operator
> **Prerequisites:** [Troubleshooting](TROUBLESHOOTING.md)

This leaf covers auth, share-page, Supabase timeout, and rate-limit runtime symptoms.

## Runtime Issues

### 401 Unauthorized on `/api/chat`

**Symptoms:** Chat requests return `401 Unauthorized` with body `Authentication required`.

**Causes:**

1. **Auth enabled but Supabase not configured.** If `ENABLE_AUTH` is not set to `false` (it defaults to `true`), then `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` must be set.

2. **Expired or missing session.** The user's Supabase session has expired. The middleware refreshes sessions automatically, but if Supabase is unreachable, authentication silently fails.

3. **Guest chat not enabled.** If the user is not logged in and `ENABLE_GUEST_CHAT` is not `true`, the API returns 401.

**Fix for local dev without auth:**

```
ENABLE_AUTH=false
```

This uses a shared anonymous user ID. Not allowed in cloud deployments.

### 403 Forbidden on Share Page

**Symptoms:** Accessing `/share/<chatId>` returns 403 or shows no data.

**Causes:**

1. The chat has not been set to `public`. Only chats with `visibility = 'public'` are accessible via the share URL.
2. RLS policy mismatch. The database Row-Level Security policies allow public reads only for chats marked as public.

**Fix:** Ensure the chat visibility has been toggled to public by its owner.

### `getUser` Timeout

**Symptoms:** Pages load slowly or fail intermittently. Console shows `[proxy] getUser failed: Error: getUser timeout`.

The middleware (`lib/supabase/middleware.ts`) wraps `supabase.auth.getUser()` in a 5-second timeout via `Promise.race`. If Supabase is slow or unreachable, the timeout fires and the user is treated as unauthenticated.

**Causes:**

- Local Supabase is not running (`npx supabase start`)
- Network issue reaching the Supabase URL
- `NEXT_PUBLIC_SUPABASE_URL` points to a wrong or unreachable host

**Fix:** Verify Supabase is running and the URL is correct:

```bash
npx supabase status
curl http://127.0.0.1:44321/rest/v1/ -H "apikey: <your-anon-key>"
```

### Rate Limit Exceeded

**Symptoms:** Guest users see `Please sign in to continue.` (401). Authenticated users see `Daily chat limit reached. Please try again tomorrow.` (429).

**Guest limits:** Default is 10 chats per day per IP. Configurable via `GUEST_CHAT_DAILY_LIMIT`. Only enforced in cloud deployments (`POLYMORPH_CLOUD_DEPLOYMENT=true`) with Upstash Redis configured.

**Authenticated user limits:** Default is 100 chats per day. Only enforced in cloud deployments.

Rate limit data is stored in Upstash Redis with keys:

- Guest: `rl:guest:chat:<ip>:<date>`
- Authenticated: `rl:chat:<userId>:<date>`

Limits reset at midnight UTC.

**Fix for local dev:** Rate limits are not enforced unless `POLYMORPH_CLOUD_DEPLOYMENT=true`. If testing rate limits locally, ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set.

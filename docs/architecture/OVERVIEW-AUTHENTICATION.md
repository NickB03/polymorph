# Architecture Authentication Flow

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf documents Supabase auth flow, client creation patterns, middleware behavior, and guest-mode handling.

## Authentication Flow

Supabase Auth is used with three client creation patterns depending on the execution context. The middleware intercepts every request to refresh sessions and enforce authentication on protected routes.

```mermaid
flowchart TD
    Request["Incoming Request"]
    MW["Next.js Middleware<br/>(lib/supabase/middleware.ts)"]
    CreateClient["createServerClient()<br/>with cookie bridge"]
    GetUser["supabase.auth.getUser()<br/>(5s timeout via Promise.race)"]
    UserExists{"User found?"}
    PublicPath{"Is public path?<br/>/, /auth, /share, /api"}
    Redirect["Redirect to /auth/login"]
    Continue["Continue with<br/>supabaseResponse"]

    subgraph ClientPatterns["Three Supabase Client Patterns"]
        BrowserClient["Browser Client<br/>(lib/supabase/client.ts)<br/>createBrowserClient()"]
        ServerClient["Server Client<br/>(lib/supabase/server.ts)<br/>createServerClient()<br/>via cookies()"]
        MWClient["Middleware Client<br/>(lib/supabase/middleware.ts)<br/>createServerClient()<br/>with request/response<br/>cookie bridge"]
    end

    subgraph GuestMode["Guest Mode (ENABLE_GUEST_CHAT=true)"]
        ExtractIP["Extract IP from<br/>x-forwarded-for | x-real-ip"]
        RateLimit["checkAndEnforceGuestLimit()<br/>(Upstash Redis)"]
        ModelPreference["Honor modelType cookie<br/>(UI defaults to speed)"]
        EphemeralStream["Ephemeral stream<br/>(no DB persistence)"]
    end

    Request --> MW --> CreateClient --> GetUser --> UserExists
    UserExists -->|Yes| Continue
    UserExists -->|No| PublicPath
    PublicPath -->|Yes| Continue
    PublicPath -->|No| Redirect

    Continue -->|"POST /api/chat<br/>no userId"| ExtractIP
    ExtractIP --> RateLimit --> ModelPreference --> EphemeralStream
```

### Client pattern details

| Pattern    | File                         | Context                       | Cookie Access                   |
| ---------- | ---------------------------- | ----------------------------- | ------------------------------- |
| Browser    | `lib/supabase/client.ts`     | Client components             | Browser cookies (automatic)     |
| Server     | `lib/supabase/server.ts`     | Server components, API routes | `cookies()` from `next/headers` |
| Middleware | `lib/supabase/middleware.ts` | Request middleware            | Request/response cookie bridge  |

The middleware cookie bridge is critical: it creates a Supabase server client that can read request cookies and write updated session tokens back to the response. The source code warns not to add code between `createServerClient` and `getUser()` to avoid session desync.

The `getUser` call in middleware uses `Promise.race` with a 5-second timeout to avoid blocking on slow Supabase responses. If the timeout fires, the user is treated as unauthenticated.

**Source files:** [`lib/supabase/client.ts`](../../lib/supabase/client.ts), [`lib/supabase/server.ts`](../../lib/supabase/server.ts), [`lib/supabase/middleware.ts`](../../lib/supabase/middleware.ts)

---

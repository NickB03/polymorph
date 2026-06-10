# Evals API and Rate Limits

> **Audience:** Contributor | Operator
> **Prerequisites:** [API Reference](API.md)

This leaf covers eval replay, cloud rate limits, and shared error response conventions.

## POST `/api/evals/run`

Runs an evaluation chat through the chat agent pipeline without creating or mutating persisted chat rows. Used by the evals service to replay test conversations, including sampled traffic-monitor target turns, and capture agent output. The `smoke` runner normally exercises `/api/chat` instead.

**Authentication:** Required (`x-eval-runner-secret` header must match `EVAL_RUNNER_SECRET` env var)

#### Request Body

```typescript
{
  caseId: string // Unique identifier for the eval case
  suite: 'capability' | 'regression' | 'smoke' | 'traffic-monitor'
  conversation: Array<{
    // Message history to replay
    role: 'user' | 'assistant'
    parts: Array<{ type: 'text'; text: string }>
  }>
  searchMode: 'chat' | 'research'
  modelType: 'speed' | 'quality'
  userMode?: 'search' | 'research' | 'build' // Optional; carries the original UI mode through replay
  intent?: string // Optional; carried from the source chat. The traffic-monitor sampler forwards this so build-mode replays preserve `'build'`. Validated as z.string().optional() — the route does not enforce a specific value.
  corpusVersion?: string // Optional; pins the eval against a specific golden-corpus revision
}
```

| Field           | Type     | Required | Description                                                                                                                                                                                                                                   |
| --------------- | -------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `caseId`        | `string` | Yes      | Identifier for the evaluation case.                                                                                                                                                                                                           |
| `suite`         | `string` | Yes      | Eval suite: `capability`, `regression`, `smoke`, or `traffic-monitor`.                                                                                                                                                                        |
| `conversation`  | `array`  | Yes      | Message array with `role` and `parts` for each message.                                                                                                                                                                                       |
| `searchMode`    | `string` | Yes      | Agent mode: `chat` or `research`.                                                                                                                                                                                                             |
| `modelType`     | `string` | Yes      | Model tier: `speed` or `quality`.                                                                                                                                                                                                             |
| `userMode`      | `string` | No       | Original UI mode (`search`, `research`, or `build`). Required for faithful traffic-monitor replay of `build`-mode chats.                                                                                                                      |
| `intent`        | `string` | No       | Carried through from the source chat's `intent`. The traffic-monitor sampler (`services/evals/src/sampler.ts`) forwards this so build-mode replays preserve `'build'`. Validated as any string — the route does not enforce a specific value. |
| `corpusVersion` | `string` | No       | Pins the eval against a specific golden-corpus revision; omit to use the runner's current corpus.                                                                                                                                             |

#### Response

**Content-Type:** `application/json`

Returns the eval chat result. Response is not cached (`Cache-Control: no-store`).

```typescript
{
  answerText: string
  citations: Array<{ url: string; title: string }>
  searchResults: Array<{
    query: string
    results: Array<{ title: string; url: string; snippet: string }>
  }>
  toolNames: string[]
  usedInteractiveOnlyOutput: boolean
  modelId: string
  correlationId?: string
  otelTraceId?: string
  traceId?: string // Legacy alias for correlationId
  durationMs: number
}
```

#### Error Responses

| Status | Condition                                 |
| ------ | ----------------------------------------- |
| `400`  | Invalid request body (schema validation). |
| `401`  | Missing `x-eval-runner-secret` header.    |
| `403`  | Invalid eval runner secret.               |
| `500`  | Unexpected server error during eval run.  |

---

## Rate Limiting

Rate limits are enforced only in **cloud deployments** (`POLYMORPH_CLOUD_DEPLOYMENT=true`) using Upstash Redis.

### Guest Rate Limits

| Setting    | Default                | Description                                        |
| ---------- | ---------------------- | -------------------------------------------------- |
| Limit      | 10 requests/day        | Configurable via `GUEST_CHAT_DAILY_LIMIT` env var. |
| Window     | Resets at midnight UTC | Key: `rl:guest:chat:{ip}:{date}`                   |
| Identifier | Client IP address      | From `x-forwarded-for` or `x-real-ip` headers.     |

When the guest limit is exceeded, the response is:

```json
{
  "code": "GUEST_LIMIT",
  "error": "You’ve reached your daily search limit. Create a free account for unlimited access, or come back tomorrow.",
  "remaining": 0,
  "resetAt": 1706745600000,
  "limit": 10
}
```

**Status:** `429 Too Many Requests`
**Headers:**

- `X-RateLimit-Limit` -- Daily limit
- `X-RateLimit-Remaining` -- Remaining requests
- `X-RateLimit-Reset` -- UTC timestamp (ms) when the limit resets

### Authenticated Rate Limits

| Setting    | Value                  | Description                                        |
| ---------- | ---------------------- | -------------------------------------------------- |
| Limit      | 100 requests/day       | Configurable via `DAILY_CHAT_LIMIT` (default 100). |
| Window     | Resets at midnight UTC | Key: `rl:chat:{userId}:{date}`                     |
| Identifier | Supabase user ID       | Extracted from auth session.                       |

When the authenticated limit is exceeded, the response is:

```json
{
  "error": "Daily chat limit reached. Please try again tomorrow.",
  "remaining": 0,
  "resetAt": 1706745600000,
  "limit": 100
}
```

**Status:** `429 Too Many Requests`
**Headers:**

- `X-RateLimit-Limit` -- Daily limit
- `X-RateLimit-Remaining` -- Remaining requests
- `X-RateLimit-Reset` -- UTC timestamp (ms) when the limit resets

### Non-Cloud Deployments

When not in cloud deployment mode (or when Upstash Redis is not configured), all rate limits are bypassed and requests are allowed without restriction.

---

## Error Response Conventions

All API endpoints follow consistent error patterns:

| Status | Meaning                                                     |
| ------ | ----------------------------------------------------------- |
| `200`  | Success.                                                    |
| `400`  | Bad request -- missing or invalid parameters.               |
| `401`  | Unauthorized -- authentication required.                    |
| `403`  | Forbidden -- action not allowed in the current context.     |
| `404`  | Not found -- requested resource or provider does not exist. |
| `429`  | Too many requests -- rate limit exceeded.                   |
| `500`  | Internal server error -- unexpected failure.                |

Error bodies vary by endpoint:

- **Chat endpoints** return JSON error bodies; feedback returns plain text responses.
- **Upload and chats endpoints** return JSON with an `error` field.
- **Rate limit responses** return JSON with `error`, `remaining`, `resetAt`, and `limit` fields plus `X-RateLimit-*` headers.

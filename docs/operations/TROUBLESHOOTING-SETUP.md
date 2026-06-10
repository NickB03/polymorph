# Troubleshooting Setup Issues

> **Audience:** New Developer | Operator
> **Prerequisites:** [Troubleshooting](TROUBLESHOOTING.md)

This leaf covers environment, port, SSL, and provider-enable setup problems.

## Setup Issues

### Missing `.env.local`

**Symptoms:** App fails to start with errors about undefined environment variables, or crashes immediately on `bun dev`.

**Fix:**

```bash
cp .env.local.example .env.local
```

Then fill in the required values. See [Environment Reference](../getting-started/ENVIRONMENT.md) for the full variable reference. At minimum you need:

- `DATABASE_URL`
- `OPENROUTER_API_KEY`
- `BRAVE_SEARCH_API_KEY` (or another search provider key)

### Port Conflicts

**Symptoms:** `npx supabase start` fails, or Supabase services are unreachable.

This project uses a **custom port range (4432x)** to avoid conflicts with other Supabase projects:

| Service  | Port  |
| -------- | ----- |
| Database | 44322 |
| API      | 44321 |
| Studio   | 44323 |

Check if ports are in use:

```bash
lsof -i :44321 -i :44322 -i :44323
```

If another Supabase project is running, stop it first:

```bash
npx supabase stop
```

### `DATABASE_SSL_DISABLED` Not Set

**Symptoms:** Database connections fail with SSL-related errors when using local Supabase CLI. You may see errors like `error: connection requires a valid client certificate` or `ECONNREFUSED`.

**Fix:** Add to `.env.local`:

```
DATABASE_SSL_DISABLED=true
```

This is required for local development with Supabase CLI because the local PostgreSQL instance does not use SSL. Do **not** set this in production.

### "Provider not enabled" Error

**Symptoms:** HTTP 404 response from `/api/chat` with body `Provider not enabled: <providerId>`.

This happens when the selected AI model's provider has no API key configured. The `isProviderEnabled()` function in `lib/utils/registry.ts` checks for the appropriate key:

| Provider            | Required Variable                                              |
| ------------------- | -------------------------------------------------------------- |
| `openrouter`        | `OPENROUTER_API_KEY`                                           |
| `gateway`           | `AI_GATEWAY_API_KEY`                                           |
| `openai`            | `OPENAI_API_KEY`                                               |
| `anthropic`         | `ANTHROPIC_API_KEY`                                            |
| `google`            | `GOOGLE_GENERATIVE_AI_API_KEY`                                 |
| `ollama`            | `OLLAMA_BASE_URL`                                              |
| `openai-compatible` | `OPENAI_COMPATIBLE_API_KEY` + `OPENAI_COMPATIBLE_API_BASE_URL` |

**Fix:** Set the API key for the provider you want to use in `.env.local`. The default text provider is `openrouter`, which requires `OPENROUTER_API_KEY`.

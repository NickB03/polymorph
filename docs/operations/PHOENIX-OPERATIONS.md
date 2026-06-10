# Phoenix Operations

> **Audience:** Operator
> **Prerequisites:** [Deployment Guide](DEPLOYMENT.md)

This leaf covers the Phoenix observability service, persistence verification, tracing configuration, and key rotation.

## Observability (Phoenix on Railway)

Polymorph exports OpenTelemetry traces to a self-hosted Arize Phoenix instance on Railway.

### Architecture

```
Vercel (polymorph) --OTLP/HTTPS--> Railway (phoenix)
                                       ^
Railway (polymorph-evals cron) --API--/
      \--SQL read--> Supabase Postgres
```

### Phoenix service

- **Railway project:** `polymorph`
- **Service:** `phoenix` (region: `us-east4`)
- **Image:** `arizephoenix/phoenix`
- **Storage:** SQLite on Railway volume `phoenix-volume-v8K9` (us-east4, 5 GB, mounted at `/data`, `PHOENIX_WORKING_DIR=/data/v4`). All state — projects, datasets, experiments, users, API keys — lives in `/data/v4/phoenix.db` on this volume.
- **Public domain:** `phoenix-production-c6b5.up.railway.app`
- **Private domain:** `phoenix.railway.internal` (for Railway-internal services)
- **Auth:** Enabled (`PHOENIX_ENABLE_AUTH=true`, `PHOENIX_SECRET` for JWT signing). The durable login is `admin@localhost` (password from `PHOENIX_DEFAULT_ADMIN_INITIAL_PASSWORD`, applied only on an empty DB). Accounts listed in `PHOENIX_ADMINS` are created as rows but have no usable password without SMTP — plan user access around `admin@localhost`.

> **HTTPS required in production.** The `instrumentation.ts` enforces HTTPS for the collector endpoint when `VERCEL_ENV=production`, `VERCEL_TARGET_ENV=production`, `RAILWAY_ENVIRONMENT=production`, or `NODE_ENV=production` (without `VERCEL_ENV`). If the endpoint uses plain HTTP, tracing is silently disabled and a console error is logged.

### Persistence verification (run after every Phoenix deploy)

Phoenix is a single stateful SQLite file. An unmounted or region-mismatched volume looks healthy at boot but wipes on every redeploy, so run this check after any change touching the `phoenix` service.

1. **Confirm the volume is real, attached, and region-matched.** Do **not** trust `deployment.meta.volumeMounts` — that field reflects the `arizephoenix/phoenix` image's Dockerfile `VOLUME /data` declaration, not a Railway-attached volume. Instead:

   ```bash
   railway volume list --json | jq '.volumes[] | select(.name|startswith("phoenix"))'
   ```

   The entry must report `serviceId` equal to the `phoenix` service id **and** a region matching the phoenix deployment region (currently `us-east4`). Railway volumes are region-pinned and cannot cross regions; a region-mismatched attachment causes the next deploy to fail in ~7 seconds with `instances: []`.

2. **Run the redeploy acid test.** Query `/v1/projects` (or `/v1/datasets`) with `PHOENIX_ADMIN_SECRET`, then `railway redeploy --service phoenix --yes`, then re-query. Project IDs and counts must be identical across the fresh container. If they reset, storage is ephemeral and the "restore" only appeared to work.

   ```bash
   PHOENIX_URL="https://phoenix-production-c6b5.up.railway.app"
   AUTH="Authorization: Bearer $PHOENIX_ADMIN_SECRET"

   # Pre-redeploy snapshot
   curl -sS -H "$AUTH" "$PHOENIX_URL/v1/projects" | jq '.projects | length, .projects[0:3] | map(.id)'

   railway redeploy --service phoenix --yes

   # Post-redeploy snapshot — count and first IDs must match
   curl -sS -H "$AUTH" "$PHOENIX_URL/v1/projects" | jq '.projects | length, .projects[0:3] | map(.id)'
   ```

3. **Rotate client API keys last.** Phoenix API keys are rows in the same DB. If you rotate `PHOENIX_API_KEY` on Vercel and `polymorph-evals` before confirming persistence, a subsequent wipe will drop the token rows and surface as bulk `401` on `/v1/traces` and `/v1/datasets`.

### Enabling tracing on Vercel

Set these env vars in the Vercel dashboard (Settings → Environment Variables, Production):

| Variable                      | Value                                            |
| ----------------------------- | ------------------------------------------------ |
| `ENABLE_TRACING`              | `true`                                           |
| `PHOENIX_COLLECTOR_ENDPOINT`  | `https://phoenix-production-c6b5.up.railway.app` |
| `PHOENIX_PROJECT_NAME`        | `polymorph-prod`                                 |
| `PHOENIX_API_KEY`             | System API key created in Phoenix UI             |
| `EVAL_REPLAY_TRACING_ENABLED` | `false` unless intentionally tracing eval replay |

The app exports traces to `${PHOENIX_COLLECTOR_ENDPOINT}/v1/traces` with `Authorization: Bearer $PHOENIX_API_KEY` from `instrumentation.ts`. Use low-cardinality Phoenix projects such as `polymorph-prod`; keep per-request details in metadata (`correlationId`, `otelTraceId`, model, mode, and eval case fields).

For production, set OpenInference masking according to the data you are comfortable storing in Phoenix:

| Variable                                | Typical production value |
| --------------------------------------- | ------------------------ |
| `OPENINFERENCE_HIDE_INPUTS`             | `true`                   |
| `OPENINFERENCE_HIDE_OUTPUTS`            | `true`                   |
| `OPENINFERENCE_HIDE_INPUT_MESSAGES`     | `true`                   |
| `OPENINFERENCE_HIDE_OUTPUT_MESSAGES`    | `true`                   |
| `OPENINFERENCE_HIDE_INPUT_IMAGES`       | `true`                   |
| `OPENINFERENCE_HIDE_INPUT_TEXT`         | `true`                   |
| `OPENINFERENCE_BASE64_IMAGE_MAX_LENGTH` | `10000`                  |

See [Environment Reference](../getting-started/ENVIRONMENT-OPERATIONS.md#tracing-arize-phoenix) for details.

### Rotating Phoenix API keys

1. **First**, run the persistence verification above. Rotating before you have confirmed the volume is real will leave you with tokens that vanish on the next redeploy.
2. Log into Phoenix UI (`admin@localhost`) → Settings → API Keys
3. Create a new System API key
4. Update `PHOENIX_API_KEY` on both Vercel and the `polymorph-evals` Railway service
5. Delete the old key in Phoenix

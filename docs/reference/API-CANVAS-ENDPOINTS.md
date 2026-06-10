# Canvas API Endpoints

> **Audience:** Contributor | Operator
> **Prerequisites:** [API Reference](API.md)

This leaf covers canvas artifact lifecycle endpoints.

## Canvas Artifact Endpoints

Canvas artifact endpoints manage the lifecycle of canvas artifacts (one per chat). All write endpoints support both Supabase session auth and HMAC-signed guest tokens. Write endpoints rotate the guest token on success.

### GET `/api/canvas-artifacts/[artifactId]`

Loads the full canvas artifact state including current draft source, compiled draft HTML, diagnostics, version history, and current version metadata.

**Authentication:** Required (Supabase session or guest canvas token via `?guestCanvasToken=` query param)
**Dynamic:** `force-dynamic`

#### Response

**Content-Type:** `application/json`

Returns the full artifact state object with `artifactId`, `chatId`, `title`, `status`, `draftSource`, `draftCompiledHtml`, `draftDiagnostics`, `draftRevision`, `currentVersionId`, `versions`, and `updatedAt`.

#### Error Responses

| Status | Condition                                                    |
| ------ | ------------------------------------------------------------ |
| `401`  | No authenticated user and no guest token provided.           |
| `403`  | Guest token is invalid, expired, or does not match artifact. |
| `404`  | Artifact not found.                                          |
| `500`  | Unexpected server error.                                     |

---

### PATCH `/api/canvas-artifacts/[artifactId]/draft`

Updates the artifact's draft source. The server validates, compiles (esbuild + Tailwind v4), and persists the result. Uses optimistic concurrency via `baseRevision`.

**Authentication:** Required (Supabase session or guest canvas token in body)
**Dynamic:** `force-dynamic`

#### Request Body

```typescript
{
  baseRevision: number                    // Current revision for optimistic concurrency
  draftSource: Record<string, string>     // File map (filename → source code) for the canvas artifact
  guestCanvasToken?: string               // Guest access token (if not authenticated)
}
```

#### Response

**Content-Type:** `application/json`

Returns the updated artifact state. For guest requests, includes a rotated `guestCanvasToken`.

#### Error Responses

| Status | Condition                                                      |
| ------ | -------------------------------------------------------------- |
| `400`  | Missing `baseRevision` or `draftSource`.                       |
| `401`  | No authenticated user and no guest token provided.             |
| `403`  | Guest token is invalid, expired, or does not match artifact.   |
| `409`  | Stale revision (another update happened since `baseRevision`). |
| `422`  | Compilation failed (esbuild or validation error).              |
| `429`  | Rate limit exceeded.                                           |
| `500`  | Unexpected server error.                                       |

---

### POST `/api/canvas-artifacts/[artifactId]/versions`

Creates an immutable version snapshot of the current draft.

**Authentication:** Required (Supabase session or guest canvas token in body)
**Dynamic:** `force-dynamic`

#### Request Body

```typescript
{
  guestCanvasToken?: string     // Guest access token (if not authenticated)
}
```

#### Response

**Content-Type:** `application/json`

Returns the updated artifact state with the new version appended. For guest requests, includes a rotated `guestCanvasToken`.

#### Error Responses

| Status | Condition                                                    |
| ------ | ------------------------------------------------------------ |
| `401`  | No authenticated user and no guest token provided.           |
| `403`  | Guest token is invalid, expired, or does not match artifact. |
| `404`  | Artifact not found.                                          |
| `422`  | Version creation failed.                                     |
| `429`  | Rate limit exceeded.                                         |
| `500`  | Unexpected server error.                                     |

---

### POST `/api/canvas-artifacts/[artifactId]/restore`

Restores a previous version as the current draft. Uses optimistic concurrency via `baseRevision`.

**Authentication:** Required (Supabase session or guest canvas token in body)
**Dynamic:** `force-dynamic`

#### Request Body

```typescript
{
  versionId: string             // ID of the version to restore
  baseRevision: number          // Current revision for optimistic concurrency
  guestCanvasToken?: string     // Guest access token (if not authenticated)
}
```

#### Response

**Content-Type:** `application/json`

Returns the updated artifact state with the restored source. For guest requests, includes a rotated `guestCanvasToken`.

#### Error Responses

| Status | Condition                                                      |
| ------ | -------------------------------------------------------------- |
| `400`  | Missing `versionId` or `baseRevision`.                         |
| `401`  | No authenticated user and no guest token provided.             |
| `403`  | Guest token is invalid, expired, or does not match artifact.   |
| `404`  | Artifact or version not found.                                 |
| `409`  | Stale revision (another update happened since `baseRevision`). |
| `422`  | Restore failed.                                                |
| `429`  | Rate limit exceeded.                                           |
| `500`  | Unexpected server error.                                       |

---

### GET `/api/canvas-artifacts/[artifactId]/export`

Downloads the compiled HTML as a self-contained `.html` file attachment.

**Authentication:** Required (Supabase session or guest canvas token via `?guestCanvasToken=` query param)
**Dynamic:** `force-dynamic`

#### Response

**Content-Type:** `text/html; charset=utf-8`

Returns the compiled HTML as a file download.

**Headers:**

- `Content-Disposition` -- `attachment; filename="<slug>.html"`
- `X-Canvas-Executes-JavaScript` -- `true` (advisory: the exported file runs JS)
- `X-Canvas-External-Dependencies` -- `present` or `none`

#### Error Responses

| Status | Condition                                                    |
| ------ | ------------------------------------------------------------ |
| `401`  | No authenticated user and no guest token provided.           |
| `403`  | Guest token is invalid, expired, or does not match artifact. |
| `404`  | Artifact not found.                                          |
| `422`  | Export failed (no compiled HTML available).                  |
| `500`  | Unexpected server error.                                     |

---

### POST `/api/canvas-artifacts/[artifactId]/runtime-diagnostics`

Persists runtime diagnostics (errors, warnings) captured from the preview iframe.

**Authentication:** Required (Supabase session or guest canvas token in body)
**Dynamic:** `force-dynamic`

#### Request Body

```typescript
{
  draftRevision: number         // Revision the diagnostics apply to
  diagnostics: Array<{          // Array of diagnostic entries
    severity: 'error' | 'warning' | 'info'
    message: string
    file?: string
    line?: number
    column?: number
    details?: Record<string, unknown>
  }>
  guestCanvasToken?: string     // Guest access token (if not authenticated)
}
```

#### Response

**Content-Type:** `application/json`

Returns the updated artifact state. For guest requests, includes a rotated `guestCanvasToken`.

#### Error Responses

| Status | Condition                                                    |
| ------ | ------------------------------------------------------------ |
| `400`  | Missing `draftRevision` or `diagnostics` array.              |
| `401`  | No authenticated user and no guest token provided.           |
| `403`  | Guest token is invalid, expired, or does not match artifact. |
| `404`  | Artifact not found.                                          |
| `409`  | Stale revision (diagnostics for a different revision).       |
| `429`  | Rate limit exceeded.                                         |
| `500`  | Unexpected server error.                                     |

---

### GET `/api/canvas-artifacts/[artifactId]/view`

Serves the compiled HTML for inline embedding or preview. Returns the artifact's compiled HTML as an HTML response suitable for `iframe.srcdoc` or direct viewing.

**Authentication:** Required (Supabase session or guest canvas token via `?guestCanvasToken=` query param)
**Dynamic:** `force-dynamic`

#### Response

**Content-Type:** `text/html; charset=utf-8`

Returns the compiled HTML for the canvas artifact, rendered inline (not as a download).

**Security headers:**

- `Content-Security-Policy: sandbox allow-scripts` -- sandboxes the document even when opened top-level (for example, the fullscreen view). The opaque origin prevents model-generated scripts from reading app-origin cookies or storage, matching the isolation of the in-app preview iframe. Must never gain `allow-same-origin`.
- `X-Canvas-Executes-JavaScript` -- `true` (advisory: the served HTML runs JS)

#### Error Responses

| Status | Condition                                                    |
| ------ | ------------------------------------------------------------ |
| `401`  | No authenticated user and no guest token provided.           |
| `403`  | Guest token is invalid, expired, or does not match artifact. |
| `404`  | Artifact not found.                                          |
| `500`  | Unexpected server error.                                     |

---

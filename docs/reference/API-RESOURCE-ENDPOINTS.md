# Resource API Endpoints

> **Audience:** Contributor | Operator
> **Prerequisites:** [API Reference](API.md)

This leaf covers chat listing, file upload, and feedback endpoints.

## GET `/api/chats`

Retrieves a paginated list of chats for the currently authenticated user.

**Authentication:** Required (via Supabase session in `getChatsPage` server action)
**Dynamic:** `force-dynamic`

#### Query Parameters

| Parameter | Type      | Default | Description                                 |
| --------- | --------- | ------- | ------------------------------------------- |
| `offset`  | `integer` | `0`     | Number of chats to skip for pagination.     |
| `limit`   | `integer` | `20`    | Maximum number of chats to return per page. |

#### Response

**Content-Type:** `application/json`

```typescript
{
  chats: Chat[]            // Array of chat objects
  nextOffset: number | null // Offset for the next page, or null if no more results
}
```

Each `Chat` object:

```typescript
{
  id: string // Unique chat identifier (CUID2)
  createdAt: string // ISO 8601 timestamp
  title: string // Chat title (auto-generated or "Untitled")
  userId: string // Owner's user ID
  visibility: 'public' | 'private'
}
```

#### Error Responses

| Status                      | Condition                                                         |
| --------------------------- | ----------------------------------------------------------------- |
| `500 Internal Server Error` | Database query failed. Returns `{ chats: [], nextOffset: null }`. |

#### Example

```bash
curl "http://localhost:43100/api/chats?offset=0&limit=10" \
  -H "Cookie: <supabase-auth-cookies>"
```

```json
{
  "chats": [
    {
      "id": "clx1abc123def456",
      "createdAt": "2025-01-15T10:30:00.000Z",
      "title": "Quantum Computing Explained",
      "userId": "user-uuid-here",
      "visibility": "private"
    }
  ],
  "nextOffset": 10
}
```

---

## POST `/api/upload`

Uploads a file (image, PDF, or Word document) to Supabase Storage, scoped to a specific chat.

**Authentication:** Required

#### Request

**Content-Type:** `multipart/form-data`

| Field    | Type     | Required | Description                         |
| -------- | -------- | -------- | ----------------------------------- |
| `file`   | `File`   | Yes      | The file to upload.                 |
| `chatId` | `string` | Yes      | Chat ID to associate the file with. |

#### Constraints

| Constraint         | Value                                                                                                                                                                    |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Max file size      | 5 MB                                                                                                                                                                     |
| Allowed MIME types | `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `application/pdf`, `application/msword`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |

#### Response

**Content-Type:** `application/json`

**Success (200):**

```typescript
{
  success: true
  file: {
    filename: string // Original filename
    url: string // Public URL of the uploaded file
    mediaType: string // MIME type (e.g., "image/png")
    type: 'file'
  }
}
```

#### Error Responses

| Status | Body                                         | Condition                             |
| ------ | -------------------------------------------- | ------------------------------------- |
| `400`  | `{ error: "Invalid content type" }`          | Request is not `multipart/form-data`. |
| `400`  | `{ error: "File is required" }`              | No `file` field in form data.         |
| `400`  | `{ error: "File too large (max 5MB)" }`      | File exceeds 5 MB.                    |
| `400`  | `{ error: "Unsupported file type" }`         | MIME type not in allowed list.        |
| `401`  | `{ error: "Unauthorized" }`                  | User is not authenticated.            |
| `500`  | `{ error: "Upload failed", message: "..." }` | Supabase storage error.               |

#### Example

```bash
curl -X POST http://localhost:43100/api/upload \
  -H "Cookie: <supabase-auth-cookies>" \
  -F "file=@screenshot.png" \
  -F "chatId=clx1abc123def456"
```

---

## POST `/api/feedback`

Records user feedback (thumbs up/down) on an AI response. If `messageId` is provided, the route updates the message metadata; database update failures are logged and do not fail the request.

**Authentication:** Optional (if Supabase auth is configured, the current user is passed through for RLS)
**Dynamic:** `force-dynamic`

#### Request Body

```typescript
{
  score: 1 | -1            // 1 = positive (thumbs up), -1 = negative (thumbs down)
  messageId?: string       // Optional database message ID to update metadata
}
```

| Field       | Type      | Required | Description                                                    |
| ----------- | --------- | -------- | -------------------------------------------------------------- |
| `score`     | `1 \| -1` | Yes      | Feedback score. Must be exactly `1` or `-1`.                   |
| `messageId` | `string`  | No       | Optional message ID whose `metadata.feedbackScore` is updated. |

#### Response

**Content-Type:** `text/plain`

| Status | Body                                   | Condition                                                                 |
| ------ | -------------------------------------- | ------------------------------------------------------------------------- |
| `200`  | `"Feedback recorded successfully"`     | Feedback accepted; message metadata updated when `messageId` is provided. |
| `400`  | `"score must be 1 (good) or -1 (bad)"` | Invalid score value.                                                      |
| `500`  | `"Error recording feedback"`           | Unexpected error during processing.                                       |

#### Example

```bash
curl -X POST http://localhost:43100/api/feedback \
  -H "Content-Type: application/json" \
  -d '{
    "score": 1,
    "messageId": "msg-xyz789"
  }'
```

---

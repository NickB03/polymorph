# Architecture Database Schema

> **Audience:** Architect | Contributor
> **Prerequisites:** [Architecture](OVERVIEW.md)

This leaf summarizes the active Drizzle/Supabase schema, indexes, and canonical message persistence contract.

## Database Schema

The database uses Drizzle ORM with Supabase PostgreSQL. The active chat schema stores **chats** and their canonical **messages**. Each message row owns a non-null `ui_message` JSONB payload containing the AI SDK `UIMessage`; there is no sidecar message-part table in the active contract. A separate **feedback** table stores user feedback.

```mermaid
erDiagram
    chats {
        varchar id PK "cuid2, 191 chars"
        timestamp created_at "NOT NULL, default now()"
        text title "NOT NULL"
        varchar user_id "NOT NULL, 255 chars"
        varchar visibility "public | private, default private"
    }

    messages {
        varchar id PK "cuid2, 191 chars"
        varchar chat_id FK "NOT NULL, CASCADE DELETE"
        varchar role "NOT NULL (user | assistant)"
        timestamp created_at "NOT NULL, default now()"
        timestamp updated_at "nullable"
        jsonb ui_message "NOT NULL canonical UIMessage"
        jsonb metadata "optional stream metadata"
    }

    artifacts {
        varchar id PK "cuid2, 191 chars"
        varchar chat_id FK "NOT NULL, CASCADE DELETE"
        varchar user_id "optional, 255 chars"
        varchar current_revision_id "optional"
        varchar current_runtime_session_id "optional"
        text title "NOT NULL"
        varchar framework "react-spa, default react-spa"
        varchar status "building | ready | failed | restarting | expired"
        timestamp created_at "NOT NULL, default now()"
        timestamp updated_at "NOT NULL, default now()"
    }

    artifact_revisions {
        varchar id PK "cuid2, 191 chars"
        varchar artifact_id FK "NOT NULL, CASCADE DELETE"
        varchar triggering_message_id FK "NOT NULL, CASCADE DELETE"
        text prompt_summary "NOT NULL"
        text title "NOT NULL"
        text sandbox_snapshot_ref "optional"
        jsonb source_files "optional"
        timestamp created_at "NOT NULL, default now()"
    }

    feedback {
        varchar id PK "cuid2, 191 chars"
        varchar user_id "optional, 255 chars"
        varchar sentiment "positive | neutral | negative"
        text message "NOT NULL"
        text page_url "NOT NULL"
        text user_agent "optional"
        timestamp created_at "NOT NULL, default now()"
    }

    chats ||--o{ messages : "has many"
    chats ||--o{ artifacts : "has many"
    artifacts ||--o{ artifact_revisions : "has many"
```

### Schema details

- `messages.ui_message` is the canonical persisted AI SDK `UIMessage` and is enforced as `NOT NULL`.

- IDs are generated with **cuid2** (191 char max) via `@paralleldrive/cuid2`

- **Cascade deletes** propagate from chats through messages

- All tables use **Row-Level Security** (see [RLS Policy Chain](#rls-policy-chain))

### Indexes

| Table              | Index                                           | Purpose                        |
| ------------------ | ----------------------------------------------- | ------------------------------ |
| chats              | `chats_user_id_idx`                             | User's chat list               |
| chats              | `chats_user_id_created_at_idx`                  | Sorted chat list               |
| chats              | `chats_created_at_idx`                          | Global recency ordering        |
| chats              | `chats_id_user_id_idx`                          | RLS subquery from messages     |
| messages           | `messages_chat_id_idx`                          | Load messages by chat          |
| messages           | `messages_chat_id_created_at_idx`               | Ordered message load           |
| artifacts          | `artifacts_chat_id_idx`                         | Artifacts by chat              |
| artifact_revisions | `artifact_revisions_artifact_id_created_at_idx` | Ordered revisions per artifact |
| feedback           | `feedback_user_id_idx`                          | Feedback by user               |
| feedback           | `feedback_created_at_idx`                       | Feedback by recency            |

**Source file:** [`lib/db/schema.ts`](../../lib/db/schema.ts)

---

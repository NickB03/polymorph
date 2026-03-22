import { createId } from '@paralleldrive/cuid2'
import { InferSelectModel, sql } from 'drizzle-orm'
import {
  check,
  index,
  integer,
  json,
  jsonb,
  pgPolicy,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar
} from 'drizzle-orm/pg-core'

import type { CanvasDiagnostics } from '@/lib/types/canvas'

// Constants
const ID_LENGTH = 191
const USER_ID_LENGTH = 255
const VARCHAR_LENGTH = 256
const FILENAME_LENGTH = 1024

// ID generation function
export const generateId = () => createId()

// Chats table
export const chats = pgTable(
  'chats',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    title: text('title').notNull(),
    userId: varchar('user_id', { length: USER_ID_LENGTH }).notNull(),
    visibility: varchar('visibility', {
      length: VARCHAR_LENGTH,
      enum: ['public', 'private']
    })
      .notNull()
      .default('private')
  },
  table => [
    // Indexes
    index('chats_user_id_idx').on(table.userId),
    index('chats_user_id_created_at_idx').on(
      table.userId,
      table.createdAt.desc()
    ),
    index('chats_created_at_idx').on(table.createdAt.desc()),
    // Composite index for RLS subqueries in messages and parts tables
    index('chats_id_user_id_idx').on(table.id, table.userId),

    // RLS Policies
    pgPolicy('users_manage_own_chats', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id = current_setting('app.current_user_id', true)`
    }),
    pgPolicy('public_chats_readable', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`visibility = 'public'`
    })
  ]
).enableRLS()

export type Chat = InferSelectModel<typeof chats>

// Messages table (simplified)
export const messages = pgTable(
  'messages',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    chatId: varchar('chat_id', { length: ID_LENGTH })
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    role: varchar('role', { length: VARCHAR_LENGTH }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at'),
    metadata: jsonb('metadata').$type<Record<string, any>>()
  },
  table => [
    index('messages_chat_id_idx').on(table.chatId),
    index('messages_chat_id_created_at_idx').on(table.chatId, table.createdAt),

    // RLS Policies - allow access to messages if user owns the chat
    pgPolicy('users_manage_chat_messages', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${chats}
        WHERE ${chats}.id = chat_id
        AND ${chats}.user_id = current_setting('app.current_user_id', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1 FROM ${chats}
        WHERE ${chats}.id = chat_id
        AND ${chats}.user_id = current_setting('app.current_user_id', true)
      )`
    }),
    pgPolicy('public_chat_messages_readable', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${chats}
        WHERE ${chats}.id = chat_id
        AND ${chats}.visibility = 'public'
      )`
    })
  ]
).enableRLS()

export type Message = InferSelectModel<typeof messages>

// Parts table
export const parts = pgTable(
  'parts',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    messageId: varchar('message_id', { length: ID_LENGTH })
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    order: integer('order').notNull(),
    type: varchar('type', { length: VARCHAR_LENGTH }).notNull(),

    // Text parts
    text_text: text('text_text'),

    // Reasoning parts
    reasoning_text: text('reasoning_text'),

    // File parts
    file_mediaType: varchar('file_media_type', { length: VARCHAR_LENGTH }),
    file_filename: varchar('file_filename', { length: FILENAME_LENGTH }),
    file_url: text('file_url'),

    // Source URL parts
    source_url_sourceId: varchar('source_url_source_id', {
      length: VARCHAR_LENGTH
    }),
    source_url_url: text('source_url_url'),
    source_url_title: text('source_url_title'),

    // Source document parts
    source_document_sourceId: varchar('source_document_source_id', {
      length: VARCHAR_LENGTH
    }),
    source_document_mediaType: varchar('source_document_media_type', {
      length: VARCHAR_LENGTH
    }),
    source_document_title: text('source_document_title'),
    source_document_filename: varchar('source_document_filename', {
      length: FILENAME_LENGTH
    }),
    source_document_url: text('source_document_url'),
    source_document_snippet: text('source_document_snippet'),

    // Tool parts (generic)
    tool_toolCallId: varchar('tool_tool_call_id', { length: VARCHAR_LENGTH }),
    tool_state: varchar('tool_state', { length: VARCHAR_LENGTH }),
    tool_errorText: text('tool_error_text'),

    // Tool-specific columns (all Polymorph tools)
    tool_search_input: json('tool_search_input').$type<any>(),
    tool_search_output: json('tool_search_output').$type<any>(),
    tool_fetch_input: json('tool_fetch_input').$type<any>(),
    tool_fetch_output: json('tool_fetch_output').$type<any>(),
    tool_question_input: json('tool_question_input').$type<any>(),
    tool_question_output: json('tool_question_output').$type<any>(),

    // Todo tool columns
    tool_todoWrite_input: json('tool_todoWrite_input').$type<any>(),
    tool_todoWrite_output: json('tool_todoWrite_output').$type<any>(),
    tool_todoRead_input: json('tool_todoRead_input').$type<any>(),
    tool_todoRead_output: json('tool_todoRead_output').$type<any>(),

    // Dynamic tools (includes MCP and other runtime-defined tools)
    tool_dynamic_input: json('tool_dynamic_input').$type<any>(),
    tool_dynamic_output: json('tool_dynamic_output').$type<any>(),
    tool_dynamic_name: varchar('tool_dynamic_name', { length: VARCHAR_LENGTH }),
    tool_dynamic_type: varchar('tool_dynamic_type', { length: VARCHAR_LENGTH }),

    // Data parts (generic support)
    data_prefix: varchar('data_prefix', { length: VARCHAR_LENGTH }),
    data_content: json('data_content').$type<any>(),
    data_id: varchar('data_id', { length: VARCHAR_LENGTH }),

    // Provider metadata
    providerMetadata: json('provider_metadata').$type<Record<string, any>>(),

    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    // Indexes
    index('parts_message_id_idx').on(table.messageId),
    index('parts_message_id_order_idx').on(table.messageId, table.order),

    // Constraints
    check('text_text_required', sql`(type != 'text' OR text_text IS NOT NULL)`),
    check(
      'reasoning_text_required',
      sql`(type != 'reasoning' OR reasoning_text IS NOT NULL)`
    ),
    check(
      'file_fields_required',
      sql`(type != 'file' OR (file_media_type IS NOT NULL AND file_filename IS NOT NULL AND file_url IS NOT NULL))`
    ),
    check(
      'tool_state_valid',
      sql`(tool_state IS NULL OR tool_state IN ('input-streaming', 'input-available', 'output-available', 'output-error'))`
    ),
    check(
      'tool_fields_required',
      sql`(type NOT LIKE 'tool-%' OR (tool_tool_call_id IS NOT NULL AND tool_state IS NOT NULL))`
    ),

    // RLS Policies - allow access to parts if user owns the related chat
    pgPolicy('users_manage_message_parts', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${messages}
        INNER JOIN ${chats} ON ${chats}.id = ${messages}.chat_id
        WHERE ${messages}.id = message_id
        AND ${chats}.user_id = current_setting('app.current_user_id', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1 FROM ${messages}
        INNER JOIN ${chats} ON ${chats}.id = ${messages}.chat_id
        WHERE ${messages}.id = message_id
        AND ${chats}.user_id = current_setting('app.current_user_id', true)
      )`
    }),
    pgPolicy('public_chat_parts_readable', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${messages}
        INNER JOIN ${chats} ON ${chats}.id = ${messages}.chat_id
        WHERE ${messages}.id = message_id
        AND ${chats}.visibility = 'public'
      )`
    })
  ]
).enableRLS()

export type Part = InferSelectModel<typeof parts>
export type NewPart = typeof parts.$inferInsert

// Artifacts table
export const artifacts = pgTable(
  'artifacts',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    chatId: varchar('chat_id', { length: ID_LENGTH })
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: USER_ID_LENGTH }),
    currentRevisionId: varchar('current_revision_id', { length: ID_LENGTH }),
    currentRuntimeSessionId: varchar('current_runtime_session_id', {
      length: ID_LENGTH
    }),
    title: text('title').notNull(),
    framework: varchar('framework', {
      length: VARCHAR_LENGTH,
      enum: ['react-spa']
    })
      .notNull()
      .default('react-spa'),
    status: varchar('status', {
      length: VARCHAR_LENGTH,
      enum: ['building', 'ready', 'failed', 'restarting', 'expired']
    })
      .notNull()
      .default('building'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  table => [
    index('artifacts_chat_id_idx').on(table.chatId),
    pgPolicy('users_manage_own_artifacts', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id = current_setting('app.current_user_id', true)`
    })
  ]
).enableRLS()

export type Artifact = InferSelectModel<typeof artifacts>

// Artifact revisions table
export const artifactRevisions = pgTable(
  'artifact_revisions',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    artifactId: varchar('artifact_id', { length: ID_LENGTH })
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    triggeringMessageId: varchar('triggering_message_id', { length: ID_LENGTH })
      .notNull()
      .references(() => messages.id, { onDelete: 'cascade' }),
    promptSummary: text('prompt_summary').notNull(),
    title: text('title').notNull(),
    sandboxSnapshotRef: text('sandbox_snapshot_ref'),
    sourceFiles: jsonb('source_files').$type<Record<string, string>>(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    index('artifact_revisions_artifact_id_created_at_idx').on(
      table.artifactId,
      table.createdAt.desc()
    ),
    pgPolicy('users_manage_own_artifact_revisions', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${artifacts}
        WHERE ${artifacts}.id = artifact_id
        AND ${artifacts}.user_id = current_setting('app.current_user_id', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1 FROM ${artifacts}
        WHERE ${artifacts}.id = artifact_id
        AND ${artifacts}.user_id = current_setting('app.current_user_id', true)
      )`
    })
  ]
).enableRLS()

export type ArtifactRevision = InferSelectModel<typeof artifactRevisions>

// Artifact runtime sessions table
export const artifactRuntimeSessions = pgTable(
  'artifact_runtime_sessions',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    artifactId: varchar('artifact_id', { length: ID_LENGTH })
      .notNull()
      .references(() => artifacts.id, { onDelete: 'cascade' }),
    provider: varchar('provider', {
      length: VARCHAR_LENGTH,
      enum: ['e2b']
    })
      .notNull()
      .default('e2b'),
    sandboxId: text('sandbox_id').notNull(),
    previewUrl: text('preview_url'),
    status: varchar('status', {
      length: VARCHAR_LENGTH,
      enum: ['building', 'ready', 'failed', 'restarting', 'expired']
    })
      .notNull()
      .default('building'),
    startedAt: timestamp('started_at').notNull().defaultNow(),
    expiresAt: timestamp('expires_at'),
    lastHeartbeatAt: timestamp('last_heartbeat_at')
  },
  table => [
    index('artifact_runtime_sessions_artifact_id_started_at_idx').on(
      table.artifactId,
      table.startedAt.desc()
    ),
    pgPolicy('users_manage_own_artifact_runtime_sessions', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${artifacts}
        WHERE ${artifacts}.id = artifact_id
        AND ${artifacts}.user_id = current_setting('app.current_user_id', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1 FROM ${artifacts}
        WHERE ${artifacts}.id = artifact_id
        AND ${artifacts}.user_id = current_setting('app.current_user_id', true)
      )`
    })
  ]
).enableRLS()

export type ArtifactRuntimeSession = InferSelectModel<
  typeof artifactRuntimeSessions
>

// Canvas artifacts table
export const canvasArtifacts = pgTable(
  'canvas_artifacts',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    chatId: varchar('chat_id', { length: ID_LENGTH })
      .notNull()
      .references(() => chats.id, { onDelete: 'cascade' }),
    userId: varchar('user_id', { length: USER_ID_LENGTH }).notNull(),
    title: text('title').notNull(),
    status: varchar('status', {
      length: VARCHAR_LENGTH,
      enum: ['generating', 'compiling', 'ready', 'compile_failed', 'restoring']
    })
      .notNull()
      .default('compiling'),
    draftSource: jsonb('draft_source')
      .$type<Record<string, string>>()
      .notNull(),
    draftCompiledHtml: text('draft_compiled_html'),
    draftDiagnostics: jsonb(
      'draft_diagnostics'
    ).$type<CanvasDiagnostics | null>(),
    draftRevision: integer('draft_revision').notNull().default(0),
    currentVersionId: varchar('current_version_id', { length: ID_LENGTH }),
    lastCompiledAt: timestamp('last_compiled_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow()
  },
  table => [
    // Unique: one artifact per chat
    uniqueIndex('canvas_artifacts_chat_id_idx').on(table.chatId),
    // Reopen/history lookups
    index('canvas_artifacts_user_id_updated_at_idx').on(
      table.userId,
      table.updatedAt.desc()
    ),

    // RLS Policies
    pgPolicy('users_manage_own_canvas_artifacts', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`user_id = current_setting('app.current_user_id', true)`,
      withCheck: sql`user_id = current_setting('app.current_user_id', true)`
    })
  ]
).enableRLS()

export type CanvasArtifact = InferSelectModel<typeof canvasArtifacts>

// Canvas artifact versions table
export const canvasArtifactVersions = pgTable(
  'canvas_artifact_versions',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    artifactId: varchar('artifact_id', { length: ID_LENGTH })
      .notNull()
      .references(() => canvasArtifacts.id, { onDelete: 'cascade' }),
    versionNumber: integer('version_number').notNull(),
    sourceSnapshot: jsonb('source_snapshot')
      .$type<Record<string, string>>()
      .notNull(),
    createdBy: varchar('created_by', {
      length: VARCHAR_LENGTH,
      enum: ['ai', 'user', 'restore']
    }).notNull(),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    // Unique: one version number per artifact
    uniqueIndex('canvas_artifact_versions_artifact_id_version_number_idx').on(
      table.artifactId,
      table.versionNumber
    ),
    // Version browsing
    index('canvas_artifact_versions_artifact_id_created_at_idx').on(
      table.artifactId,
      table.createdAt.desc()
    ),

    // RLS Policies - access through parent artifact ownership
    pgPolicy('users_manage_own_canvas_artifact_versions', {
      as: 'permissive',
      for: 'all',
      to: 'public',
      using: sql`EXISTS (
        SELECT 1 FROM ${canvasArtifacts}
        WHERE ${canvasArtifacts}.id = artifact_id
        AND ${canvasArtifacts}.user_id = current_setting('app.current_user_id', true)
      )`,
      withCheck: sql`EXISTS (
        SELECT 1 FROM ${canvasArtifacts}
        WHERE ${canvasArtifacts}.id = artifact_id
        AND ${canvasArtifacts}.user_id = current_setting('app.current_user_id', true)
      )`
    })
  ]
).enableRLS()

export type CanvasArtifactVersion = InferSelectModel<
  typeof canvasArtifactVersions
>

// Feedback table
export const feedback = pgTable(
  'feedback',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    userId: varchar('user_id', { length: USER_ID_LENGTH }),
    sentiment: varchar('sentiment', {
      length: VARCHAR_LENGTH,
      enum: ['positive', 'neutral', 'negative']
    }).notNull(),
    message: text('message').notNull(),
    pageUrl: text('page_url').notNull(),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    // Indexes
    index('feedback_user_id_idx').on(table.userId),
    index('feedback_created_at_idx').on(table.createdAt),

    // RLS Policies - Allow reads (for INSERT ... RETURNING and app visibility)
    pgPolicy('feedback_select_policy', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`
    }),

    // RLS Policy - Allow anyone to insert feedback
    pgPolicy('anyone_can_insert_feedback', {
      for: 'insert',
      to: 'public',
      withCheck: sql`true`
    })
  ]
).enableRLS()

export type Feedback = InferSelectModel<typeof feedback>

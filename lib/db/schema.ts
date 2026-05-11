import { createId } from '@paralleldrive/cuid2'
import { InferSelectModel, sql } from 'drizzle-orm'
import {
  boolean,
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

import type { UIMessage } from '@/lib/types/ai'
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
    uiMessage: jsonb('ui_message').$type<UIMessage>().notNull(),
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
      enum: ['sandbox']
    })
      .notNull()
      .default('sandbox'),
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

// Eval experiment summaries
// Note: Only SELECT RLS policy — no INSERT/UPDATE/DELETE policies.
// Writes come exclusively from the trusted evals service backend
// (services/evals/) which uses a direct DB connection without RLS context.
export const evalSummaries = pgTable(
  'eval_summaries',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    suite: varchar('suite', {
      length: VARCHAR_LENGTH,
      enum: ['capability', 'regression', 'traffic-monitor']
    }).notNull(),
    experimentName: text('experiment_name').notNull(),
    datasetName: text('dataset_name').notNull(),
    passRateBps: integer('pass_rate_bps').notNull(),
    thresholdBps: integer('threshold_bps'),
    thresholdBreached: boolean('threshold_breached').notNull().default(false),
    failedEvaluators: jsonb('failed_evaluators')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    evaluatorScores: jsonb('evaluator_scores')
      .$type<Record<string, number | null>>()
      .notNull(),
    totalCases: integer('total_cases').notNull(),
    attemptedCases: integer('attempted_cases').notNull().default(0),
    failedCases: integer('failed_cases').notNull().default(0),
    appModelIds: jsonb('app_model_ids')
      .$type<string[]>()
      .notNull()
      .default(sql`'[]'::jsonb`),
    primaryAppModelId: text('primary_app_model_id'),
    judgeProvider: text('judge_provider').notNull().default('openrouter'),
    judgeModel: text('judge_model'),
    judgeBaseUrl: text('judge_base_url'),
    judgeSettings: jsonb('judge_settings')
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    corpusVersion: text('corpus_version'),
    datasetVersion: text('dataset_version'),
    evaluatorTemplateVersion: text('evaluator_template_version')
      .notNull()
      .default('v1'),
    appGitSha: text('app_git_sha'),
    sampleSize: integer('sample_size'),
    lookbackHours: integer('lookback_hours'),
    phoenixUrl: text('phoenix_url'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    index('eval_summaries_suite_created_at_idx').on(
      table.suite,
      table.createdAt.desc()
    ),
    uniqueIndex('eval_summaries_experiment_name_idx').on(table.experimentName),
    check(
      'eval_summaries_pass_rate_bps_range',
      sql`${table.passRateBps} >= 0 AND ${table.passRateBps} <= 10000`
    ),
    check(
      'eval_summaries_threshold_bps_range',
      sql`${table.thresholdBps} IS NULL OR (${table.thresholdBps} >= 0 AND ${table.thresholdBps} <= 10000)`
    ),
    check(
      'eval_summaries_failed_cases_lte_attempted',
      sql`${table.failedCases} <= ${table.attemptedCases}`
    ),
    check(
      'eval_summaries_suite_enum',
      sql`${table.suite} IN ('capability', 'regression', 'traffic-monitor')`
    ),
    pgPolicy('authenticated_read_eval_summaries', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`current_setting('app.current_user_id', true) IS NOT NULL`
    })
  ]
).enableRLS()

export type EvalSummary = InferSelectModel<typeof evalSummaries>

export const evalCaseResults = pgTable(
  'eval_case_results',
  {
    id: varchar('id', { length: ID_LENGTH })
      .primaryKey()
      .$defaultFn(() => generateId()),
    evalSummaryId: varchar('eval_summary_id', { length: ID_LENGTH })
      .notNull()
      .references(() => evalSummaries.id, { onDelete: 'cascade' }),
    suite: varchar('suite', {
      length: VARCHAR_LENGTH,
      enum: ['capability', 'regression', 'traffic-monitor']
    }).notNull(),
    experimentName: text('experiment_name').notNull(),
    experimentRunId: text('experiment_run_id').notNull(),
    datasetExampleId: text('dataset_example_id'),
    caseId: text('case_id').notNull(),
    evaluatorName: text('evaluator_name').notNull(),
    annotatorKind: text('annotator_kind'),
    scoreBps: integer('score_bps'),
    label: text('label'),
    explanation: text('explanation'),
    error: text('error'),
    failed: boolean('failed').notNull().default(false),
    failureMode: text('failure_mode').notNull().default('other'),
    appModelId: text('app_model_id'),
    modelType: text('model_type'),
    searchMode: text('search_mode'),
    correlationId: text('correlation_id'),
    otelTraceId: text('otel_trace_id'),
    evaluatorTraceId: text('evaluator_trace_id'),
    phoenixUrl: text('phoenix_url'),
    createdAt: timestamp('created_at').notNull().defaultNow()
  },
  table => [
    index('eval_case_results_summary_idx').on(table.evalSummaryId),
    index('eval_case_results_suite_created_at_idx').on(
      table.suite,
      table.createdAt.desc()
    ),
    index('eval_case_results_failure_idx').on(
      table.evalSummaryId,
      table.evaluatorName,
      table.failed
    ),
    uniqueIndex('eval_case_results_summary_case_evaluator_idx').on(
      table.evalSummaryId,
      table.caseId,
      table.evaluatorName
    ),
    check(
      'eval_case_results_score_bps_range',
      sql`${table.scoreBps} IS NULL OR (${table.scoreBps} >= 0 AND ${table.scoreBps} <= 10000)`
    ),
    check(
      'eval_case_results_suite_enum',
      sql`${table.suite} IN ('capability', 'regression', 'traffic-monitor')`
    ),
    pgPolicy('authenticated_read_eval_case_results', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`current_setting('app.current_user_id', true) IS NOT NULL`
    })
  ]
).enableRLS()

export type EvalCaseResult = InferSelectModel<typeof evalCaseResults>

// Singleton-row cache for the home-page suggestion-pill dynamic blend.
// Written once per day by the cron at /api/suggestions/refresh and read by
// the GET /api/suggestions hot path. The `check` constraint enforces the
// singleton: only one row can ever exist.
export const trendingSuggestionsCache = pgTable(
  'trending_suggestions_cache',
  {
    id: integer('id').primaryKey().default(1),
    suggestions: jsonb('suggestions')
      .$type<Record<string, string[]>>()
      .notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .notNull()
      .defaultNow()
  },
  table => [
    check('trending_suggestions_cache_singleton', sql`${table.id} = 1`),
    pgPolicy('public_read_trending_suggestions_cache', {
      as: 'permissive',
      for: 'select',
      to: 'public',
      using: sql`true`
    })
  ]
).enableRLS()

export type TrendingSuggestionsCacheRow = InferSelectModel<
  typeof trendingSuggestionsCache
>

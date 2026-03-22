import { relations } from 'drizzle-orm'

import {
  artifactRevisions,
  artifactRuntimeSessions,
  artifacts,
  canvasArtifacts,
  canvasArtifactVersions,
  chats,
  messages,
  parts
} from './schema'

export const chatsRelations = relations(chats, ({ many }) => ({
  artifacts: many(artifacts),
  canvasArtifacts: many(canvasArtifacts),
  messages: many(messages)
}))

export const artifactsRelations = relations(artifacts, ({ one, many }) => ({
  chat: one(chats, {
    fields: [artifacts.chatId],
    references: [chats.id]
  }),
  revisions: many(artifactRevisions),
  runtimeSessions: many(artifactRuntimeSessions)
}))

export const artifactRevisionsRelations = relations(
  artifactRevisions,
  ({ one }) => ({
    artifact: one(artifacts, {
      fields: [artifactRevisions.artifactId],
      references: [artifacts.id]
    }),
    triggeringMessage: one(messages, {
      fields: [artifactRevisions.triggeringMessageId],
      references: [messages.id]
    })
  })
)

export const artifactRuntimeSessionsRelations = relations(
  artifactRuntimeSessions,
  ({ one }) => ({
    artifact: one(artifacts, {
      fields: [artifactRuntimeSessions.artifactId],
      references: [artifacts.id]
    })
  })
)

export const messagesRelations = relations(messages, ({ one, many }) => ({
  artifactRevisions: many(artifactRevisions),
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  }),
  parts: many(parts)
}))

export const partsRelations = relations(parts, ({ one }) => ({
  message: one(messages, {
    fields: [parts.messageId],
    references: [messages.id]
  })
}))

export const canvasArtifactsRelations = relations(
  canvasArtifacts,
  ({ one, many }) => ({
    chat: one(chats, {
      fields: [canvasArtifacts.chatId],
      references: [chats.id]
    }),
    versions: many(canvasArtifactVersions)
  })
)

export const canvasArtifactVersionsRelations = relations(
  canvasArtifactVersions,
  ({ one }) => ({
    artifact: one(canvasArtifacts, {
      fields: [canvasArtifactVersions.artifactId],
      references: [canvasArtifacts.id]
    })
  })
)

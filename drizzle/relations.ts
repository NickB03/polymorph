import { relations } from 'drizzle-orm/relations'

import { chats, messages } from './schema'

export const messagesRelations = relations(messages, ({ one }) => ({
  chat: one(chats, {
    fields: [messages.chatId],
    references: [chats.id]
  })
}))

export const chatsRelations = relations(chats, ({ many }) => ({
  messages: many(messages)
}))

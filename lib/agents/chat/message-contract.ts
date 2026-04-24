import { validateUIMessages } from 'ai'
import { z } from 'zod'

import type { UIMessage } from '@/lib/types/ai'

import { type ChatAgentTools, createChatAgentValidationTools } from './toolset'

const chatMessageMetadataSchema = z
  .object({
    traceId: z.string().optional(),
    feedbackScore: z.number().nullable().optional(),
    userMode: z.enum(['search', 'research', 'build']).optional(),
    modelType: z.enum(['speed', 'quality']).optional(),
    modelId: z.string().optional(),
    createdAt: z.union([z.string(), z.date()]).optional()
  })
  .passthrough()
  .optional()

const relatedQuestionsDataSchema = z
  .object({
    status: z.enum(['loading', 'streaming', 'success', 'error']),
    questions: z
      .array(
        z.object({
          question: z.string()
        })
      )
      .optional()
  })
  .passthrough()

const canvasArtifactDataSchema = z
  .object({
    artifactId: z.string(),
    chatId: z.string(),
    title: z.string(),
    status: z.string(),
    draftRevision: z.number().int(),
    currentVersionId: z.string().nullable()
  })
  .passthrough()

const canvasArtifactStatusDataSchema = z
  .object({
    artifactId: z.string(),
    chatId: z.string(),
    status: z.string(),
    draftRevision: z.number().int(),
    currentVersionId: z.string().nullable(),
    updatedAt: z.string(),
    guestCanvasToken: z.string().optional()
  })
  .passthrough()

const canvasArtifactEventDataSchema = z
  .object({
    artifactId: z.string(),
    event: z.literal('compile-progress'),
    payload: z.object({}).passthrough()
  })
  .passthrough()

const canvasDiagnosticsDataSchema = z
  .object({
    artifactId: z.string(),
    diagnostics: z.array(z.object({}).passthrough())
  })
  .passthrough()

export const chatMessageDataSchemas = {
  relatedQuestions: relatedQuestionsDataSchema,
  canvasArtifact: canvasArtifactDataSchema,
  canvasArtifactStatus: canvasArtifactStatusDataSchema,
  canvasArtifactEvent: canvasArtifactEventDataSchema,
  canvasDiagnostics: canvasDiagnosticsDataSchema
}

export { chatMessageMetadataSchema }

type ValidateChatUIMessagesArgs = {
  messages: unknown[]
  tools: ChatAgentTools
}

type ValidateUIMessagesOptions = Parameters<typeof validateUIMessages>[0]

export async function validateChatUIMessages({
  messages,
  tools
}: ValidateChatUIMessagesArgs): Promise<UIMessage[]> {
  const validatedMessages = await validateUIMessages({
    messages,
    tools: tools as unknown as ValidateUIMessagesOptions['tools'],
    metadataSchema: chatMessageMetadataSchema,
    dataSchemas: chatMessageDataSchemas
  })

  return validatedMessages as UIMessage[]
}

export function createChatValidationContract(model: string) {
  const tools = createChatAgentValidationTools(model)

  return {
    tools,
    validate: (messages: unknown[]) =>
      validateChatUIMessages({ messages, tools })
  }
}

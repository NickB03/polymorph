import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'
import { ToolUIIdSchema } from '../shared/schema'

export const ArtifactTypeSchema = z.enum(['code', 'table', 'document', 'chart'])

export const ArtifactVersionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  timestamp: z.string().min(1),
  content: z.string()
})

export const ArtifactMetadataSchema = z.object({
  generationTime: z.string().optional(),
  model: z.string().optional(),
  tokens: z.number().int().nonnegative().optional(),
  size: z.string().optional()
})

export const SerializableAgentArtifactSchema = z.object({
  id: ToolUIIdSchema,
  title: z.string().min(1),
  artifactType: ArtifactTypeSchema,
  content: z.string(),
  language: z.string().optional(),
  versions: z.array(ArtifactVersionSchema).optional(),
  currentVersion: z.string().optional(),
  metadata: ArtifactMetadataSchema.optional()
})

export type SerializableAgentArtifact = z.infer<
  typeof SerializableAgentArtifactSchema
>

const contract = defineToolUiContract(
  'AgentArtifact',
  SerializableAgentArtifactSchema
)

export const parseSerializableAgentArtifact: (
  input: unknown
) => SerializableAgentArtifact = contract.parse
export const safeParseSerializableAgentArtifact: (
  input: unknown
) => SerializableAgentArtifact | null = contract.safeParse

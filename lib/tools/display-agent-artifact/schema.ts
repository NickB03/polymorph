import {
  type SerializableAgentArtifact,
  SerializableAgentArtifactSchema
} from '@/components/tool-ui/agent-artifact/schema'

export const toolName = 'displayAgentArtifact' as const
export const inputSchema = SerializableAgentArtifactSchema
export const outputSchema = inputSchema

export type DisplayAgentArtifactInput = SerializableAgentArtifact
export type DisplayAgentArtifactOutput = SerializableAgentArtifact

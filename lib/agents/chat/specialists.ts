import { z } from 'zod'

import {
  competitorResearchInputSchema,
  competitorResearchOutputSchema,
  competitorResearchToolName
} from './specialists/competitor-research'
import type { ChatAgentTools } from './toolset'

export type ChatSpecialist<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny
> = {
  name: string
  description: string
  inputSchema: TInput
  outputSchema: TOutput
  systemPrompt: string
  toolNames: Array<keyof ChatAgentTools>
}

export function defineChatSpecialist<
  TInput extends z.ZodTypeAny,
  TOutput extends z.ZodTypeAny
>(specialist: ChatSpecialist<TInput, TOutput>) {
  return specialist
}

export const competitorResearchSpecialist = defineChatSpecialist({
  name: 'competitorResearch',
  description:
    'Live competitor analysis with a summary, matrix, and notable risks.',
  inputSchema: competitorResearchInputSchema,
  outputSchema: competitorResearchOutputSchema,
  systemPrompt:
    'Compare the provided competitors against the requested dimensions using live search and fetch evidence, then produce structured findings.',
  toolNames: [competitorResearchToolName]
})

export const competitorResearchSpecialistFixture = competitorResearchSpecialist

export const chatSpecialistFixtures = [competitorResearchSpecialist]

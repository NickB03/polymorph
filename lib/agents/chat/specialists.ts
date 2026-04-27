import { z } from 'zod'

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

export const competitorResearchSpecialistFixture = defineChatSpecialist({
  name: 'competitorResearch',
  description:
    'Structured competitor analysis with a summary, matrix, and notable risks.',
  inputSchema: z.object({
    market: z.string().min(1),
    competitors: z.array(z.string().min(1)).min(2).max(6),
    dimensions: z.array(z.string().min(1)).min(1).max(8)
  }),
  outputSchema: z.object({
    summary: z.string(),
    cards: z.array(
      z.object({
        competitor: z.string(),
        strengths: z.array(z.string()),
        weaknesses: z.array(z.string())
      })
    ),
    matrix: z.array(z.record(z.string(), z.string()))
  }),
  systemPrompt:
    'Compare the provided competitors against the requested dimensions and produce structured findings.',
  toolNames: ['search', 'fetch', 'displayTable', 'displayCallout']
})

export const chatSpecialistFixtures = [competitorResearchSpecialistFixture]

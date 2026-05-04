import { z } from 'zod'

export const toolName = 'displayPlan' as const

const PlanTodoSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this step'),
  label: z.string().min(1).describe('Short description of the step'),
  status: z
    .enum(['pending', 'in_progress', 'completed', 'cancelled'])
    .describe('Current status of the step'),
  description: z
    .string()
    .optional()
    .describe('Detailed description (shown on expand)')
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this plan'),
  title: z.string().min(1).describe('Plan title'),
  description: z.string().optional().describe('Brief plan description'),
  todos: z
    .array(PlanTodoSchema)
    .min(1)
    .describe('Steps in the plan with their statuses')
})

export const outputSchema = inputSchema

export type DisplayPlanInput = z.infer<typeof inputSchema>
export type DisplayPlanOutput = z.infer<typeof outputSchema>

import { z } from 'zod'

export const toolName = 'displayOptionList' as const

export const optionSchema = z.object({
  id: z.string().min(1).describe('Unique option identifier'),
  label: z.string().min(1).describe('Display label for the option'),
  description: z
    .string()
    .optional()
    .describe('Additional context for the option')
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this option list'),
  options: z
    .array(optionSchema)
    .min(1)
    .describe('Available options to choose from'),
  selectionMode: z
    .enum(['single', 'multi'])
    .optional()
    .describe('Whether user can select one or multiple options'),
  minSelections: z
    .number()
    .min(0)
    .optional()
    .describe('Minimum required selections'),
  maxSelections: z
    .number()
    .min(1)
    .optional()
    .describe('Maximum allowed selections')
})

export const outputSchema = z.union([z.array(z.string()), z.string(), z.null()])

export type DisplayOptionListInput = z.infer<typeof inputSchema>
export type DisplayOptionListOutput = z.infer<typeof outputSchema>

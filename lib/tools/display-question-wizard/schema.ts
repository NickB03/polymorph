import { z } from 'zod'

export const toolName = 'displayQuestionWizard' as const

export const wizardStepOptionSchema = z.object({
  id: z.string().min(1).describe('Unique option identifier'),
  label: z.string().min(1).describe('Display label for the option'),
  description: z
    .string()
    .optional()
    .describe('Additional context for the option')
})

export const wizardStepSchema = z.object({
  id: z.string().min(1).describe('Unique step identifier'),
  title: z.string().min(1).describe('Step heading shown above the options'),
  description: z
    .string()
    .optional()
    .describe('Explanatory text below the title'),
  options: z
    .array(wizardStepOptionSchema)
    .min(1)
    .describe('Available options for this step'),
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

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this question wizard'),
  steps: z
    .array(wizardStepSchema)
    .min(2)
    .describe('Wizard steps (pages) in order, minimum 2'),
  submitLabel: z
    .string()
    .optional()
    .describe('Label for the final submit button')
})

export const wizardSelectionSchema = z.union([
  z.array(z.string()),
  z.string(),
  z.null()
])

export const outputSchema = z.record(z.string(), wizardSelectionSchema)

export type DisplayQuestionWizardInput = z.infer<typeof inputSchema>
export type DisplayQuestionWizardOutput = z.infer<typeof outputSchema>

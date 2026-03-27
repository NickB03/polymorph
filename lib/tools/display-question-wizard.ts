import { tool } from 'ai'
import { z } from 'zod'

const WizardStepOptionSchema = z.object({
  id: z.string().min(1).describe('Unique option identifier'),
  label: z.string().min(1).describe('Display label for the option'),
  description: z
    .string()
    .optional()
    .describe('Additional context for the option')
})

const WizardStepSchema = z.object({
  id: z.string().min(1).describe('Unique step identifier'),
  title: z.string().min(1).describe('Step heading shown above the options'),
  description: z
    .string()
    .optional()
    .describe('Explanatory text below the title'),
  options: z
    .array(WizardStepOptionSchema)
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

const DisplayQuestionWizardSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this question wizard'),
  steps: z
    .array(WizardStepSchema)
    .min(2)
    .describe('Wizard steps (pages) in order — minimum 2'),
  submitLabel: z
    .string()
    .optional()
    .describe('Label for the final submit button')
})

export const displayQuestionWizardTool = tool({
  description:
    'Display an interactive multi-step question wizard that guides the user through a sequence of related selections. Each step is a page with its own options. The user navigates through all steps and submits once. Use when collecting 2+ related pieces of input that feed into a single decision, such as artifact intake (features + style).',
  inputSchema: DisplayQuestionWizardSchema
  // No execute — frontend resolves via addToolResult
})

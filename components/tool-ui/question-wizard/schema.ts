import { z } from 'zod'

import type { OptionListSelection } from '../option-list/schema'
import { defineToolUiContract } from '../shared/contract'
import { ToolUIIdSchema } from '../shared/schema'

const WizardStepOptionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().optional(),
  disabled: z.boolean().optional()
})

export type WizardStepOption = z.infer<typeof WizardStepOptionSchema>

export const WizardStepSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  options: z.array(WizardStepOptionSchema).min(1),
  selectionMode: z.enum(['single', 'multi']).optional(),
  minSelections: z.number().min(0).optional(),
  maxSelections: z.number().min(1).optional()
})

export type WizardStep = z.infer<typeof WizardStepSchema>

export type WizardResult = Record<string, OptionListSelection>

export const SerializableQuestionWizardSchema = z
  .object({
    id: ToolUIIdSchema,
    steps: z.array(WizardStepSchema).min(1),
    submitLabel: z.string().optional()
  })
  .strict()

export type SerializableQuestionWizard = z.infer<
  typeof SerializableQuestionWizardSchema
>

export type QuestionWizardProps = SerializableQuestionWizard & {
  choice?: WizardResult
  onAction?: (actionId: string, result: WizardResult) => void | Promise<void>
  className?: string
}

const contract = defineToolUiContract(
  'QuestionWizard',
  SerializableQuestionWizardSchema
)

export const parseSerializableQuestionWizard: (
  input: unknown
) => SerializableQuestionWizard = contract.parse

export const safeParseSerializableQuestionWizard: (
  input: unknown
) => SerializableQuestionWizard | null = contract.safeParse

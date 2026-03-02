import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'
import {
  ToolUIIdSchema,
  ToolUIReceiptSchema,
  ToolUIRoleSchema
} from '../shared/schema'

export const CalloutVariantSchema = z.enum([
  'info',
  'warning',
  'tip',
  'success',
  'error',
  'definition'
])

export type CalloutVariant = z.infer<typeof CalloutVariantSchema>

export const SerializableCalloutSchema = z.object({
  id: ToolUIIdSchema,
  role: ToolUIRoleSchema.optional(),
  receipt: ToolUIReceiptSchema.optional(),
  variant: CalloutVariantSchema,
  title: z.string().optional(),
  content: z.string().min(1)
})

export type SerializableCallout = z.infer<typeof SerializableCalloutSchema>

export type CalloutProps = SerializableCallout & {
  className?: string
}

const SerializableCalloutSchemaContract = defineToolUiContract(
  'Callout',
  SerializableCalloutSchema
)

export const parseSerializableCallout: (input: unknown) => SerializableCallout =
  SerializableCalloutSchemaContract.parse

export const safeParseSerializableCallout: (
  input: unknown
) => SerializableCallout | null = SerializableCalloutSchemaContract.safeParse

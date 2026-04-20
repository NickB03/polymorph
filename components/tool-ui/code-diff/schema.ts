import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'
import {
  ToolUIIdSchema,
  ToolUIReceiptSchema,
  ToolUIRoleSchema
} from '../shared/schema'

export const CodeDiffStyleSchema = z.enum(['side-by-side', 'unified'])

export const SerializableCodeDiffSchema = z.object({
  id: ToolUIIdSchema,
  role: ToolUIRoleSchema.optional(),
  receipt: ToolUIReceiptSchema.optional(),
  oldCode: z.string(),
  newCode: z.string(),
  language: z.string().min(1).optional(),
  filename: z.string().min(1).optional(),
  lineNumbers: z.boolean().optional(),
  diffStyle: CodeDiffStyleSchema.optional(),
  maxCollapsedLines: z.number().int().positive().optional()
})

export type SerializableCodeDiff = z.infer<typeof SerializableCodeDiffSchema>

export type CodeDiffProps = SerializableCodeDiff & {
  className?: string
}

const SerializableCodeDiffSchemaContract = defineToolUiContract(
  'CodeDiff',
  SerializableCodeDiffSchema
)

export const parseSerializableCodeDiff: (
  input: unknown
) => SerializableCodeDiff = SerializableCodeDiffSchemaContract.parse

export const safeParseSerializableCodeDiff: (
  input: unknown
) => SerializableCodeDiff | null = SerializableCodeDiffSchemaContract.safeParse

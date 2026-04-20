import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'
import {
  ToolUIIdSchema,
  ToolUIReceiptSchema,
  ToolUIRoleSchema
} from '../shared/schema'

export const SerializableCodeBlockSchema = z.object({
  id: ToolUIIdSchema,
  role: ToolUIRoleSchema.optional(),
  receipt: ToolUIReceiptSchema.optional(),
  code: z.string(),
  language: z.string().min(1).optional(),
  filename: z.string().min(1).optional(),
  lineNumbers: z.boolean().optional(),
  highlightLines: z.array(z.number().int().positive()).optional(),
  maxCollapsedLines: z.number().int().positive().optional()
})

export type SerializableCodeBlock = z.infer<typeof SerializableCodeBlockSchema>

export type CodeBlockProps = SerializableCodeBlock & {
  className?: string
}

const SerializableCodeBlockSchemaContract = defineToolUiContract(
  'CodeBlock',
  SerializableCodeBlockSchema
)

export const parseSerializableCodeBlock: (
  input: unknown
) => SerializableCodeBlock = SerializableCodeBlockSchemaContract.parse

export const safeParseSerializableCodeBlock: (
  input: unknown
) => SerializableCodeBlock | null =
  SerializableCodeBlockSchemaContract.safeParse

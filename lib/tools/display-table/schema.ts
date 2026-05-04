import { z } from 'zod'

export const toolName = 'displayTable' as const

const FormatSchema = z
  .object({
    kind: z
      .string()
      .describe(
        'Format type: text | number | currency | percent | date | delta | boolean | link | badge | status | array'
      )
  })
  .passthrough()

const ColumnSchema = z.object({
  key: z.string().describe('Key in row data to display'),
  label: z.string().describe('Column header label'),
  sortable: z.boolean().optional().describe('Whether column is sortable'),
  align: z.enum(['left', 'right', 'center']).optional(),
  hidden: z
    .boolean()
    .optional()
    .describe(
      'Hide this column from the rendered table. Use for helper columns whose values are referenced by a sibling link column via format.hrefKey.'
    ),
  format: FormatSchema.optional().describe('Value formatting configuration')
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this table'),
  columns: z
    .array(ColumnSchema)
    .min(1)
    .describe('Column definitions with keys and labels'),
  data: z
    .array(
      z.record(
        z.string(),
        z.union([z.string(), z.number(), z.boolean(), z.null()])
      )
    )
    .describe('Row data as array of objects'),
  rowIdKey: z
    .string()
    .optional()
    .describe(
      'Key in row data to use as unique row identifier for stable rendering (e.g. "id", "name")'
    ),
  defaultSort: z
    .object({
      by: z.string().optional(),
      direction: z.enum(['asc', 'desc']).optional()
    })
    .optional()
    .describe('Default sort configuration')
})

export const outputSchema = inputSchema

export type DisplayTableInput = z.infer<typeof inputSchema>
export type DisplayTableOutput = z.infer<typeof outputSchema>

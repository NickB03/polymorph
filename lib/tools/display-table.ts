import { tool } from 'ai'
import { z } from 'zod'

/**
 * Permissive format schema for tool input validation.
 *
 * The AI often produces format configs that are structurally reasonable but
 * don't exactly match strict schemas (e.g., statusMap with string values
 * instead of { tone, label } objects, or colorMap with hex colors instead
 * of enum names). We accept any object with a `kind` string here and let
 * the UI layer handle graceful degradation for unrecognized formats.
 *
 * Supported kinds: text, number, currency, percent, date, delta, boolean,
 * link, badge, status, array
 */
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
  format: FormatSchema.optional().describe('Value formatting configuration')
})

const DisplayTableSchema = z.object({
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

export const displayTableTool = tool({
  description:
    'Display data in a rich, sortable table with formatted columns. Use when presenting structured/tabular data like comparisons, statistics, prices, or lists with multiple attributes.',
  inputSchema: DisplayTableSchema,
  execute: async params => params
})

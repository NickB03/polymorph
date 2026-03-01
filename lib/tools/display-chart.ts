import { tool } from 'ai'
import { z } from 'zod'

const ChartSeriesSchema = z.object({
  key: z.string().min(1).describe('Key in each data row for the Y-axis value'),
  label: z
    .string()
    .min(1)
    .describe('Human-readable label shown in legend/tooltip'),
  color: z.string().optional().describe('CSS color override for this series')
})

const DisplayChartSchema = z
  .object({
    id: z.string().min(1).describe('Unique identifier for this chart'),
    type: z
      .enum(['bar', 'line'])
      .describe(
        'Chart type: "bar" for comparisons/categories, "line" for trends over time'
      ),
    title: z.string().optional().describe('Chart title'),
    description: z.string().optional().describe('Brief chart description'),
    data: z
      .array(z.record(z.string(), z.unknown()))
      .min(1)
      .describe(
        'Array of data rows, each row is an object with keys for xKey and series keys'
      ),
    xKey: z
      .string()
      .min(1)
      .describe('Key in each data row for the X-axis category/time value'),
    series: z
      .array(ChartSeriesSchema)
      .min(1)
      .describe('One or more data series to plot'),
    colors: z
      .array(z.string().min(1))
      .min(1)
      .optional()
      .describe('Color palette applied to series in order'),
    showLegend: z
      .boolean()
      .optional()
      .describe('Show legend below the chart (default false)'),
    showGrid: z
      .boolean()
      .optional()
      .describe('Show horizontal grid lines (default true)')
  })
  .superRefine((value, ctx) => {
    const seenSeriesKeys = new Set<string>()
    value.series.forEach((series, index) => {
      if (seenSeriesKeys.has(series.key)) {
        ctx.addIssue({
          code: 'custom',
          path: ['series', index, 'key'],
          message: `Duplicate series key "${series.key}".`
        })
        return
      }
      seenSeriesKeys.add(series.key)
    })

    value.data.forEach((row, rowIndex) => {
      if (!(value.xKey in row)) {
        ctx.addIssue({
          code: 'custom',
          path: ['data', rowIndex, value.xKey],
          message: `Missing xKey "${value.xKey}" in data row.`
        })
      } else {
        const xVal = row[value.xKey]
        const isValidX = typeof xVal === 'string' || typeof xVal === 'number'
        if (!isValidX) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', rowIndex, value.xKey],
            message: `Expected "${value.xKey}" to be a string or number.`
          })
        }
      }

      value.series.forEach(series => {
        if (!(series.key in row)) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', rowIndex, series.key],
            message: `Missing series key "${series.key}" in data row.`
          })
          return
        }

        const yVal = row[series.key]
        if (yVal === null) {
          return
        }
        if (typeof yVal !== 'number' || !Number.isFinite(yVal)) {
          ctx.addIssue({
            code: 'custom',
            path: ['data', rowIndex, series.key],
            message: `Expected "${series.key}" to be a finite number (or null).`
          })
        }
      })
    })
  })

export const displayChartTool = tool({
  description:
    'Display data as a bar or line chart. Use for visualizing trends over time, comparisons between categories, distributions, or any numeric data that benefits from visual representation. Prefer line charts for time series and bar charts for categorical comparisons.',
  inputSchema: DisplayChartSchema,
  execute: async params => params
})

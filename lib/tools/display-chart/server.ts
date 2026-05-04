import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display data as a bar or line chart. Use for visualizing trends over time, comparisons between categories, distributions, or any numeric data that benefits from visual representation. Prefer line charts for time series and bar charts for categorical comparisons.',
  inputSchema,
  execute: async params => params
})

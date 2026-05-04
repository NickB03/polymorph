import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display data in a rich, sortable table with formatted columns. Use when presenting structured/tabular data like comparisons, statistics, prices, or lists with multiple attributes.',
  inputSchema,
  execute: async params => params
})

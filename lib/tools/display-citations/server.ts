import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a rich list of source citations with metadata. Use when presenting multiple references or sources in a visually organized format.',
  inputSchema,
  execute: async params => params
})

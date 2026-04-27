import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a rich link preview card with title, description, and image. Use when presenting a single important link with visual context, such as a recommended article, documentation page, or resource.',
  inputSchema,
  execute: async params => params
})

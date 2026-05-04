import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a visual step-by-step guide or how-to checklist for the user to follow. Use ONLY for instructional content like tutorials, guides, or learning paths — NOT for research planning or task tracking. Each step has a status indicator.',
  inputSchema,
  execute: async params => params
})

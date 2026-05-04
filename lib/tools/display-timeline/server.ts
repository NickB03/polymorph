import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a vertical timeline of chronological events. Use for histories ("history of X"), event sequences ("what happened with Y"), version histories, project milestones, biographical timelines, or any temporal progression. Events should be in chronological order. Keep to 3-10 events for readability.',
  inputSchema,
  execute: async params => params
})

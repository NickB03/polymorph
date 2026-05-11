import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display geographic points, routes, and regions on an interactive map. ' +
    'Use when the user asks to visualize locations, compare places, plot ' +
    'routes, or explore an area. Prefer `viewport.mode="fit"` unless the ' +
    'user specified a center and zoom level.',
  inputSchema,
  execute: async params => params
})

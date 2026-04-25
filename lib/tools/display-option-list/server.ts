import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display an interactive option list for the user to select from. Use when presenting choices that require user input, such as preferences, configuration options, or decision points.',
  inputSchema
  // No execute: frontend resolves via addToolResult.
})

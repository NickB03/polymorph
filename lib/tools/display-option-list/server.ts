import { createClientResolvedDisplayTool } from '@/lib/tools/tool-ui/server'

import { inputSchema, outputSchema } from './schema'

export const serverTool = createClientResolvedDisplayTool({
  description:
    'Display an interactive option list for the user to select from. Use when presenting choices that require user input, such as preferences, configuration options, or decision points.',
  inputSchema,
  outputSchema
  // No execute: frontend resolves via addToolOutput.
})

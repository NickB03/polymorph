import { createClientResolvedDisplayTool } from '@/lib/tools/tool-ui/server'

import { inputSchema, outputSchema } from './schema'

export const serverTool = createClientResolvedDisplayTool({
  description:
    'Display an interactive multi-step question wizard that guides the user through a sequence of related selections. Each step is a page with its own options. The user navigates through all steps and submits once. Use when collecting 2+ related pieces of input that feed into a single decision, such as artifact intake (features + style).',
  inputSchema,
  outputSchema
  // No execute: frontend resolves via addToolOutput.
})

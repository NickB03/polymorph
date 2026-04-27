import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display an interactive multi-step question wizard that guides the user through a sequence of related selections. Each step is a page with its own options. The user navigates through all steps and submits once. Use when collecting 2+ related pieces of input that feed into a single decision, such as artifact intake (features + style).',
  inputSchema
  // No execute: frontend resolves via addToolResult.
})

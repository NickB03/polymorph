import { tool } from 'ai'

import { inputSchema } from './schema'

export const serverTool = tool({
  description:
    'Display a styled callout box to highlight critical information. Use for warnings (deprecated APIs, breaking changes), tips (best practices, pro tips), definitions (key term explanations), success confirmations, error alerts, or important notes that should stand out from the main text. Keep content concise — one to three sentences.',
  inputSchema,
  execute: async params => params
})

import { createPassthroughDisplayTool } from '@/lib/tools/tool-ui/server'

import { inputSchema } from './schema'

export const serverTool = createPassthroughDisplayTool({
  description:
    'Display an AI-generated artifact with preview, code, raw content, optional versions, and generation metadata. Use for static inline artifacts that do not require the canvas workspace.',
  inputSchema
})

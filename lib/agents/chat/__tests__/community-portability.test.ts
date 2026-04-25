// Portability pattern: Vercel AI SDK "Tools and Tool Calling" structured `tool({ inputSchema, execute })` pattern.
// Source: https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling

import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agents/chat/factory', () => ({
  createConfiguredChatAgent: vi.fn()
}))

vi.mock('@/lib/tools/search', () => ({
  createSearchTool: vi.fn()
}))

import { createBuildAgentDefinition } from '@/lib/agents/chat/build'
import { createResearchAgentDefinition } from '@/lib/agents/chat/research'
import { createSearchAgentDefinition } from '@/lib/agents/chat/search'
import { competitorResearchToolName } from '@/lib/agents/chat/specialists/competitor-research'

describe('community portability proof', () => {
  it('ports a structured tool through local adapters without route or persistence edits', () => {
    const definition = createResearchAgentDefinition({ writer: {} as any })

    expect(definition.activeTools).toContain(competitorResearchToolName)
    expect(definition.activeTools).not.toContain('unknownCommunityGlue')
  })

  it('keeps the portable specialist out of chat/search/build active tools', () => {
    expect(createSearchAgentDefinition().activeTools).not.toContain(
      competitorResearchToolName
    )
    expect(createBuildAgentDefinition().activeTools).not.toContain(
      competitorResearchToolName
    )
  })
})

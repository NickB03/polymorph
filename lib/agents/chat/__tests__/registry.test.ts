import { describe, expect, it, vi } from 'vitest'

const agentMocks = vi.hoisted(() => ({
  createSearchAgent: vi.fn(() => ({ agentId: 'search-agent' })),
  createResearchAgent: vi.fn(() => ({ agentId: 'research-agent' })),
  createBuildAgent: vi.fn(() => ({ agentId: 'build-agent' }))
}))

vi.mock('@/lib/agents/chat/search', () => ({
  createSearchAgent: agentMocks.createSearchAgent
}))

vi.mock('@/lib/agents/chat/research', () => ({
  createResearchAgent: agentMocks.createResearchAgent
}))

vi.mock('@/lib/agents/chat/build', () => ({
  createBuildAgent: agentMocks.createBuildAgent
}))

import { createChatAgent, resolveChatAgentId } from '@/lib/agents/chat/registry'

function makeArgs(overrides: Record<string, unknown> = {}) {
  return {
    model: 'gateway:google/gemini-3-flash',
    ...overrides
  } as any
}

describe('chat agent registry', () => {
  it('resolves stable agent ids from user mode, search mode, and intent', () => {
    expect(
      resolveChatAgentId({
        userMode: 'search',
        searchMode: 'chat'
      })
    ).toBe('search')
    expect(
      resolveChatAgentId({
        userMode: 'research',
        searchMode: 'research'
      })
    ).toBe('research')
    expect(
      resolveChatAgentId({
        userMode: 'build',
        searchMode: 'chat',
        intent: 'build'
      })
    ).toBe('build')
    expect(
      resolveChatAgentId({
        searchMode: 'chat',
        intent: 'build'
      })
    ).toBe('build')
  })

  it('delegates chat agent construction to the selected agent module', () => {
    expect(createChatAgent(makeArgs({ userMode: 'search' }))).toEqual({
      agentId: 'search-agent'
    })
    expect(createChatAgent(makeArgs({ searchMode: 'research' }))).toEqual({
      agentId: 'research-agent'
    })
    expect(createChatAgent(makeArgs({ intent: 'build' }))).toEqual({
      agentId: 'build-agent'
    })

    expect(agentMocks.createSearchAgent).toHaveBeenCalledWith(
      expect.objectContaining({ userMode: 'search' })
    )
    expect(agentMocks.createResearchAgent).toHaveBeenCalledWith(
      expect.objectContaining({ searchMode: 'research' })
    )
    expect(agentMocks.createBuildAgent).toHaveBeenCalledWith(
      expect.objectContaining({ intent: 'build' })
    )
  })
})

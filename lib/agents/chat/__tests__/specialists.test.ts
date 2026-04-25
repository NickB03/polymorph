import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/agents/chat/factory', () => ({
  createConfiguredChatAgent: vi.fn()
}))

vi.mock('@/lib/tools/search/server', () => ({
  createSearchTool: vi.fn()
}))

import { createBuildAgentDefinition } from '../build'
import { createResearchAgentDefinition } from '../research'
import { createSearchAgentDefinition } from '../search'
import {
  chatSpecialistFixtures,
  competitorResearchSpecialistFixture
} from '../specialists'
import {
  competitorResearchInputSchema,
  competitorResearchOutputSchema,
  competitorResearchToolName,
  createCompetitorResearchTool
} from '../specialists/competitor-research'

async function collectToolResult<T>(result: T | AsyncIterable<T>): Promise<T> {
  if (result && typeof result === 'object' && Symbol.asyncIterator in result) {
    let finalChunk: T | undefined
    for await (const chunk of result as AsyncIterable<T>) {
      finalChunk = chunk
    }
    return finalChunk as T
  }

  return result as T
}

describe('chat specialist fixtures', () => {
  it('defines a proof fixture that fits the specialist contract', () => {
    const parsedInput = competitorResearchSpecialistFixture.inputSchema.parse({
      market: 'AI chat platforms',
      competitors: ['Alpha', 'Beta'],
      dimensions: ['UX', 'Reliability']
    })

    const parsedOutput = competitorResearchSpecialistFixture.outputSchema.parse(
      {
        summary: 'Alpha leads on UX while Beta is stronger on reliability.',
        cards: [
          {
            competitor: 'Alpha',
            strengths: ['UX'],
            weaknesses: ['Reliability']
          }
        ],
        matrix: [{ competitor: 'Alpha', UX: 'High', Reliability: 'Medium' }]
      }
    )

    expect(parsedInput.market).toBe('AI chat platforms')
    expect(parsedOutput.cards[0]?.competitor).toBe('Alpha')
    expect(chatSpecialistFixtures).toContain(
      competitorResearchSpecialistFixture
    )
  })

  it('rejects competitor research requests with fewer than two competitors', () => {
    expect(() =>
      competitorResearchInputSchema.parse({
        market: 'AI chat platforms',
        competitors: ['Alpha'],
        dimensions: ['UX']
      })
    ).toThrow()
  })

  it('requires summary, cards, and matrix in competitor research output', () => {
    expect(() =>
      competitorResearchOutputSchema.parse({
        summary: 'Alpha leads on UX.'
      })
    ).toThrow()
  })

  it('executes competitor research through the provided search and fetch tools', async () => {
    const searchTool = {
      execute: vi.fn(async function* () {
        yield {
          state: 'complete',
          query: 'AI chat platforms Alpha',
          results: [
            {
              title: 'Alpha overview',
              url: 'https://example.com/alpha',
              content: 'Alpha emphasizes UX speed and team onboarding.'
            }
          ],
          images: []
        }
      })
    }
    const fetchTool = {
      execute: vi.fn(async function* () {
        yield {
          state: 'complete',
          url: 'https://example.com/alpha',
          content: 'Alpha pricing and reliability details.'
        }
      })
    }

    const tool = createCompetitorResearchTool({
      searchTool: searchTool as any,
      fetchTool: fetchTool as any
    })
    const output = await collectToolResult(
      await tool.execute?.(
        {
          market: 'AI chat platforms',
          competitors: ['Alpha', 'Beta'],
          dimensions: ['UX', 'Reliability']
        },
        {} as never
      )
    )

    expect(searchTool.execute).toHaveBeenCalled()
    expect(fetchTool.execute).toHaveBeenCalled()
    expect(competitorResearchOutputSchema.parse(output).cards).toHaveLength(2)
  })

  it('registers competitor research only on the research agent', () => {
    expect(createResearchAgentDefinition().activeTools).toContain(
      competitorResearchToolName
    )
    expect(createSearchAgentDefinition().activeTools).not.toContain(
      competitorResearchToolName
    )
    expect(createBuildAgentDefinition().activeTools).not.toContain(
      competitorResearchToolName
    )
  })
})

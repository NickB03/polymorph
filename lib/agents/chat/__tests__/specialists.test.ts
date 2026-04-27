import { describe, expect, it } from 'vitest'

import {
  chatSpecialistFixtures,
  competitorResearchSpecialistFixture
} from '../specialists'

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
})

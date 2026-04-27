import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CompetitorResearchResult } from './competitor-research-result'

const result = {
  summary: 'Alpha leads on UX while Beta is stronger on reliability.',
  cards: [
    {
      competitor: 'Alpha',
      strengths: ['Fast onboarding', 'Polished workspace'],
      weaknesses: ['Limited enterprise controls']
    },
    {
      competitor: 'Beta',
      strengths: ['Reliable integrations'],
      weaknesses: ['Higher setup effort']
    }
  ],
  matrix: [
    {
      competitor: 'Alpha',
      UX: 'Strong',
      Reliability: 'Moderate'
    },
    {
      competitor: 'Beta',
      UX: 'Moderate',
      Reliability: 'Strong'
    }
  ]
}

describe('CompetitorResearchResult', () => {
  it('renders summary, competitor cards, and comparison matrix cells', () => {
    render(<CompetitorResearchResult {...result} />)

    expect(
      screen.getByText(
        'Alpha leads on UX while Beta is stronger on reliability.'
      )
    ).toBeInTheDocument()
    expect(screen.getByText('Fast onboarding')).toBeInTheDocument()
    expect(screen.getByText('Higher setup effort')).toBeInTheDocument()
    expect(
      screen.getByRole('columnheader', { name: 'Reliability' })
    ).toBeInTheDocument()
    expect(screen.getAllByText('Strong')).toHaveLength(2)
  })
})

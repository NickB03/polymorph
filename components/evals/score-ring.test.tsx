import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { ScoreRing } from './score-ring'

describe('ScoreRing', () => {
  it('keeps the center label inside a relative wrapper', () => {
    const { container } = render(
      <ScoreRing label="Overall" score={0.87} passRate={0.91} />
    )

    const wrapper = container.querySelector('[data-testid="score-ring"]')
    expect(wrapper?.className).toContain('relative')
    expect(screen.getByText('87%')).toBeInTheDocument()
    expect(screen.getAllByText('Overall')).toHaveLength(2)
  })
})

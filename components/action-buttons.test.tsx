import { createElement } from 'react'

import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { ActionButtons } from './action-buttons'

vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { fill, alt = '', ...rest } = props
    return createElement('img', {
      alt: typeof alt === 'string' ? alt : '',
      'data-fill': fill ? 'true' : undefined,
      ...rest
    })
  }
}))

const promptSamples = {
  research: ['Research prompt'],
  compare: ['Compare prompt'],
  latest: ['Latest prompt'],
  summarize: ['Summarize prompt'],
  explain: ['Explain prompt']
}

describe('ActionButtons', () => {
  it('renders category buttons with 44px touch targets (h-11)', () => {
    render(
      <ActionButtons
        inputRef={{ current: null }}
        onSelectPrompt={vi.fn()}
        onCategoryClick={vi.fn()}
        onBuildTemplateSelect={vi.fn()}
        promptSamples={promptSamples}
        canvasEnabled
      />
    )

    const researchBtn = screen.getByRole('button', { name: /research/i })
    const buildBtn = screen.getByRole('button', { name: /build/i })

    expect(researchBtn.className).toMatch(/\bh-11\b/)
    expect(buildBtn.className).toMatch(/\bh-11\b/)
  })

  it('uses grid-cols-2 for mobile-safe build template layout', () => {
    const { container } = render(
      <ActionButtons
        inputRef={{ current: null }}
        onSelectPrompt={vi.fn()}
        onCategoryClick={vi.fn()}
        onBuildTemplateSelect={vi.fn()}
        promptSamples={promptSamples}
        canvasEnabled
      />
    )

    // Click the Build button to reveal the template grid
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /build/i }))
    })

    const grid = container.querySelector('.grid')
    expect(grid).not.toBeNull()
    expect(grid!.className).toMatch(/\bgrid-cols-3\b/)
  })
})

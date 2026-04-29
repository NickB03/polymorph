import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { TooltipProvider } from '@/components/ui/tooltip'

import { DefinedTerm } from '../defined-term'
import { JudgeLabel } from '../judge-label'

function withTooltip(node: React.ReactNode) {
  return <TooltipProvider>{node}</TooltipProvider>
}

describe('DefinedTerm', () => {
  it('renders children with a help cursor and dotted underline', () => {
    render(withTooltip(<DefinedTerm def="test def">Hello</DefinedTerm>))
    const term = screen.getByText('Hello')
    expect(term).toHaveClass('cursor-help')
    expect(term.className).toMatch(/decoration-dotted/)
  })
})

describe('JudgeLabel', () => {
  it('renders the human-readable judge label', () => {
    render(withTooltip(<JudgeLabel judgeKey="faithfulness" />))
    expect(screen.getByText('Faithfulness')).toBeInTheDocument()
  })

  it('renders unknown keys as raw text without tooltip wrapper', () => {
    render(withTooltip(<JudgeLabel judgeKey="not_a_judge" />))
    expect(screen.getByText('Not A Judge')).toBeInTheDocument()
  })
})

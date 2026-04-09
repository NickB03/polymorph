import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import type { RelatedQuestionsData } from '@/lib/types/ai'

import { RelatedQuestions } from './related-questions'

describe('RelatedQuestions', () => {
  const onQuerySelect = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.clearAllTimers()
  })

  it('renders loading placeholders instead of dropping the state', () => {
    const data: RelatedQuestionsData = { status: 'loading' }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-questions-loading')).toBeInTheDocument()
    expect(screen.getAllByTestId('related-question-skeleton')).toHaveLength(3)
  })

  it('renders streaming questions and placeholders', () => {
    const data: RelatedQuestionsData = {
      status: 'streaming',
      questions: [{ question: 'First' }]
    }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(
      screen.getByTestId('related-questions-streaming')
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument()
    expect(screen.getAllByTestId('related-question-skeleton')).toHaveLength(2)
  })

  it('renders the error state explicitly', () => {
    const data: RelatedQuestionsData = { status: 'error' }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-questions-error')).toHaveTextContent(
      'Failed to generate related questions'
    )
  })

  it('cycles questions for the latest message and pauses on hover', () => {
    const data: RelatedQuestionsData = {
      status: 'success',
      questions: [{ question: 'One' }, { question: 'Two' }]
    }

    render(
      <RelatedQuestions
        data={data}
        onQuerySelect={onQuerySelect}
        isLatestMessage
      />
    )

    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One' })).toHaveClass(
      'animate-ticker-in'
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(screen.getByRole('button', { name: 'One' })).not.toHaveClass(
      'animate-ticker-in'
    )

    fireEvent.mouseEnter(screen.getByTestId('related-questions-ticker'))

    act(() => {
      vi.advanceTimersByTime(10000)
    })

    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()

    fireEvent.mouseLeave(screen.getByTestId('related-questions-ticker'))

    act(() => {
      vi.advanceTimersByTime(3400)
    })

    expect(screen.getByRole('button', { name: 'Two' })).toHaveClass(
      'animate-ticker-in'
    )
  })

  it('stops after the configured rotations and leaves only the label', () => {
    const data: RelatedQuestionsData = {
      status: 'success',
      questions: [{ question: 'One' }, { question: 'Two' }]
    }

    render(
      <RelatedQuestions
        data={data}
        onQuerySelect={onQuerySelect}
        isLatestMessage
      />
    )

    act(() => {
      vi.advanceTimersByTime(15600)
    })

    expect(
      screen.queryByTestId('related-questions-ticker')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('related-questions-label')).toHaveTextContent(
      'Related'
    )
  })

  it('renders only the static label for older success messages', () => {
    const data: RelatedQuestionsData = {
      status: 'success',
      questions: [{ question: 'One' }, { question: 'Two' }]
    }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-questions-label')).toHaveTextContent(
      'Related'
    )
    expect(
      screen.queryByRole('button', { name: 'One' })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('related-questions-ticker')
    ).not.toBeInTheDocument()
  })
})

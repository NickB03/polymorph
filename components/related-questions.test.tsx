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

  it('renders inline loading skeleton', () => {
    const data: RelatedQuestionsData = { status: 'loading' }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-questions-label')).toHaveTextContent(
      'Related'
    )
    expect(screen.getByTestId('related-question-skeleton')).toBeInTheDocument()
  })

  it('renders first streaming question inline', () => {
    const data: RelatedQuestionsData = {
      status: 'streaming',
      questions: [{ question: 'First' }]
    }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByRole('button', { name: 'First' })).toBeInTheDocument()
  })

  it('renders inline skeleton when streaming with no questions yet', () => {
    const data: RelatedQuestionsData = {
      status: 'streaming',
      questions: []
    }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-question-skeleton')).toBeInTheDocument()
  })

  it('renders the error state inline', () => {
    const data: RelatedQuestionsData = { status: 'error' }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-questions-error')).toHaveTextContent(
      'Failed to load'
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

    // Hover the ticker button to pause
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

  it('fades away after configured rotations', () => {
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
    // Suggestion fades away — no static fallback
    expect(
      screen.queryByTestId('related-questions-static')
    ).not.toBeInTheDocument()
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })

  it('restarts ticker on intentional hover after completion', () => {
    const data: RelatedQuestionsData = {
      status: 'success',
      questions: [{ question: 'One' }, { question: 'Two' }]
    }

    const { container } = render(
      <RelatedQuestions
        data={data}
        onQuerySelect={onQuerySelect}
        isLatestMessage
      />
    )

    // Complete all rotations
    act(() => {
      vi.advanceTimersByTime(15600)
    })

    expect(
      screen.queryByTestId('related-questions-ticker')
    ).not.toBeInTheDocument()

    // Hover the section — should NOT restart immediately
    const section = container.querySelector('section')!
    fireEvent.mouseEnter(section)

    expect(
      screen.queryByTestId('related-questions-ticker')
    ).not.toBeInTheDocument()

    // After hover intent delay, ticker restarts
    act(() => {
      vi.advanceTimersByTime(300)
    })

    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One' })).toHaveClass(
      'animate-ticker-in'
    )
  })

  it('does not restart on brief hover (accidental scroll-over)', () => {
    const data: RelatedQuestionsData = {
      status: 'success',
      questions: [{ question: 'One' }, { question: 'Two' }]
    }

    const { container } = render(
      <RelatedQuestions
        data={data}
        onQuerySelect={onQuerySelect}
        isLatestMessage
      />
    )

    // Complete all rotations
    act(() => {
      vi.advanceTimersByTime(15600)
    })

    // Brief hover — mouse enters and leaves before intent delay
    const section = container.querySelector('section')!
    fireEvent.mouseEnter(section)

    act(() => {
      vi.advanceTimersByTime(100)
    })

    fireEvent.mouseLeave(section)

    act(() => {
      vi.advanceTimersByTime(500)
    })

    // Should not have restarted
    expect(
      screen.queryByTestId('related-questions-ticker')
    ).not.toBeInTheDocument()
    expect(
      screen.queryByTestId('related-questions-static')
    ).not.toBeInTheDocument()
  })

  it('renders static question for older success messages', () => {
    const data: RelatedQuestionsData = {
      status: 'success',
      questions: [{ question: 'One' }, { question: 'Two' }]
    }

    render(<RelatedQuestions data={data} onQuerySelect={onQuerySelect} />)

    expect(screen.getByTestId('related-questions-label')).toHaveTextContent(
      'Related'
    )
    expect(
      screen.queryByTestId('related-questions-ticker')
    ).not.toBeInTheDocument()
    expect(screen.getByTestId('related-questions-static')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'One' })).toBeInTheDocument()
  })
})

import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { OnboardingTour, useTourAutoStart } from '../onboarding-tour'
import { TourProvider, useTour } from '../tour'

function withProvider(children: React.ReactNode, tourId = 'onboarding-test') {
  return <TourProvider tourId={tourId}>{children}</TourProvider>
}

describe('OnboardingTour', () => {
  it('configures exactly four polymorph-specific steps targeting tour ids', () => {
    let captured: ReturnType<typeof useTour> | null = null
    function Inspect() {
      captured = useTour()
      return null
    }
    render(
      withProvider(
        <>
          <OnboardingTour />
          <Inspect />
        </>
      )
    )
    expect(captured!.steps.length).toBe(4)
    expect(captured!.steps.map(s => s.selectorId)).toEqual([
      'tour-chat-input',
      'mode-selector-trigger',
      'tour-suggestions',
      'tour-sidebar'
    ])
  })
})

describe('useTourAutoStart', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does nothing when the tour is already completed', () => {
    const { result } = renderHook(
      () => {
        useTourAutoStart({ isFirstVisit: false, delay: 0 })
        return useTour()
      },
      {
        wrapper: ({ children }) => withProvider(children, 'autostart-completed')
      }
    )
    expect(result.current.isActive).toBe(false)
  })

  it('starts the tour after the delay when isFirstVisit is true', () => {
    const { result } = renderHook(
      () => {
        useTourAutoStart({ isFirstVisit: true, delay: 100 })
        return useTour()
      },
      {
        wrapper: ({ children }) =>
          withProvider(
            <>
              <OnboardingTour />
              {children}
            </>,
            'autostart-happy'
          )
      }
    )
    expect(result.current.isActive).toBe(false)
    act(() => {
      vi.advanceTimersByTime(100)
    })
    expect(result.current.isActive).toBe(true)
    expect(result.current.currentStep).toBe(0)
  })
})

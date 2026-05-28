import { render, renderHook } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

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
})

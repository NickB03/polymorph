import { act, render, renderHook, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { TourProvider, useTour } from '../tour'

function wrapper({ children }: { children: React.ReactNode }) {
  return <TourProvider tourId="unit">{children}</TourProvider>
}

describe('TourProvider', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('starts inactive with currentStep=-1 and no steps', () => {
    const { result } = renderHook(() => useTour(), { wrapper })
    expect(result.current.currentStep).toBe(-1)
    expect(result.current.isActive).toBe(false)
    expect(result.current.totalSteps).toBe(0)
  })

  it('startTour is a no-op when no steps are configured', () => {
    const { result } = renderHook(() => useTour(), { wrapper })
    act(() => result.current.startTour())
    expect(result.current.currentStep).toBe(-1)
  })

  it('advances through steps and completes on the last step', () => {
    const onComplete = vi.fn()
    function Steps() {
      const tour = useTour()
      return (
        <button
          onClick={() => {
            tour.setSteps([
              { selectorId: 'a', content: 'A' },
              { selectorId: 'b', content: 'B' }
            ])
            tour.startTour()
          }}
        >
          go
        </button>
      )
    }
    const { result } = renderHook(() => useTour(), {
      wrapper: ({ children }) => (
        <TourProvider tourId="unit-2" onComplete={onComplete}>
          <Steps />
          {children}
        </TourProvider>
      )
    })
    act(() => {
      result.current.setSteps([
        { selectorId: 'a', content: 'A' },
        { selectorId: 'b', content: 'B' }
      ])
      result.current.startTour()
    })
    expect(result.current.currentStep).toBe(0)
    act(() => result.current.nextStep())
    expect(result.current.currentStep).toBe(1)
    act(() => result.current.nextStep())
    expect(result.current.currentStep).toBe(-1)
    expect(result.current.isTourCompleted).toBe(true)
    expect(onComplete).toHaveBeenCalledTimes(1)
  })

  it('persists completion to localStorage under the polymorph- prefix', () => {
    const { result } = renderHook(() => useTour(), {
      wrapper: ({ children }) => (
        <TourProvider tourId="persisted">{children}</TourProvider>
      )
    })
    act(() => result.current.setIsTourCompleted(true))
    const raw = localStorage.getItem('polymorph-tour-persisted')
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw!).completed).toBe(true)
  })

  it('useTour throws outside a TourProvider', () => {
    expect(() => render(<HookConsumer />)).toThrow(
      /useTour must be used within/
    )
  })
})

function HookConsumer() {
  useTour()
  return null
}

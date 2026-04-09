import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useTickerRotation } from './use-ticker-rotation'

function stubReducedMotion(matches: boolean) {
  const addEventListener = vi.fn()
  const removeEventListener = vi.fn()

  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockImplementation(() => ({
      matches,
      addEventListener,
      removeEventListener,
      addListener: addEventListener,
      removeListener: removeEventListener
    }))
  )
}

describe('useTickerRotation', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    stubReducedMotion(false)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it('returns idle state when items are empty', () => {
    const { result } = renderHook(() =>
      useTickerRotation({ items: [], displayMs: 3000, rotations: 2 })
    )

    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.phase).toBe('idle')
    expect(result.current.isComplete).toBe(true)
  })

  it('starts with the first item entering', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )

    expect(result.current.activeIndex).toBe(0)
    expect(result.current.phase).toBe('entering')
    expect(result.current.isComplete).toBe(false)
  })

  it('transitions to visible after enter animation', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })

    expect(result.current.phase).toBe('visible')
  })

  it('transitions to exiting after display time', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )

    act(() => {
      vi.advanceTimersByTime(3500)
    })

    expect(result.current.phase).toBe('exiting')
  })

  it('advances to next item after exit animation', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )

    act(() => {
      vi.advanceTimersByTime(3900)
    })

    expect(result.current.activeIndex).toBe(1)
    expect(result.current.phase).toBe('entering')
  })

  it('stops after the configured number of rotations', () => {
    const items = ['a', 'b']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 1000, rotations: 2 })
    )

    act(() => {
      vi.advanceTimersByTime(1900 * 4)
    })

    expect(result.current.isComplete).toBe(true)
    expect(result.current.phase).toBe('idle')
    expect(result.current.activeIndex).toBe(-1)
  })

  it('pauses and resumes cycling without advancing while paused', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 3000, rotations: 2 })
    )

    act(() => {
      vi.advanceTimersByTime(500)
    })
    expect(result.current.phase).toBe('visible')

    act(() => {
      result.current.pause()
      vi.advanceTimersByTime(10000)
    })

    expect(result.current.phase).toBe('visible')
    expect(result.current.activeIndex).toBe(0)

    act(() => {
      result.current.resume()
      vi.advanceTimersByTime(3000)
    })

    expect(result.current.phase).toBe('exiting')
  })

  it('does not rotate when isActive is false', () => {
    const items = ['a', 'b', 'c']
    const { result } = renderHook(() =>
      useTickerRotation({
        items,
        displayMs: 3000,
        rotations: 2,
        isActive: false
      })
    )

    expect(result.current.activeIndex).toBe(-1)
    expect(result.current.phase).toBe('idle')
    expect(result.current.isComplete).toBe(true)
  })

  it('skips enter and exit delays when reduced motion is preferred', () => {
    stubReducedMotion(true)

    const items = ['a', 'b']
    const { result } = renderHook(() =>
      useTickerRotation({ items, displayMs: 1000, rotations: 1 })
    )

    expect(result.current.activeIndex).toBe(0)
    expect(result.current.phase).toBe('visible')

    act(() => {
      vi.advanceTimersByTime(1000)
      vi.runOnlyPendingTimers()
    })

    expect(result.current.isComplete).toBe(true)
    expect(result.current.phase).toBe('idle')
  })
})

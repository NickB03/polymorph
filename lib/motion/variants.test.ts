import { renderHook } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

let reduceValue = false

vi.mock('motion/react', () => ({
  useReducedMotion: () => reduceValue
}))

import { useResolvedVariants } from './variants'

describe('useResolvedVariants', () => {
  beforeEach(() => {
    reduceValue = false
  })

  it('returns full-motion variants when reduce is false', () => {
    reduceValue = false
    const { result } = renderHook(() => useResolvedVariants())

    expect(result.current.cardEntrance.animate.transition.duration).toBe(0.2)
    expect(
      result.current.staggerParent.animate.transition.staggerChildren
    ).toBe(0.05)
    expect(result.current.pillPresence.exit.transition.duration).toBe(0.14)
  })

  it('collapses to zero motion when reduce is true', () => {
    reduceValue = true
    const { result } = renderHook(() => useResolvedVariants())

    expect(result.current.cardEntrance.animate.transition.duration).toBe(0)
    expect(
      result.current.staggerParent.animate.transition.staggerChildren
    ).toBe(0)
    expect(result.current.pillPresence.exit.transition.duration).toBe(0)
    expect(result.current.staggerChild.animate.transition.duration).toBe(0)
  })
})

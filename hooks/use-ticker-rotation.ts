import { useCallback, useEffect, useRef, useState } from 'react'

import { usePrefersReducedMotion } from './use-prefers-reduced-motion'

type Phase = 'entering' | 'visible' | 'exiting' | 'idle'
type Step = 'enter-to-visible' | 'visible-to-exit' | 'exit-to-next'

const ENTER_MS = 500
const EXIT_MS = 400

interface UseTickerRotationOptions<T> {
  items: T[]
  displayMs: number
  rotations: number
  isActive?: boolean
}

interface UseTickerRotationReturn {
  activeIndex: number
  phase: Phase
  isComplete: boolean
  pause: () => void
  resume: () => void
  restart: () => void
}

export function useTickerRotation<T>({
  items,
  displayMs,
  rotations,
  isActive = true
}: UseTickerRotationOptions<T>): UseTickerRotationReturn {
  const prefersReducedMotion = usePrefersReducedMotion()
  const enterMs = prefersReducedMotion ? 0 : ENTER_MS
  const exitMs = prefersReducedMotion ? 0 : EXIT_MS
  const totalShows = items.length * rotations

  const [activeIndex, setActiveIndex] = useState(-1)
  const [phase, setPhase] = useState<Phase>('idle')
  const [isComplete, setIsComplete] = useState(true)

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const deadlineRef = useRef(0)
  const remainingMsRef = useRef(0)
  const pausedRef = useRef(false)
  const stepRef = useRef<Step | null>(null)
  const shownCountRef = useRef(0)
  const advanceRef = useRef<(step: Step) => void>(() => {})

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const finish = useCallback(() => {
    clearTimer()
    pausedRef.current = false
    remainingMsRef.current = 0
    stepRef.current = null
    shownCountRef.current = 0
    setActiveIndex(-1)
    setPhase('idle')
    setIsComplete(true)
  }, [clearTimer])

  const scheduleStep = useCallback(
    (step: Step, delay: number) => {
      stepRef.current = step

      if (!isActive || items.length === 0 || totalShows === 0) {
        finish()
        return
      }

      clearTimer()

      if (delay <= 0) {
        advanceRef.current(step)
        return
      }

      deadlineRef.current = Date.now() + delay
      timerRef.current = setTimeout(() => {
        timerRef.current = null
        remainingMsRef.current = 0

        if (!pausedRef.current) {
          advanceRef.current(step)
        }
      }, delay)
    },
    [clearTimer, finish, isActive, items.length, totalShows]
  )

  advanceRef.current = step => {
    if (!isActive || items.length === 0 || totalShows === 0) {
      finish()
      return
    }

    if (step === 'enter-to-visible') {
      setPhase('visible')
      scheduleStep('visible-to-exit', displayMs)
      return
    }

    if (step === 'visible-to-exit') {
      setPhase('exiting')
      scheduleStep('exit-to-next', exitMs)
      return
    }

    if (shownCountRef.current >= totalShows - 1) {
      finish()
      return
    }

    shownCountRef.current += 1
    setActiveIndex(shownCountRef.current % items.length)
    setPhase('entering')
    scheduleStep('enter-to-visible', enterMs)
  }

  const pause = useCallback(() => {
    if (!isActive || pausedRef.current || timerRef.current === null) {
      return
    }

    remainingMsRef.current = Math.max(0, deadlineRef.current - Date.now())
    pausedRef.current = true
    clearTimer()
  }, [clearTimer, isActive])

  const resume = useCallback(() => {
    if (!pausedRef.current) {
      return
    }

    pausedRef.current = false
    const step = stepRef.current
    const remainingMs = remainingMsRef.current
    remainingMsRef.current = 0

    if (!step) {
      return
    }

    if (remainingMs <= 0) {
      advanceRef.current(step)
      return
    }

    deadlineRef.current = Date.now() + remainingMs
    timerRef.current = setTimeout(() => {
      timerRef.current = null

      if (!pausedRef.current) {
        advanceRef.current(step)
      }
    }, remainingMs)
  }, [])

  const restart = useCallback(() => {
    clearTimer()
    pausedRef.current = false
    remainingMsRef.current = 0
    stepRef.current = null
    shownCountRef.current = 0

    if (!isActive || items.length === 0 || totalShows === 0) {
      setActiveIndex(-1)
      setPhase('idle')
      setIsComplete(true)
      return
    }

    setIsComplete(false)
    setActiveIndex(0)
    setPhase('entering')
    scheduleStep('enter-to-visible', enterMs)
  }, [clearTimer, enterMs, isActive, items.length, scheduleStep, totalShows])

  useEffect(() => {
    clearTimer()
    pausedRef.current = false
    remainingMsRef.current = 0
    stepRef.current = null
    shownCountRef.current = 0

    if (!isActive || items.length === 0 || totalShows === 0) {
      setActiveIndex(-1)
      setPhase('idle')
      setIsComplete(true)
      return
    }

    setIsComplete(false)
    setActiveIndex(0)
    setPhase('entering')
    scheduleStep('enter-to-visible', enterMs)

    return () => clearTimer()
    // Depend on items.length (not the items reference) so a parent re-render
    // that produces a new array with the same questions doesn't reset the ticker.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearTimer, enterMs, isActive, items.length, scheduleStep, totalShows])

  return {
    activeIndex,
    phase,
    isComplete,
    pause,
    resume,
    restart
  }
}

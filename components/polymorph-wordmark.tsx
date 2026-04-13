'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

import { usePrefersReducedMotion } from '@/hooks/use-prefers-reduced-motion'

const SUFFIX_WORDS = [
  'morph',
  'explore',
  'create',
  'discover',
  'research',
  'morph'
] as const

const SUFFIX_MAX_LEN = Math.max(...SUFFIX_WORDS.map(w => w.length))
const FINAL_WORD = 'morph'
const FINAL_INDEX = SUFFIX_WORDS.length - 1

const CYCLE_ENTER_MS = 440
const FINAL_ENTER_MS = 760
const EXIT_MS = 190
const HOLD_MS = 600

function PolySuffixFluid() {
  const reducedMotion = usePrefersReducedMotion()
  const [word, setWord] = useState('')
  const [wordKey, setWordKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [settled, setSettled] = useState(false)
  const [isLanding, setIsLanding] = useState(false)

  useEffect(() => {
    if (reducedMotion && !settled) {
      setWord(FINAL_WORD)
      setWordKey(1)
      setWordIndex(FINAL_INDEX)
      setSettled(true)
    }
  }, [reducedMotion, settled])

  useEffect(() => {
    if (settled || reducedMotion) return
    const nextIdx = wordIndex + 1
    if (nextIdx > FINAL_INDEX) {
      setSettled(true)
      return
    }

    const holdDelay = wordIndex === -1 ? 100 : CYCLE_ENTER_MS + HOLD_MS
    const isFinal = nextIdx === FINAL_INDEX
    let innerTimer: ReturnType<typeof setTimeout> | undefined

    const outerTimer = setTimeout(() => {
      const target = SUFFIX_WORDS[nextIdx] as string

      if (wordIndex >= 0) {
        setIsExiting(true)
        const gap = isFinal ? EXIT_MS : EXIT_MS + 20
        innerTimer = setTimeout(() => {
          setIsExiting(false)
          setIsLanding(isFinal)
          setWord(target)
          setWordKey(k => k + 1)
          setWordIndex(nextIdx)
        }, gap)
      } else {
        setWord(target)
        setWordKey(k => k + 1)
        setWordIndex(nextIdx)
      }
    }, holdDelay)

    return () => {
      clearTimeout(outerTimer)
      if (innerTimer) clearTimeout(innerTimer)
    }
  }, [wordIndex, settled, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setWord(FINAL_WORD)
        setWordKey(k => k + 1)
        setWordIndex(FINAL_INDEX)
        setIsExiting(false)
        setIsLanding(false)
        setSettled(true)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () =>
      document.removeEventListener('visibilitychange', handleVisibility)
  }, [reducedMotion])

  const animation = reducedMotion
    ? undefined
    : isExiting
      ? `morphSlotOut ${EXIT_MS}ms cubic-bezier(0.4,0,1,1) both`
      : word
        ? isLanding
          ? `morphSlotLand ${FINAL_ENTER_MS}ms cubic-bezier(0.22,1,0.36,1) both`
          : `morphSlotIn ${CYCLE_ENTER_MS}ms linear both`
        : undefined

  return (
    <span
      aria-label="Polymorph"
      className="inline-flex select-none leading-none font-medium"
      style={{
        marginRight: `-${SUFFIX_MAX_LEN - FINAL_WORD.length}ch`
      }}
    >
      <span
        aria-hidden="true"
        className="shrink-0 text-neutral-900 dark:text-neutral-100"
      >
        poly
      </span>
      <span
        aria-hidden="true"
        style={{ minWidth: `${SUFFIX_MAX_LEN}ch`, overflow: 'hidden' }}
      >
        <span
          key={wordKey}
          className="inline-block text-accent-blue"
          style={{ animation }}
        >
          {word}
        </span>
      </span>
    </span>
  )
}

export function PolymorphWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[2.5rem]', className)}>
      <PolySuffixFluid />
    </span>
  )
}

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

function PolySuffixFluid() {
  const reducedMotion = usePrefersReducedMotion()
  const [word, setWord] = useState('')
  const [wordKey, setWordKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [settled, setSettled] = useState(false)
  const [isSettling, setIsSettling] = useState(false)

  const enterDuration = 440
  const exitDuration = 190

  // Reduced motion: skip to final word immediately
  useEffect(() => {
    if (reducedMotion && !settled) {
      setWord(FINAL_WORD)
      setWordKey(1)
      setWordIndex(SUFFIX_WORDS.length - 1)
      setSettled(true)
    }
  }, [reducedMotion, settled])

  // Word cycling
  useEffect(() => {
    if (settled || reducedMotion) return
    const nextIdx = wordIndex + 1
    if (nextIdx >= SUFFIX_WORDS.length) {
      setSettled(true)
      return
    }

    const holdDelay = wordIndex === -1 ? 100 : enterDuration + 600

    const timeout = setTimeout(() => {
      const target = SUFFIX_WORDS[nextIdx] as string

      if (wordIndex >= 0) {
        setIsExiting(true)
        setTimeout(() => {
          setIsExiting(false)
          setWord(target)
          setWordKey(k => k + 1)
          setWordIndex(nextIdx)
        }, exitDuration + 20)
      } else {
        setWord(target)
        setWordKey(k => k + 1)
        setWordIndex(nextIdx)
      }
    }, holdDelay)

    return () => clearTimeout(timeout)
  }, [wordIndex, settled, reducedMotion])

  // One-time settle pulse after final word lands
  useEffect(() => {
    if (!settled || reducedMotion) return
    const timeout = setTimeout(() => {
      setIsSettling(true)
      setTimeout(() => setIsSettling(false), 400)
    }, enterDuration)
    return () => clearTimeout(timeout)
  }, [settled, reducedMotion])

  const animation = reducedMotion
    ? undefined
    : isSettling
      ? 'morphSlotSettle 400ms ease-in-out both'
      : isExiting
        ? `morphSlotOut ${exitDuration}ms cubic-bezier(0.4,0,1,1) both`
        : word
          ? `morphSlotIn ${enterDuration}ms linear both`
          : undefined

  return (
    <span
      className="inline-flex select-none leading-none font-medium"
      style={{
        marginRight: `-${SUFFIX_MAX_LEN - FINAL_WORD.length}ch`
      }}
    >
      <span className="shrink-0 text-neutral-900 dark:text-neutral-100">
        poly
      </span>
      <span style={{ minWidth: `${SUFFIX_MAX_LEN}ch`, overflow: 'hidden' }}>
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

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
  const [word, setWord] = useState(reducedMotion ? FINAL_WORD : '')
  const [wordKey, setWordKey] = useState(reducedMotion ? 1 : 0)
  const [isExiting, setIsExiting] = useState(false)
  const [wordIndex, setWordIndex] = useState(reducedMotion ? FINAL_INDEX : -1)
  const [isLanding, setIsLanding] = useState(false)
  // settled is derived: we've finished the cycle as soon as we hit the last
  // index, or immediately if reduced-motion is on.
  const settled = reducedMotion || wordIndex >= FINAL_INDEX

  // If reduced-motion flips on mid-cycle, snap to the final word. The rule
  // allows setState in an effect when synchronising with an external source;
  // reducedMotion comes from a media-query listener.
  useEffect(() => {
    if (reducedMotion && wordIndex < FINAL_INDEX) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- external-source sync (reduced-motion media query)
      setWord(FINAL_WORD)
      setWordKey(k => k + 1)
      setWordIndex(FINAL_INDEX)
      setIsExiting(false)
      setIsLanding(false)
    }
  }, [reducedMotion, wordIndex])

  useEffect(() => {
    if (settled) return
    const nextIdx = wordIndex + 1
    // wordIndex < FINAL_INDEX always holds here (settled gate above), so
    // nextIdx never overshoots — the cycle terminates by hitting FINAL_INDEX
    // through the setter inside the inner timeout, which flips `settled`.
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
  }, [wordIndex, settled])

  useEffect(() => {
    if (reducedMotion) return
    const handleVisibility = () => {
      if (document.visibilityState === 'hidden') {
        setWord(FINAL_WORD)
        setWordKey(k => k + 1)
        setWordIndex(FINAL_INDEX)
        setIsExiting(false)
        setIsLanding(false)
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
      className="inline-flex select-none leading-none font-medium"
      style={{
        marginRight: `-${SUFFIX_MAX_LEN - FINAL_WORD.length}ch`
      }}
    >
      <span className="sr-only">Polymorph</span>
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

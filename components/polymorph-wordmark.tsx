'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const SUFFIX_WORDS = [
  'learn',
  'create',
  'discover',
  'research',
  'morph'
] as const

const SUFFIX_MAX_LEN = Math.max(...SUFFIX_WORDS.map(w => w.length))
const FINAL_WORD = SUFFIX_WORDS[SUFFIX_WORDS.length - 1]

function useReducedMotion() {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReduced(mql.matches)
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])
  return reduced
}

function getSuffixHoldDelay(index: number, total: number): number {
  const center = (total - 1) / 2
  const distFromCenter = Math.abs(index - center) / center
  return 600 + distFromCenter * distFromCenter * 500
}

function PolySuffixFluid({ staggerMs = 30 }: { staggerMs?: number }) {
  const reducedMotion = useReducedMotion()
  const [word, setWord] = useState('')
  const [wordKey, setWordKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [settled, setSettled] = useState(false)

  const enterDuration = 280
  const exitDuration = 150

  // In reduced-motion mode, skip animation and show final word immediately
  useEffect(() => {
    if (reducedMotion && !settled) {
      setWord(FINAL_WORD)
      setWordKey(1)
      setWordIndex(SUFFIX_WORDS.length - 1)
      setSettled(true)
    }
  }, [reducedMotion, settled])

  useEffect(() => {
    if (settled || reducedMotion) return
    const nextIdx = wordIndex + 1
    if (nextIdx >= SUFFIX_WORDS.length) {
      setSettled(true)
      return
    }

    const holdDelay =
      wordIndex === -1
        ? 800
        : Math.max(
            enterDuration + staggerMs * SUFFIX_MAX_LEN + 100,
            getSuffixHoldDelay(wordIndex, SUFFIX_WORDS.length)
          )

    const timeout = setTimeout(() => {
      const target = SUFFIX_WORDS[nextIdx] as string

      if (wordIndex >= 0) {
        setIsExiting(true)
        const totalExit = exitDuration + staggerMs * SUFFIX_MAX_LEN
        setTimeout(() => {
          setIsExiting(false)
          setWord(target)
          setWordKey(k => k + 1)
          setWordIndex(nextIdx)
        }, totalExit)
      } else {
        setWord(target)
        setWordKey(k => k + 1)
        setWordIndex(nextIdx)
      }
    }, holdDelay)

    return () => clearTimeout(timeout)
  }, [wordIndex, settled, staggerMs, reducedMotion])

  // Offset the entire wordmark so the *visible* text is centered,
  // not the box (which reserves space for the longest word).
  const wordLen = word.length || SUFFIX_MAX_LEN
  const centerOffset = (SUFFIX_MAX_LEN - wordLen) / 2

  return (
    <>
      <span
        className="inline-flex select-none leading-none font-medium"
        style={{
          transform:
            centerOffset > 0 ? `translateX(${centerOffset}ch)` : undefined,
          transition: 'transform 300ms ease-out'
        }}
      >
        <span className="shrink-0 text-neutral-900 dark:text-neutral-100">
          poly
        </span>
        <span style={{ minWidth: `${SUFFIX_MAX_LEN}ch` }}>
          {word.split('').map((char, i) => {
            const isFinal = word === FINAL_WORD
            const enter = isFinal ? 650 : enterDuration
            const stagger = isFinal ? staggerMs * 2.5 : staggerMs
            return (
              <span
                key={`${wordKey}-${i}`}
                className="inline-block text-blue-600 dark:text-blue-400"
                style={{
                  animation: reducedMotion
                    ? undefined
                    : isExiting
                      ? `morphFluidExit ${exitDuration}ms ease-in ${staggerMs * i}ms forwards`
                      : word
                        ? `morphFluidEnter ${enter}ms ease-out ${stagger * i}ms both`
                        : undefined
                }}
              >
                {char}
              </span>
            )
          })}
        </span>
      </span>
    </>
  )
}

export function PolymorphWordmark({ className }: { className?: string }) {
  return (
    <span className={cn('text-[2.5rem]', className)}>
      <PolySuffixFluid staggerMs={30} />
    </span>
  )
}

'use client'

import { useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

const SUFFIX_WORDS = [
  'morph',
  'learn',
  'create',
  'discover',
  'research',
  'morph'
] as const

const SUFFIX_MAX_LEN = Math.max(...SUFFIX_WORDS.map(w => w.length))
const FINAL_WORD = 'morph'

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

function PolySuffixFluid({ staggerMs = 70 }: { staggerMs?: number }) {
  const reducedMotion = useReducedMotion()
  const [word, setWord] = useState('')
  const [wordKey, setWordKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [settled, setSettled] = useState(false)

  const enterDuration = 50
  const exitDuration = 40

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

    // First word types in immediately, others hold briefly before transitioning
    const holdDelay =
      wordIndex === -1
        ? 100
        : enterDuration +
          staggerMs * (SUFFIX_WORDS[wordIndex] as string).length +
          400

    const timeout = setTimeout(() => {
      const target = SUFFIX_WORDS[nextIdx] as string

      if (wordIndex >= 0) {
        setIsExiting(true)
        const currentWord = SUFFIX_WORDS[wordIndex] as string
        const totalExit = exitDuration + staggerMs * currentWord.length
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

  return (
    <>
      <span
        className="inline-flex select-none leading-none font-medium"
        style={{
          marginRight: `-${SUFFIX_MAX_LEN - FINAL_WORD.length}ch`
        }}
      >
        <span className="shrink-0 text-neutral-900 dark:text-neutral-100">
          poly
        </span>
        <span style={{ minWidth: `${SUFFIX_MAX_LEN}ch` }}>
          {word.split('').map((char, i) => {
            const isFinal =
              word === FINAL_WORD && wordIndex === SUFFIX_WORDS.length - 1
            const enter = isFinal ? 60 : enterDuration
            const entryStagger = isFinal ? staggerMs * 1.2 : staggerMs
            // Exit in reverse order (backspace: last char disappears first)
            const exitDelay = staggerMs * (word.length - 1 - i)
            return (
              <span
                key={`${wordKey}-${i}`}
                className="inline-block text-accent-blue"
                style={{
                  animation: reducedMotion
                    ? undefined
                    : isExiting
                      ? `morphFluidExit ${exitDuration}ms linear ${exitDelay}ms forwards`
                      : word
                        ? `morphFluidEnter ${enter}ms linear ${entryStagger * i}ms both`
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
      <PolySuffixFluid staggerMs={70} />
    </span>
  )
}

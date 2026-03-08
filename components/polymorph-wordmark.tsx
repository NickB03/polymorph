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

function getSuffixHoldDelay(index: number, total: number): number {
  const center = (total - 1) / 2
  const distFromCenter = Math.abs(index - center) / center
  return 600 + distFromCenter * distFromCenter * 500
}

const KEYFRAMES = `
@keyframes morphFluidEnter {
  0% {
    opacity: 0;
    transform: translateY(20%) scaleY(0.9);
    filter: blur(1.5px);
  }
  50% {
    opacity: 1;
    filter: blur(0);
  }
  75% {
    transform: translateY(-2%) scaleY(1.01);
  }
  100% {
    opacity: 1;
    transform: translateY(0) scaleY(1);
    filter: blur(0);
  }
}
@keyframes morphFluidExit {
  0% {
    opacity: 1;
    transform: translateY(0) scaleY(1);
    filter: blur(0);
  }
  100% {
    opacity: 0;
    transform: translateY(-15%) scaleY(0.95);
    filter: blur(1.5px);
  }
}
`

function PolySuffixFluid({ staggerMs = 30 }: { staggerMs?: number }) {
  const [word, setWord] = useState('')
  const [wordKey, setWordKey] = useState(0)
  const [isExiting, setIsExiting] = useState(false)
  const [wordIndex, setWordIndex] = useState(-1)
  const [settled, setSettled] = useState(false)

  const enterDuration = 280
  const exitDuration = 150

  useEffect(() => {
    if (settled) return
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
  }, [wordIndex, settled, staggerMs])

  return (
    <>
      <style>{KEYFRAMES}</style>
      <span className="inline-flex select-none leading-none font-medium">
        <span className="shrink-0 text-neutral-900 dark:text-neutral-100">
          poly
        </span>
        <span style={{ minWidth: `${SUFFIX_MAX_LEN}ch` }}>
          {word.split('').map((char, i) => {
            const isFinal = word === SUFFIX_WORDS[SUFFIX_WORDS.length - 1]
            const enter = isFinal ? 650 : enterDuration
            const stagger = isFinal ? staggerMs * 2.5 : staggerMs
            return (
              <span
                key={`${wordKey}-${i}`}
                className="inline-block text-blue-600 dark:text-blue-400"
                style={{
                  animation: isExiting
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

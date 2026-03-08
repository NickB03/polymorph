'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

// ─────────────────────────────────────────────
// Shared utilities
// ─────────────────────────────────────────────

const WORD = 'polymorph'
const CHARS = 'abcdefghijklmnopqrstuvwxyz'
const GREEK = 'πολύμορφος'
const randomChar = () => CHARS[Math.floor(Math.random() * CHARS.length)]

/** Generic hook: increment a key on an interval to remount a component */
function useLoop(intervalMs: number) {
  const [key, setKey] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setKey(k => k + 1), intervalMs)
    return () => clearInterval(id)
  }, [intervalMs])
  return key
}

function DemoCard({
  title,
  number,
  description,
  children,
  className
}: {
  title: string
  number: number
  description: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-neutral-200 bg-white p-8 dark:border-neutral-800 dark:bg-neutral-950',
        className
      )}
    >
      <div className="mb-2 text-xs font-medium tracking-widest text-neutral-400 uppercase">
        #{number}
      </div>
      <h2 className="mb-1 text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        {title}
      </h2>
      <p className="mb-8 text-sm text-neutral-500">{description}</p>
      <div className="flex min-h-24 items-center justify-center">
        {children}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────
// #1 — The Restless Word
// Chaotic → settle → idle twitches → repeat
// ─────────────────────────────────────────────

function RestlessWord() {
  const [letters, setLetters] = useState(() => WORD.split('').map(randomChar))
  const [settled, setSettled] = useState(() =>
    new Array(WORD.length).fill(false)
  )

  useEffect(() => {
    const intervals: ReturnType<typeof setInterval>[] = []
    const timeouts: ReturnType<typeof setTimeout>[] = []

    WORD.split('').forEach((target, i) => {
      const delay = 300 + i * 180 + Math.random() * 400
      const flickerInterval = setInterval(() => {
        setLetters(prev => {
          const next = [...prev]
          next[i] = randomChar()
          return next
        })
      }, 60)

      intervals.push(flickerInterval)

      timeouts.push(
        setTimeout(() => {
          clearInterval(flickerInterval)
          setLetters(prev => {
            const next = [...prev]
            next[i] = target
            return next
          })
          setSettled(prev => {
            const next = [...prev]
            next[i] = true
            return next
          })
        }, delay)
      )
    })

    // Idle twitching after settle
    const idleTimeout = setTimeout(() => {
      const twitchInterval = setInterval(() => {
        const idx = Math.floor(Math.random() * WORD.length)
        const original = WORD[idx]

        setLetters(prev => {
          const next = [...prev]
          next[idx] = randomChar()
          return next
        })

        setTimeout(() => {
          setLetters(prev => {
            const next = [...prev]
            next[idx] = original
            return next
          })
        }, 120)
      }, 800)
      intervals.push(twitchInterval)
    }, 2500)
    timeouts.push(idleTimeout)

    return () => {
      intervals.forEach(clearInterval)
      timeouts.forEach(clearTimeout)
    }
  }, [])

  return (
    <span className="font-mono text-4xl font-light tracking-wider text-neutral-900 dark:text-neutral-100">
      {letters.map((char, i) => (
        <span
          key={i}
          className={cn(
            'inline-block transition-all duration-100',
            settled[i] ? 'opacity-100' : 'opacity-60'
          )}
          style={{
            transform: settled[i]
              ? 'translateY(0)'
              : `translateY(${Math.random() * 4 - 2}px)`
          }}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

function RestlessWordLooped() {
  // Remount every 8s to replay the settle → idle cycle
  const key = useLoop(8000)
  return <RestlessWord key={key} />
}

// ─────────────────────────────────────────────
// #2 — Etymological Descent
// πολύμορφος → polymorph → hold → repeat
// ─────────────────────────────────────────────

function EtymologicalDescent() {
  const [progress, setProgress] = useState(0)
  const [phase, setPhase] = useState<'greek' | 'morphing' | 'latin'>('greek')

  const greekChars = GREEK.split('')
  const latinChars = WORD.split('')
  const greekLen = greekChars.length
  const latinLen = latinChars.length

  useEffect(() => {
    const holdTimer = setTimeout(() => {
      setPhase('morphing')
      let step = 0
      const maxSteps = Math.max(greekLen, latinLen)

      const interval = setInterval(() => {
        step++
        setProgress(step)
        if (step >= maxSteps) {
          clearInterval(interval)
          setPhase('latin')
        }
      }, 150)

      return () => clearInterval(interval)
    }, 1200)

    return () => clearTimeout(holdTimer)
  }, [greekLen, latinLen])

  const renderChars = () => {
    const maxLen = Math.max(greekChars.length, latinChars.length)
    const chars: React.ReactNode[] = []

    for (let i = 0; i < maxLen; i++) {
      const isResolved =
        phase === 'latin' || (phase === 'morphing' && i < progress)
      const greekChar = greekChars[i] || ''
      const latinChar = latinChars[i] || ''
      const showChar = isResolved ? latinChar : greekChar
      const isFading = isResolved && !latinChar

      chars.push(
        <span
          key={i}
          className={cn(
            'inline-block transition-all duration-300',
            isResolved && latinChar && 'text-neutral-900 dark:text-neutral-100',
            !isResolved && 'text-neutral-500 dark:text-neutral-400',
            isFading && 'w-0 scale-0 opacity-0'
          )}
          style={{ fontStyle: !isResolved ? 'italic' : 'normal' }}
        >
          {showChar}
        </span>
      )
    }
    return chars
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <span className="font-serif text-4xl tracking-wide">{renderChars()}</span>
      <span
        className={cn(
          'text-xs tracking-widest text-neutral-400 transition-opacity duration-500',
          phase === 'greek' ? 'opacity-100' : 'opacity-0'
        )}
      >
        /po.lý.mor.pʰos/
      </span>
    </div>
  )
}

function EtymologicalDescentLooped() {
  const key = useLoop(6000)
  return <EtymologicalDescent key={key} />
}

// ─────────────────────────────────────────────
// #3 — The Quiet Anagram
// "romp holy" → dissolve → reform "polymorph" → hold → repeat
// ─────────────────────────────────────────────

function QuietAnagram() {
  const anagram = 'romp holy'
  const [displayText, setDisplayText] = useState(anagram)
  const [phase, setPhase] = useState<
    'anagram' | 'dissolve' | 'reform' | 'done'
  >('anagram')

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('dissolve'), 1500)

    const t2 = setTimeout(() => {
      setPhase('reform')
      let step = 0
      const target = WORD
      const interval = setInterval(() => {
        step++
        const resolved = target.slice(0, step)
        const remaining = target
          .slice(step)
          .split('')
          .sort(() => Math.random() - 0.5)
          .join('')
        setDisplayText(resolved + remaining)
        if (step >= target.length) {
          clearInterval(interval)
          setPhase('done')
        }
      }, 140)
    }, 2200)

    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [])

  return (
    <span className="font-mono text-4xl font-light tracking-wider text-neutral-900 dark:text-neutral-100">
      {displayText.split('').map((char, i) => (
        <span
          key={`${phase}-${i}`}
          className={cn(
            'inline-block transition-all duration-200',
            phase === 'dissolve' && 'blur-[1px] opacity-70',
            phase === 'done' && 'opacity-100'
          )}
        >
          {char === ' ' ? '\u00A0' : char}
        </span>
      ))}
    </span>
  )
}

function QuietAnagramLooped() {
  const key = useLoop(6000)
  return <QuietAnagram key={key} />
}

// ─────────────────────────────────────────────
// #4 — Convergence from Chaos
// Slot-machine cycling, locking L→R, then repeat
// ─────────────────────────────────────────────

function ConvergenceFromChaos() {
  const [letters, setLetters] = useState(() => WORD.split('').map(randomChar))
  const [locked, setLocked] = useState(() => new Array(WORD.length).fill(false))

  useEffect(() => {
    const lockedState = new Array(WORD.length).fill(false)

    const spinInterval = setInterval(() => {
      setLetters(prev =>
        prev.map((_, i) => (lockedState[i] ? WORD[i] : randomChar()))
      )
    }, 40)

    WORD.split('').forEach((_, i) => {
      setTimeout(
        () => {
          lockedState[i] = true
          setLocked(prev => {
            const next = [...prev]
            next[i] = true
            return next
          })
          setLetters(prev => {
            const next = [...prev]
            next[i] = WORD[i]
            return next
          })
        },
        600 + i * 200
      )
    })

    setTimeout(
      () => {
        clearInterval(spinInterval)
      },
      600 + WORD.length * 200 + 100
    )

    return () => clearInterval(spinInterval)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <span className="font-mono text-4xl tracking-wider text-neutral-900 dark:text-neutral-100">
      {letters.map((char, i) => (
        <span
          key={i}
          className={cn(
            'inline-block transition-all duration-150',
            locked[i]
              ? 'scale-100 font-medium opacity-100'
              : 'scale-95 font-light opacity-40'
          )}
        >
          {char}
        </span>
      ))}
    </span>
  )
}

function ConvergenceFromChaosLooped() {
  const key = useLoop(5000)
  return <ConvergenceFromChaos key={key} />
}

// ─────────────────────────────────────────────
// #5 — The Meaning Morph
// research → discover → create → polymorph → loop
// ─────────────────────────────────────────────

const MEANING_WORDS = ['research', 'discover', 'create', 'polymorph'] as const

function MeaningMorph() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [displayText, setDisplayText] = useState<string>(MEANING_WORDS[0])
  const [isMorphing, setIsMorphing] = useState(false)

  const morphTo = useCallback(
    (from: string, to: string, onComplete: () => void) => {
      setIsMorphing(true)
      const maxLen = Math.max(from.length, to.length)
      let step = 0

      const interval = setInterval(() => {
        step++
        const newText = Array.from({ length: maxLen }, (_, i) => {
          if (i < step) return to[i] || ''
          if (i < from.length) return randomChar()
          return randomChar()
        }).join('')

        setDisplayText(newText)

        if (step >= maxLen) {
          clearInterval(interval)
          setDisplayText(to)
          setIsMorphing(false)
          onComplete()
        }
      }, 70)

      return () => clearInterval(interval)
    },
    []
  )

  useEffect(() => {
    const timeout = setTimeout(
      () => {
        const nextIndex = (currentIndex + 1) % MEANING_WORDS.length
        morphTo(MEANING_WORDS[currentIndex], MEANING_WORDS[nextIndex], () => {
          setCurrentIndex(nextIndex)
        })
      },
      // Hold "polymorph" longer before cycling back
      currentIndex === MEANING_WORDS.length - 1 ? 2000 : 1200
    )

    return () => clearTimeout(timeout)
  }, [currentIndex, morphTo])

  const isFinal = currentIndex === MEANING_WORDS.length - 1 && !isMorphing

  return (
    <span
      className={cn(
        'font-mono text-4xl tracking-wider transition-colors duration-300',
        isFinal
          ? 'font-medium text-neutral-900 dark:text-neutral-100'
          : 'font-light text-neutral-500 dark:text-neutral-400'
      )}
    >
      {displayText}
    </span>
  )
}

// ─────────────────────────────────────────────
// #5b — Meaning Morph: Typewriter
// Backspace current word, type next word
// ─────────────────────────────────────────────

function MeaningMorphTypewriter() {
  const [displayText, setDisplayText] = useState(MEANING_WORDS[0] as string)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [cursorVisible, setCursorVisible] = useState(true)

  // Blink cursor
  useEffect(() => {
    const id = setInterval(() => setCursorVisible(v => !v), 530)
    return () => clearInterval(id)
  }, [])

  useEffect(() => {
    const currentWord = MEANING_WORDS[currentIndex]
    const nextIndex = (currentIndex + 1) % MEANING_WORDS.length
    const nextWord = MEANING_WORDS[nextIndex]

    // Hold, then erase, then type
    const holdDelay = currentIndex === MEANING_WORDS.length - 1 ? 2000 : 1200
    const timeouts: ReturnType<typeof setTimeout>[] = []

    // Erase phase
    let t = holdDelay
    for (let i = currentWord.length; i >= 0; i--) {
      const delay = t
      timeouts.push(
        setTimeout(() => setDisplayText(currentWord.slice(0, i)), delay)
      )
      t += 50
    }

    // Small pause between erase and type
    t += 150

    // Type phase
    for (let i = 1; i <= nextWord.length; i++) {
      const delay = t
      timeouts.push(
        setTimeout(() => setDisplayText(nextWord.slice(0, i)), delay)
      )
      t += 80
    }

    // Advance to next word
    timeouts.push(setTimeout(() => setCurrentIndex(nextIndex), t))

    return () => timeouts.forEach(clearTimeout)
  }, [currentIndex])

  const isFinal = displayText === MEANING_WORDS[MEANING_WORDS.length - 1]

  return (
    <span
      className={cn(
        'font-mono text-4xl tracking-wider transition-colors duration-300',
        isFinal
          ? 'font-medium text-neutral-900 dark:text-neutral-100'
          : 'font-light text-neutral-500 dark:text-neutral-400'
      )}
    >
      {displayText}
      <span
        className={cn(
          'ml-[1px] inline-block w-[2px] bg-current align-middle transition-opacity',
          cursorVisible ? 'opacity-70' : 'opacity-0'
        )}
        style={{ height: '1.1em' }}
      />
    </span>
  )
}

// ─────────────────────────────────────────────
// #5c — Meaning Morph: Departure Board
// Each character slot flips vertically through chars
// ─────────────────────────────────────────────

function DepartureBoardChar({
  target,
  delay
}: {
  target: string
  delay: number
}) {
  const [current, setCurrent] = useState(' ')
  const [isFlipping, setIsFlipping] = useState(false)

  useEffect(() => {
    if (!target) {
      setCurrent('')
      return
    }

    const timeout = setTimeout(() => {
      setIsFlipping(true)
      let charIndex = 0
      // Cycle through alphabet until we hit the target
      const interval = setInterval(() => {
        const ch = CHARS[charIndex % CHARS.length]
        setCurrent(ch)
        if (ch === target) {
          clearInterval(interval)
          setIsFlipping(false)
        }
        charIndex++
        // Safety bail after full alphabet
        if (charIndex > 26) {
          clearInterval(interval)
          setCurrent(target)
          setIsFlipping(false)
        }
      }, 30)

      return () => clearInterval(interval)
    }, delay)

    return () => clearTimeout(timeout)
  }, [target, delay])

  return (
    <span
      className={cn(
        'inline-block w-[0.65em] text-center transition-transform duration-75',
        isFlipping && 'scale-y-95'
      )}
    >
      {current}
    </span>
  )
}

function MeaningMorphDepartureBoard() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [targetWord, setTargetWord] = useState(MEANING_WORDS[0] as string)

  useEffect(() => {
    const holdDelay = currentIndex === MEANING_WORDS.length - 1 ? 2400 : 1400
    const nextIndex = (currentIndex + 1) % MEANING_WORDS.length

    const timeout = setTimeout(() => {
      setTargetWord(MEANING_WORDS[nextIndex])
      // Wait for the flip animation to complete, then advance
      const longestDelay = MEANING_WORDS[nextIndex].length * 80 + 800
      setTimeout(() => setCurrentIndex(nextIndex), longestDelay)
    }, holdDelay)

    return () => clearTimeout(timeout)
  }, [currentIndex])

  const maxLen = Math.max(...MEANING_WORDS.map(w => w.length))

  return (
    <span className="font-mono text-4xl tracking-wider text-neutral-900 dark:text-neutral-100">
      {Array.from({ length: maxLen }, (_, i) => (
        <DepartureBoardChar
          key={`${currentIndex}-${i}`}
          target={targetWord[i] || ''}
          delay={i * 80}
        />
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────
// #5d — Meaning Morph: Wave Sweep
// A colored wave passes L→R, revealing the next word
// ─────────────────────────────────────────────

function MeaningMorphWave() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [nextIndex, setNextIndex] = useState(1)
  const [wavePos, setWavePos] = useState(-1)
  const [isWaving, setIsWaving] = useState(false)

  const currentWord = MEANING_WORDS[currentIndex]
  const nextWord = MEANING_WORDS[nextIndex]
  const maxLen = Math.max(currentWord.length, nextWord.length)

  useEffect(() => {
    const holdDelay = currentIndex === MEANING_WORDS.length - 1 ? 2000 : 1200

    const timeout = setTimeout(() => {
      setIsWaving(true)
      setWavePos(-1)

      let pos = -1
      const interval = setInterval(() => {
        pos++
        setWavePos(pos)
        if (pos > maxLen + 2) {
          clearInterval(interval)
          setIsWaving(false)
          setWavePos(-1)
          const ni = (currentIndex + 1) % MEANING_WORDS.length
          setCurrentIndex(ni)
          setNextIndex((ni + 1) % MEANING_WORDS.length)
        }
      }, 80)

      return () => clearInterval(interval)
    }, holdDelay)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  return (
    <span className="font-mono text-4xl font-light tracking-wider">
      {Array.from({ length: maxLen }, (_, i) => {
        const isPast = isWaving && i < wavePos
        const isAtWave = isWaving && (i === wavePos || i === wavePos - 1)
        const char =
          isPast || (isWaving && i <= wavePos)
            ? nextWord[i] || ''
            : currentWord[i] || ''

        return (
          <span
            key={i}
            className={cn(
              'inline-block transition-all duration-100',
              isAtWave && 'scale-110 text-blue-500 dark:text-blue-400',
              isPast && !isAtWave && 'text-neutral-900 dark:text-neutral-100',
              !isPast && !isAtWave && 'text-neutral-500 dark:text-neutral-400'
            )}
            style={{
              filter: isAtWave ? 'blur(0.5px)' : 'none'
            }}
          >
            {char || '\u00A0'}
          </span>
        )
      })}
    </span>
  )
}

// ─────────────────────────────────────────────
// #5e — Meaning Morph: Random Settle
// All characters scramble simultaneously, each finds
// its target independently at a random time
// ─────────────────────────────────────────────

function MeaningMorphRandomSettle() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [letters, setLetters] = useState(() =>
    (MEANING_WORDS[0] as string).split('')
  )
  const [settled, setSettled] = useState(() =>
    new Array(MEANING_WORDS[0].length).fill(true)
  )

  useEffect(() => {
    const holdDelay = currentIndex === MEANING_WORDS.length - 1 ? 2000 : 1200
    const nextIndex = (currentIndex + 1) % MEANING_WORDS.length
    const nextWord = MEANING_WORDS[nextIndex]
    const maxLen = Math.max(MEANING_WORDS[currentIndex].length, nextWord.length)

    const timeout = setTimeout(() => {
      // Start scrambling all positions
      setSettled(new Array(maxLen).fill(false))

      const scrambleInterval = setInterval(() => {
        setLetters(prev =>
          Array.from({ length: maxLen }, (_, i) =>
            prev[i] === nextWord[i] ? nextWord[i] || '' : randomChar()
          )
        )
      }, 50)

      // Each position settles at a random time
      const settleTimeouts: ReturnType<typeof setTimeout>[] = []
      const indices = Array.from({ length: maxLen }, (_, i) => i).sort(
        () => Math.random() - 0.5
      )

      indices.forEach((i, order) => {
        const delay = 400 + order * 150 + Math.random() * 200
        settleTimeouts.push(
          setTimeout(() => {
            setLetters(prev => {
              const next = [...prev]
              next[i] = nextWord[i] || ''
              return next
            })
            setSettled(prev => {
              const next = [...prev]
              next[i] = true
              return next
            })
          }, delay)
        )
      })

      // Clean up and advance
      const totalTime = 400 + maxLen * 150 + 400
      settleTimeouts.push(
        setTimeout(() => {
          clearInterval(scrambleInterval)
          setLetters(nextWord.split(''))
          setSettled(new Array(nextWord.length).fill(true))
          setCurrentIndex(nextIndex)
        }, totalTime)
      )

      return () => {
        clearInterval(scrambleInterval)
        settleTimeouts.forEach(clearTimeout)
      }
    }, holdDelay)

    return () => clearTimeout(timeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex])

  const isFinal =
    currentIndex === MEANING_WORDS.length - 1 && settled.every(Boolean)

  return (
    <span
      className={cn(
        'font-mono text-4xl tracking-wider',
        isFinal
          ? 'font-medium text-neutral-900 dark:text-neutral-100'
          : 'font-light'
      )}
    >
      {letters.map((char, i) => (
        <span
          key={i}
          className={cn(
            'inline-block transition-all duration-150',
            settled[i]
              ? 'text-neutral-900 dark:text-neutral-100'
              : 'text-neutral-400 dark:text-neutral-500'
          )}
        >
          {char || '\u00A0'}
        </span>
      ))}
    </span>
  )
}

// ─────────────────────────────────────────────
// #5f — Meaning Morph: Rapid Cascade → Settle
// Flicks through action words fast, decelerates,
// lands on "polymorph"
// ─────────────────────────────────────────────

const CASCADE_WORDS = [
  'poly',
  'create',
  'explore',
  'research',
  'discover',
  'generate',
  'analyze',
  'compose',
  'imagine',
  'transform',
  'iterate',
  'refine',
  'design',
  'build',
  'polymorph'
] as const

const CASCADE_MAX_LEN = Math.max(...CASCADE_WORDS.map(w => w.length))

function CascadeFlipChar({
  target,
  stagger
}: {
  target: string
  stagger: number
}) {
  const [display, setDisplay] = useState(target)
  const prevTarget = useRef(target)

  useEffect(() => {
    if (target === prevTarget.current) return
    prevTarget.current = target

    if (!target) {
      setDisplay('')
      return
    }

    let step = 0
    const flipCount = 3
    const timeout = setTimeout(() => {
      const interval = setInterval(() => {
        step++
        if (step >= flipCount) {
          clearInterval(interval)
          setDisplay(target)
        } else {
          setDisplay(randomChar())
        }
      }, 25)

      return () => clearInterval(interval)
    }, stagger * 20)

    return () => clearTimeout(timeout)
  }, [target, stagger])

  return (
    <span
      className={cn(
        'inline-block w-[0.65em] text-center transition-transform duration-75',
        display !== target && 'scale-y-90 opacity-60'
      )}
    >
      {display || '\u00A0'}
    </span>
  )
}

function MeaningMorphCascade() {
  const [targetWord, setTargetWord] = useState(CASCADE_WORDS[0] as string)
  const [settled, setSettled] = useState(false)

  useEffect(() => {
    let cancelled = false
    const run = async () => {
      for (let i = 1; i < CASCADE_WORDS.length; i++) {
        if (cancelled) return
        const progress = i / (CASCADE_WORDS.length - 1)
        // Fast at start (~180ms), decelerates to ~600ms
        const holdTime = 180 + progress * progress * 450

        setTargetWord(CASCADE_WORDS[i])

        if (i === CASCADE_WORDS.length - 1) {
          setSettled(true)
        }

        await new Promise(r => setTimeout(r, holdTime))
      }
    }

    run()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <span
      className={cn(
        'font-mono text-4xl tracking-wider transition-colors duration-300',
        settled
          ? 'font-medium text-neutral-900 dark:text-neutral-100'
          : 'font-light text-neutral-500 dark:text-neutral-400'
      )}
    >
      {Array.from({ length: CASCADE_MAX_LEN }, (_, i) => (
        <CascadeFlipChar key={i} target={targetWord[i] || ''} stagger={i} />
      ))}
    </span>
  )
}

function MeaningMorphCascadeLooped() {
  const key = useLoop(9000)
  return <MeaningMorphCascade key={key} />
}

// ─────────────────────────────────────────────
// #6 — Breathing Form
// Continuous sine-wave micro-transforms (already loops)
// ─────────────────────────────────────────────

function BreathingForm() {
  const [time, setTime] = useState(0)
  const rafRef = useRef<number>(0)

  useEffect(() => {
    const start = Date.now()
    const animate = () => {
      setTime((Date.now() - start) / 1000)
      rafRef.current = requestAnimationFrame(animate)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <span className="font-mono text-4xl font-light tracking-wider text-neutral-900 dark:text-neutral-100">
      {WORD.split('').map((char, i) => {
        const phase = i * 0.7
        const y = Math.sin(time * 1.5 + phase) * 1.5
        const scale = 1 + Math.sin(time * 1.2 + phase + 1) * 0.03
        const opacity = 0.7 + Math.sin(time * 1.8 + phase + 2) * 0.3

        return (
          <span
            key={i}
            className="inline-block"
            style={{
              transform: `translateY(${y}px) scale(${scale})`,
              opacity
            }}
          >
            {char}
          </span>
        )
      })}
    </span>
  )
}

// ─────────────────────────────────────────────
// #7 — User-Reactive
// Hover to disrupt, leave to settle (already interactive)
// ─────────────────────────────────────────────

function UserReactive() {
  const [letters, setLetters] = useState(WORD.split(''))
  const [isHovering, setIsHovering] = useState(false)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startMorphing = () => {
    setIsHovering(true)
    intervalRef.current = setInterval(() => {
      setLetters(
        WORD.split('').map(char => (Math.random() > 0.5 ? randomChar() : char))
      )
    }, 80)
  }

  const stopMorphing = () => {
    setIsHovering(false)
    if (intervalRef.current) clearInterval(intervalRef.current)

    WORD.split('').forEach((char, i) => {
      setTimeout(() => {
        setLetters(prev => {
          const next = [...prev]
          next[i] = char
          return next
        })
      }, i * 60)
    })
  }

  return (
    <span
      className="cursor-pointer select-none font-mono text-4xl font-light tracking-wider text-neutral-900 dark:text-neutral-100"
      onMouseEnter={startMorphing}
      onMouseLeave={stopMorphing}
    >
      {letters.map((char, i) => (
        <span
          key={i}
          className={cn(
            'inline-block transition-all duration-100',
            isHovering &&
              char !== WORD[i] &&
              'text-neutral-400 dark:text-neutral-500'
          )}
        >
          {char}
        </span>
      ))}
      <span className="ml-4 text-sm text-neutral-400">
        {isHovering ? '(hover)' : '\u2190 hover me'}
      </span>
    </span>
  )
}

// ─────────────────────────────────────────────
// #8 — Wordmark Hover
// Matches real wordmark font. Static "polymorph",
// hover cycles through action words, leave settles back.
// ─────────────────────────────────────────────

const HOVER_WORDS = [
  'research',
  'create',
  'explore',
  'discover',
  'generate',
  'analyze',
  'imagine',
  'transform',
  'design',
  'build'
] as const

function WordmarkHover() {
  const [currentWord, setCurrentWord] = useState(WORD)
  const [nextWord, setNextWord] = useState(WORD)
  const [wavePos, setWavePos] = useState(-1)
  const [isWaving, setIsWaving] = useState(false)
  const [isHovering, setIsHovering] = useState(false)
  const wordIndexRef = useRef(0)
  const cycleRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const waveRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const maxLen = Math.max(WORD.length, ...HOVER_WORDS.map(w => w.length))

  const waveTo = useCallback(
    (target: string, onDone?: () => void) => {
      // Stop any in-flight wave
      if (waveRef.current) clearInterval(waveRef.current)

      setNextWord(target)
      setIsWaving(true)

      let pos = -1
      waveRef.current = setInterval(() => {
        pos++
        setWavePos(pos)
        if (pos > maxLen + 1) {
          if (waveRef.current) clearInterval(waveRef.current)
          waveRef.current = null
          setIsWaving(false)
          setWavePos(-1)
          setCurrentWord(target)
          setNextWord(target)
          onDone?.()
        }
      }, 40)
    },
    [maxLen]
  )

  const startCycling = useCallback(() => {
    wordIndexRef.current = 0

    const cycle = () => {
      const word = HOVER_WORDS[wordIndexRef.current] as string
      wordIndexRef.current = (wordIndexRef.current + 1) % HOVER_WORDS.length
      waveTo(word, () => {
        cycleRef.current = setTimeout(cycle, 400)
      })
    }

    cycle()
  }, [waveTo])

  const handleEnter = useCallback(() => {
    setIsHovering(true)
    startCycling()
  }, [startCycling])

  const handleLeave = useCallback(() => {
    setIsHovering(false)

    if (cycleRef.current) clearTimeout(cycleRef.current)
    cycleRef.current = null
    if (waveRef.current) clearInterval(waveRef.current)
    waveRef.current = null

    // Wave back to polymorph
    waveTo(WORD)
  }, [waveTo])

  useEffect(() => {
    return () => {
      if (cycleRef.current) clearTimeout(cycleRef.current)
      if (waveRef.current) clearInterval(waveRef.current)
    }
  }, [])

  return (
    <div className="flex flex-col items-center gap-3">
      <span
        className="cursor-pointer select-none text-[2.5rem] leading-none font-medium tracking-[0.08em]"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {Array.from({ length: maxLen }, (_, i) => {
          const isPast = isWaving && i < wavePos
          const isAtWave = isWaving && (i === wavePos || i === wavePos - 1)
          const char =
            isPast || (isWaving && i <= wavePos)
              ? nextWord[i] || ''
              : currentWord[i] || ''

          return (
            <span
              key={i}
              className={cn(
                'inline-block transition-all duration-75 text-neutral-900 dark:text-neutral-100',
                isAtWave && 'scale-105 opacity-50'
              )}
            >
              {char || '\u00A0'}
            </span>
          )
        })}
      </span>
      <span className="text-xs tracking-widest text-neutral-400">
        {isHovering ? '\u00A0' : 'hover to explore'}
      </span>
    </div>
  )
}

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────

export default function MorphDemoPage() {
  return (
    <div className="h-full overflow-y-auto bg-neutral-50 px-4 py-12 dark:bg-neutral-900 sm:px-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-12">
          <h1 className="mb-2 text-2xl font-bold text-neutral-900 dark:text-neutral-100">
            Morph Concepts
          </h1>
          <p className="text-sm text-neutral-500">
            Seven approaches to animating the &ldquo;polymorph&rdquo; wordmark.
            All effects loop continuously.
          </p>
        </div>

        <div className="grid gap-6 pb-12">
          <DemoCard
            number={1}
            title="The Restless Word"
            description="Chaotic on load, settles into form. Occasional idle twitches — the word itself is polymorphic."
          >
            <RestlessWordLooped />
          </DemoCard>

          <DemoCard
            number={2}
            title="Etymological Descent"
            description="πολύμορφος morphs character-by-character into its modern form."
          >
            <EtymologicalDescentLooped />
          </DemoCard>

          <DemoCard
            number={3}
            title="The Quiet Anagram"
            description={
              '"romp holy" rearranges into "polymorph" — the word transforms itself.'
            }
          >
            <QuietAnagramLooped />
          </DemoCard>

          <DemoCard
            number={4}
            title="Convergence from Chaos"
            description="Slot-machine cycling, each letter locking in left to right with satisfying precision."
          >
            <ConvergenceFromChaosLooped />
          </DemoCard>

          <DemoCard
            number={5}
            title="5a · Meaning Morph: L→R Resolve"
            description="Characters resolve left-to-right through noise. The original #5."
          >
            <MeaningMorph />
          </DemoCard>

          <DemoCard
            number={5}
            title="5b · Meaning Morph: Typewriter"
            description="Backspace the current word, type the next. Terminal aesthetic."
          >
            <MeaningMorphTypewriter />
          </DemoCard>

          <DemoCard
            number={5}
            title="5c · Meaning Morph: Departure Board"
            description="Each character slot flips through the alphabet independently, like an airport board."
          >
            <MeaningMorphDepartureBoard />
          </DemoCard>

          <DemoCard
            number={5}
            title="5d · Meaning Morph: Wave Sweep"
            description="A colored wave passes left to right, revealing the next word behind it."
          >
            <MeaningMorphWave />
          </DemoCard>

          <DemoCard
            number={5}
            title="5e · Meaning Morph: Random Settle"
            description="All characters scramble simultaneously. Each finds its target at a random, independent moment."
          >
            <MeaningMorphRandomSettle />
          </DemoCard>

          <DemoCard
            number={5}
            title="5f · Meaning Morph: Rapid Cascade"
            description="Flicks through action words fast, decelerates, and settles on &ldquo;polymorph&rdquo;."
          >
            <MeaningMorphCascadeLooped />
          </DemoCard>

          <DemoCard
            number={6}
            title="Breathing Form"
            description="Continuous subtle sine-wave animation — each letter gently breathes at offset phases."
          >
            <BreathingForm />
          </DemoCard>

          <DemoCard
            number={7}
            title="User-Reactive"
            description="Hover to disrupt. Leave to settle. The UI responds to your presence."
          >
            <UserReactive />
          </DemoCard>

          <DemoCard
            number={8}
            title="Wordmark Hover"
            description="Matches the real wordmark style. Static &ldquo;polymorph&rdquo; — hover to cycle through action words, leave to settle back."
          >
            <WordmarkHover />
          </DemoCard>
        </div>
      </div>
    </div>
  )
}

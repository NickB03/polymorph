'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'

import { Bookmark, X } from 'lucide-react'

const SEARCH_COUNT_KEY = 'polymorph-guest-search-count'
const NUDGE_DISMISSED_KEY = 'polymorph-guest-nudge-dismissed'
const NUDGE_THRESHOLD = 5

export function GuestSignupNudge() {
  const [visible, setVisible] = useState(false)
  const hasIncremented = useRef(false)

  useEffect(() => {
    if (hasIncremented.current) return
    hasIncremented.current = true

    if (localStorage.getItem(NUDGE_DISMISSED_KEY)) return

    const count = Number(localStorage.getItem(SEARCH_COUNT_KEY) || '0') + 1
    localStorage.setItem(SEARCH_COUNT_KEY, String(count))

    if (count >= NUDGE_THRESHOLD) {
      setVisible(true)
    }
  }, [])

  if (!visible) return null

  return (
    <div className="my-3 flex items-center gap-2 rounded-lg bg-muted/50 px-3 py-2 text-xs text-muted-foreground">
      <Bookmark className="size-3.5 shrink-0" />
      <span>
        <Link
          href="/auth/sign-up"
          className="underline underline-offset-2 hover:text-foreground"
        >
          Sign up
        </Link>{' '}
        to save your searches and get unlimited access
      </span>
      <button
        type="button"
        onClick={() => {
          localStorage.setItem(NUDGE_DISMISSED_KEY, '1')
          setVisible(false)
        }}
        className="ml-auto shrink-0 rounded p-0.5 hover:bg-muted hover:text-foreground"
        aria-label="Dismiss"
      >
        <X className="size-3" />
      </button>
    </div>
  )
}

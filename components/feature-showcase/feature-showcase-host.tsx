'use client'

import { useEffect, useState } from 'react'

import { FeatureShowcase } from './feature-showcase'

const STORAGE_KEY = 'polymorph-showcase-seen'

function detectFirstVisit(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === null
  } catch {
    // Private browsing or storage disabled — treat as NOT a first visit so the showcase stays hidden.
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ seen: true, timestamp: Date.now() })
    )
  } catch {
    // Silently ignore — best-effort persistence.
  }
}

export function FeatureShowcaseHost() {
  const [mounted, setMounted] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- canonical client-mount gate; runs exactly once after first paint to enable localStorage reads safely
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!mounted) return
    // eslint-disable-next-line react-hooks/set-state-in-effect -- opens modal on first visit after the mount gate confirms localStorage is available
    if (detectFirstVisit()) setOpen(true)
  }, [mounted])

  if (!mounted) return null

  return (
    <FeatureShowcase
      open={open}
      onOpenChange={next => {
        setOpen(next)
        if (!next) markSeen()
      }}
    />
  )
}

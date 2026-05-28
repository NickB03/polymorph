'use client'

import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

const storageKey = 'polymorph:new-user-demo:v1'
const reducedMotionQuery = '(prefers-reduced-motion: reduce)'

type NewUserDemoPopupProps = {
  enabled: boolean
  onStart?: () => void
}

function hasDismissedDemo() {
  if (typeof window === 'undefined') {
    return true
  }

  try {
    return window.localStorage.getItem(storageKey) !== null
  } catch {
    return true
  }
}

function persistDismissal() {
  if (typeof window === 'undefined') {
    return
  }

  try {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ dismissedAt: new Date().toISOString() })
    )
  } catch {
    // Storage can be disabled in private or hardened browser contexts.
  }
}

function shouldAutoplayVideo() {
  if (typeof window === 'undefined') {
    return false
  }

  if (typeof window.matchMedia !== 'function') {
    return false
  }

  return !window.matchMedia(reducedMotionQuery).matches
}

export function NewUserDemoPopup({ enabled, onStart }: NewUserDemoPopupProps) {
  const [open, setOpen] = React.useState(false)
  const [autoPlay, setAutoPlay] = React.useState(false)

  React.useEffect(() => {
    let active = true

    queueMicrotask(() => {
      if (!active) {
        return
      }

      if (!enabled || hasDismissedDemo()) {
        setOpen(false)
        return
      }

      setAutoPlay(shouldAutoplayVideo())
      setOpen(true)
    })

    return () => {
      active = false
    }
  }, [enabled])

  const dismiss = React.useCallback(() => {
    persistDismissal()
    setOpen(false)
  }, [])

  const handleStart = React.useCallback(() => {
    dismiss()
    onStart?.()
  }, [dismiss, onStart])

  const setVideoRef = React.useCallback((element: HTMLVideoElement | null) => {
    element?.setAttribute('muted', '')
  }, [])

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          dismiss()
        }
      }}
    >
      <DialogContent className="max-w-2xl gap-5 border-border bg-background p-4 sm:p-5">
        <DialogHeader className="space-y-2 pr-8">
          <DialogTitle className="text-base sm:text-lg">
            Watch Polymorph in motion
          </DialogTitle>
          <DialogDescription>
            See how the workspace turns research into interactive outputs.
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-hidden rounded-xl border border-border bg-muted">
          <video
            ref={setVideoRef}
            title="Polymorph demo video"
            src="/demos/polymorph-demo.mp4"
            controls
            muted
            playsInline
            preload="metadata"
            autoPlay={autoPlay}
            className="block aspect-video w-full bg-background"
          />
        </div>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button type="button" variant="ghost" onClick={dismiss}>
            Skip
          </Button>
          <Button type="button" onClick={handleStart}>
            Start exploring
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

'use client'

import * as React from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'

const storageKey = 'polymorph:new-user-demo:v1'

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

export function NewUserDemoPopup({ enabled, onStart }: NewUserDemoPopupProps) {
  const [open, setOpen] = React.useState(false)

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

      setOpen(true)
    })

    return () => {
      active = false
    }
  }, [enabled])

  const dismiss = React.useCallback(() => {
    persistDismissal()
    setOpen(false)
    onStart?.()
  }, [onStart])

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
      <DialogContent className="max-w-5xl gap-0 border-border bg-background p-0 sm:p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Watch Polymorph in motion</DialogTitle>
          <DialogDescription>
            See how the workspace turns research into interactive outputs.
          </DialogDescription>
        </DialogHeader>

        <video
          ref={setVideoRef}
          title="Polymorph demo video"
          src="/demos/polymorph-demo.mp4"
          muted
          playsInline
          autoPlay
          preload="auto"
          className="block aspect-video w-full rounded-lg bg-background"
        />
      </DialogContent>
    </Dialog>
  )
}

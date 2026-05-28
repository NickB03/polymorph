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
  const [progress, setProgress] = React.useState(0)

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

  const handleTimeUpdate = React.useCallback(
    (event: React.SyntheticEvent<HTMLVideoElement>) => {
      const video = event.currentTarget
      if (!video.duration || !Number.isFinite(video.duration)) {
        return
      }
      setProgress(Math.min(1, Math.max(0, video.currentTime / video.duration)))
    },
    []
  )

  const handleVideoClick = React.useCallback(
    (event: React.MouseEvent<HTMLVideoElement>) => {
      const video = event.currentTarget
      if (video.paused || video.ended) {
        void video.play()
      } else {
        video.pause()
      }
    },
    []
  )

  return (
    <Dialog
      open={open}
      onOpenChange={nextOpen => {
        if (!nextOpen) {
          dismiss()
        }
      }}
    >
      <DialogContent
        onOpenAutoFocus={event => event.preventDefault()}
        className="max-w-5xl gap-0 border-border bg-background p-0 sm:p-0"
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Watch Polymorph in motion</DialogTitle>
          <DialogDescription>
            See how the workspace turns research into interactive outputs.
          </DialogDescription>
        </DialogHeader>

        <div className="relative aspect-[160/84] overflow-hidden rounded-lg">
          <video
            ref={setVideoRef}
            title="Polymorph demo video"
            src="/demos/polymorph-demo.mp4"
            muted
            playsInline
            autoPlay
            preload="auto"
            onTimeUpdate={handleTimeUpdate}
            onEnded={dismiss}
            onClick={handleVideoClick}
            className="block aspect-video w-full cursor-pointer bg-background"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-1 bg-white/15"
          >
            <div
              data-testid="demo-video-progress"
              className="h-full origin-left bg-accent-blue transition-transform duration-200 ease-linear"
              style={{ transform: `scaleX(${progress})` }}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

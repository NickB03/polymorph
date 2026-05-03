'use client'

import { useEffect } from 'react'

const APP_VIEWPORT_HEIGHT_VAR = '--app-visual-viewport-height'
const APP_KEYBOARD_INSET_VAR = '--app-keyboard-inset-height'

function toCssPixels(value: number) {
  return `${Math.max(0, Math.round(value * 100) / 100)}px`
}

export function VisualViewportHeight() {
  useEffect(() => {
    const root = document.documentElement
    const viewport = window.visualViewport

    const syncViewportHeight = () => {
      const layoutHeight = window.innerHeight
      const visibleHeight = viewport?.height ?? layoutHeight
      const offsetTop = viewport?.offsetTop ?? 0
      const keyboardInset = Math.max(0, layoutHeight - visibleHeight - offsetTop)

      root.style.setProperty(APP_VIEWPORT_HEIGHT_VAR, toCssPixels(visibleHeight))
      root.style.setProperty(APP_KEYBOARD_INSET_VAR, toCssPixels(keyboardInset))
    }

    syncViewportHeight()
    window.addEventListener('resize', syncViewportHeight)
    window.addEventListener('orientationchange', syncViewportHeight)
    viewport?.addEventListener('resize', syncViewportHeight)
    viewport?.addEventListener('scroll', syncViewportHeight)

    return () => {
      window.removeEventListener('resize', syncViewportHeight)
      window.removeEventListener('orientationchange', syncViewportHeight)
      viewport?.removeEventListener('resize', syncViewportHeight)
      viewport?.removeEventListener('scroll', syncViewportHeight)
    }
  }, [])

  return null
}

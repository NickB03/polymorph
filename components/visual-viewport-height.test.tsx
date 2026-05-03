import { render } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { VisualViewportHeight } from './visual-viewport-height'

type MockVisualViewport = Pick<
  VisualViewport,
  'height' | 'offsetTop' | 'addEventListener' | 'removeEventListener'
>

const originalVisualViewport = window.visualViewport
const originalInnerHeight = window.innerHeight

function installViewport(viewport: MockVisualViewport | null | undefined) {
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport
  })
}

function installInnerHeight(height: number) {
  Object.defineProperty(window, 'innerHeight', {
    configurable: true,
    value: height
  })
}

describe('VisualViewportHeight', () => {
  afterEach(() => {
    document.documentElement.style.removeProperty(
      '--app-visual-viewport-height'
    )
    document.documentElement.style.removeProperty('--app-keyboard-inset-height')
    installViewport(originalVisualViewport)
    installInnerHeight(originalInnerHeight)
    vi.restoreAllMocks()
  })

  it('syncs the app viewport height from visualViewport for soft keyboards', () => {
    const addEventListener = vi.fn()
    const removeEventListener = vi.fn()
    const handleKeyboardChange = vi.fn()
    installInnerHeight(844)
    installViewport({
      height: 512.5,
      offsetTop: 0,
      addEventListener,
      removeEventListener
    })
    window.addEventListener('app-soft-keyboard-change', handleKeyboardChange)

    const { unmount } = render(<VisualViewportHeight />)

    expect(document.documentElement).toHaveStyle({
      '--app-visual-viewport-height': '512.5px',
      '--app-keyboard-inset-height': '331.5px'
    })
    expect(document.documentElement).toHaveAttribute(
      'data-soft-keyboard',
      'open'
    )
    expect(handleKeyboardChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { open: true, keyboardInset: 331.5 }
      })
    )
    expect(addEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    )
    expect(addEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    )

    unmount()
    window.removeEventListener('app-soft-keyboard-change', handleKeyboardChange)

    expect(removeEventListener).toHaveBeenCalledWith(
      'resize',
      expect.any(Function)
    )
    expect(removeEventListener).toHaveBeenCalledWith(
      'scroll',
      expect.any(Function)
    )
  })

  it('falls back to window.innerHeight when visualViewport is unavailable', () => {
    const handleKeyboardChange = vi.fn()
    window.addEventListener('app-soft-keyboard-change', handleKeyboardChange)
    installInnerHeight(700)
    installViewport(undefined)

    render(<VisualViewportHeight />)

    expect(document.documentElement).toHaveStyle({
      '--app-visual-viewport-height': '700px',
      '--app-keyboard-inset-height': '0px'
    })
    expect(document.documentElement).not.toHaveAttribute('data-soft-keyboard')
    expect(handleKeyboardChange).toHaveBeenCalledWith(
      expect.objectContaining({
        detail: { open: false, keyboardInset: 0 }
      })
    )
    window.removeEventListener('app-soft-keyboard-change', handleKeyboardChange)
  })
})

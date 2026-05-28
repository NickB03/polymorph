import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { NewUserDemoPopup } from './new-user-demo-popup'

const storageKey = 'polymorph:new-user-demo:v1'

function createTestStorage(): Storage {
  const store = new Map<string, string>()

  return {
    get length() {
      return store.size
    },
    clear() {
      store.clear()
    },
    getItem(key) {
      return store.get(key) ?? null
    },
    key(index) {
      return Array.from(store.keys())[index] ?? null
    },
    removeItem(key) {
      store.delete(key)
    },
    setItem(key, value) {
      store.set(key, value)
    }
  }
}

beforeEach(() => {
  vi.restoreAllMocks()
  const storage = createTestStorage()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: storage
  })
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: storage
  })
  window.localStorage.clear()
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
})

describe('NewUserDemoPopup', () => {
  it('does not render when disabled', () => {
    render(<NewUserDemoPopup enabled={false} />)

    expect(
      screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
    ).not.toBeInTheDocument()
  })

  it('opens for eligible first-run users and renders the demo video', async () => {
    render(<NewUserDemoPopup enabled />)

    expect(
      await screen.findByRole('dialog', { name: /watch polymorph in motion/i })
    ).toBeInTheDocument()

    const video = screen.getByTitle('Polymorph demo video')
    expect(video).toHaveAttribute('src', '/demos/polymorph-demo.mp4')
    expect(video).toHaveAttribute('controls')
    expect(video).toHaveAttribute('muted')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('autoplay')
  })

  it('does not autoplay when reduced motion is preferred', async () => {
    vi.mocked(window.matchMedia).mockImplementation((query: string) => ({
      matches: query === '(prefers-reduced-motion: reduce)',
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))

    render(<NewUserDemoPopup enabled />)

    const video = await screen.findByTitle('Polymorph demo video')
    expect(video).not.toHaveAttribute('autoplay')
  })

  it('persists dismissal when skipped', async () => {
    render(<NewUserDemoPopup enabled />)

    fireEvent.click(await screen.findByRole('button', { name: /skip/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
      ).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(storageKey)).toContain('dismissedAt')
  })

  it('stays hidden when already dismissed', () => {
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({ dismissedAt: 'now' })
    )

    render(<NewUserDemoPopup enabled />)

    expect(
      screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
    ).not.toBeInTheDocument()
  })

  it('runs the primary action before closing', async () => {
    const onStart = vi.fn()
    render(<NewUserDemoPopup enabled onStart={onStart} />)

    fireEvent.click(
      await screen.findByRole('button', { name: /start exploring/i })
    )

    expect(onStart).toHaveBeenCalledTimes(1)
    expect(window.localStorage.getItem(storageKey)).toContain('dismissedAt')
  })
})

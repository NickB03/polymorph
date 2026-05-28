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

  it('opens for eligible first-run users and autoplays the demo video without native controls', async () => {
    render(<NewUserDemoPopup enabled />)

    expect(
      await screen.findByRole('dialog', { name: /watch polymorph in motion/i })
    ).toBeInTheDocument()

    const video = screen.getByTitle('Polymorph demo video')
    expect(video).toHaveAttribute('src', '/demos/polymorph-demo.mp4')
    expect(video).not.toHaveAttribute('controls')
    expect(video).toHaveAttribute('muted')
    expect(video).toHaveAttribute('playsinline')
    expect(video).toHaveAttribute('autoplay')
  })

  it('autoplays regardless of reduced-motion preference', async () => {
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
    expect(video).toHaveAttribute('autoplay')
  })

  it('persists dismissal and fires onStart when closed via the X button', async () => {
    const onStart = vi.fn()
    render(<NewUserDemoPopup enabled onStart={onStart} />)

    fireEvent.click(await screen.findByRole('button', { name: /close/i }))

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
      ).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(storageKey)).toContain('dismissedAt')
    expect(onStart).toHaveBeenCalledTimes(1)
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

  it('reflects video playback progress in the progress bar', async () => {
    render(<NewUserDemoPopup enabled />)

    const video = (await screen.findByTitle(
      'Polymorph demo video'
    )) as HTMLVideoElement
    Object.defineProperty(video, 'duration', { configurable: true, value: 60 })
    Object.defineProperty(video, 'currentTime', {
      configurable: true,
      value: 15
    })

    fireEvent.timeUpdate(video)

    const fill = screen.getByTestId('demo-video-progress')
    expect(fill).toHaveStyle({ transform: 'scaleX(0.25)' })
  })

  it('auto-closes and persists dismissal when the video ends', async () => {
    const onStart = vi.fn()
    render(<NewUserDemoPopup enabled onStart={onStart} />)

    const video = await screen.findByTitle('Polymorph demo video')
    fireEvent.ended(video)

    await waitFor(() => {
      expect(
        screen.queryByRole('dialog', { name: /watch polymorph in motion/i })
      ).not.toBeInTheDocument()
    })
    expect(window.localStorage.getItem(storageKey)).toContain('dismissedAt')
    expect(onStart).toHaveBeenCalledTimes(1)
  })
})

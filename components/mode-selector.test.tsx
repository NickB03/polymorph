import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { UserMode } from '@/lib/types/search'

const {
  getCookieMock,
  mapSearchModeCookieValueMock,
  readSearchModeCookieMock,
  syncSearchModeMock
} = vi.hoisted(() => ({
  getCookieMock: vi.fn((_: string): string | null => null),
  mapSearchModeCookieValueMock: vi.fn(
    (_: string | null | undefined): UserMode => 'search'
  ),
  readSearchModeCookieMock: vi.fn((): UserMode => 'search'),
  syncSearchModeMock: vi.fn((_: UserMode): void => {})
}))

vi.mock('@/lib/utils/cookies', () => ({
  getCookie: getCookieMock
}))

vi.mock('@/lib/utils/search-mode', () => ({
  mapSearchModeCookieValue: mapSearchModeCookieValueMock,
  readSearchModeCookie: readSearchModeCookieMock,
  syncSearchMode: syncSearchModeMock
}))

vi.mock('@/components/motion/pill-presence', () => ({
  PillPresence: ({ children }: { children: React.ReactNode }) => <>{children}</>
}))

vi.mock('./ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick
  }: {
    children: React.ReactNode
    onClick?: () => void
  }) => <button onClick={onClick}>{children}</button>
}))

import { ModeSelector } from './mode-selector'

describe('ModeSelector', () => {
  it('uses a stable trigger id for the default trigger', () => {
    render(<ModeSelector />)

    expect(
      screen.getByRole('button', { name: 'Open mode menu' })
    ).toHaveAttribute('id', 'mode-selector-trigger')
  })

  it('keeps the same trigger id after hydrating an active mode from the cookie', async () => {
    getCookieMock.mockReturnValueOnce('research')
    mapSearchModeCookieValueMock.mockReturnValueOnce('research')

    render(<ModeSelector />)

    await waitFor(() => {
      expect(
        screen.getByRole('button', {
          name: 'Mode: Research. Open mode menu'
        })
      ).toHaveAttribute('id', 'mode-selector-trigger')
    })
  })
})

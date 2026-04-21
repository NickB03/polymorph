import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/components/ui/dropdown-menu', () => ({
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuSub: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSubContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  )
}))

vi.mock('./external-link-items', () => ({
  ExternalLinkItems: () => <div>External links</div>
}))

vi.mock('./theme-menu-items', () => ({
  ThemeMenuItems: () => <div>Theme menu</div>
}))

import GuestMenu from './guest-menu'

describe('GuestMenu', () => {
  it('uses a stable trigger id for SSR hydration', () => {
    render(<GuestMenu />)

    expect(screen.getByRole('button', { name: 'Open menu' })).toHaveAttribute(
      'id',
      'guest-menu-trigger'
    )
  })
})

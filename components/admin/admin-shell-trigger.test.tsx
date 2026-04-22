import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockUseSidebar = vi.hoisted(() => vi.fn())

vi.mock('@/components/ui/sidebar', () => ({
  SidebarTrigger: ({ className }: { className?: string }) => (
    <button data-testid="admin-shell-trigger" className={className}>
      Toggle Sidebar
    </button>
  ),
  useSidebar: mockUseSidebar
}))

import { AdminShellTrigger } from './admin-shell-trigger'

describe('AdminShellTrigger', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows a trigger when the shared sidebar state is collapsed', () => {
    mockUseSidebar.mockReturnValue({ open: false, isMobile: false })

    render(<AdminShellTrigger />)

    expect(screen.getByTestId('admin-shell-trigger')).toBeInTheDocument()
  })

  it('hides the trigger when the desktop sidebar is already open', () => {
    mockUseSidebar.mockReturnValue({ open: true, isMobile: false })

    render(<AdminShellTrigger />)

    expect(screen.queryByTestId('admin-shell-trigger')).not.toBeInTheDocument()
  })

  it('shows the trigger on mobile', () => {
    mockUseSidebar.mockReturnValue({ open: true, isMobile: true })

    render(<AdminShellTrigger />)

    expect(screen.getByTestId('admin-shell-trigger')).toBeInTheDocument()
  })
})

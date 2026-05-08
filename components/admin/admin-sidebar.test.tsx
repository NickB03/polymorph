import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SidebarProvider } from '@/components/ui/sidebar'

import { AdminSidebar } from './admin-sidebar'

const mockUsePathname = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', async () => {
  const actual =
    await vi.importActual<typeof import('next/navigation')>('next/navigation')
  return { ...actual, usePathname: mockUsePathname }
})

if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn()
    }))
  })
}

function renderInProvider(ui: React.ReactElement) {
  return render(<SidebarProvider defaultOpen>{ui}</SidebarProvider>)
}

describe('AdminSidebar', () => {
  it('renders only the enabled admin nav items', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    expect(screen.getByRole('link', { name: /evals/i })).toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /users/i })
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('link', { name: /usage/i })
    ).not.toBeInTheDocument()
    expect(screen.queryByText(/feedback/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^traffic$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/flags/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/settings/i)).not.toBeInTheDocument()
  })

  it('does not render a back-to-chat link', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    expect(
      screen.queryByRole('link', { name: /back to chat/i })
    ).not.toBeInTheDocument()
  })

  it('marks the nav item matching the current pathname as active', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    const evalsLink = screen.getByRole('link', { name: /evals/i })
    expect(evalsLink).toHaveAttribute('data-active', 'true')
  })

  it('shows the Polymorph Admin header', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    expect(screen.getByText(/polymorph admin/i)).toBeInTheDocument()
  })
})

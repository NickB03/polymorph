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
  it('renders all admin nav items', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    expect(screen.getByRole('link', { name: /evals/i })).toBeInTheDocument()
    expect(screen.getByText(/feedback/i)).toBeInTheDocument()
    expect(screen.getByText(/traffic/i)).toBeInTheDocument()
    expect(screen.getByText(/users/i)).toBeInTheDocument()
    expect(screen.getByText(/flags/i)).toBeInTheDocument()
    expect(screen.getByText(/settings/i)).toBeInTheDocument()
  })

  it('renders a back-to-chat link at the top', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    const backLink = screen.getByRole('link', { name: /back to chat/i })
    expect(backLink).toHaveAttribute('href', '/')
  })

  it('marks the nav item matching the current pathname as active', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    const evalsLink = screen.getByRole('link', { name: /evals/i })
    expect(evalsLink).toHaveAttribute('data-active', 'true')
  })

  it('links the pm wordmark back to the home page', () => {
    mockUsePathname.mockReturnValue('/admin/evals')
    renderInProvider(<AdminSidebar />)

    const home = screen.getByRole('link', { name: /^pm$/i })
    expect(home).toHaveAttribute('href', '/')
  })
})

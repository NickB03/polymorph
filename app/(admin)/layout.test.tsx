import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

const mockRedirect = vi.hoisted(() => vi.fn())
const mockNotFound = vi.hoisted(() => vi.fn())
const mockGetCurrentUser = vi.hoisted(() => vi.fn())
const mockIsAdminUserId = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  redirect: mockRedirect,
  notFound: mockNotFound,
  usePathname: () => '/admin/evals'
}))

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: mockGetCurrentUser
}))

vi.mock('@/lib/auth/is-admin', () => ({
  isAdminUserId: mockIsAdminUserId
}))

vi.mock('@/components/admin/admin-sidebar', () => ({
  AdminSidebar: () => <aside data-testid="admin-sidebar" />
}))

vi.mock('@/components/ui/sidebar', () => ({
  SidebarProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="sidebar-provider">{children}</div>
  )
}))

describe('(admin) layout', () => {
  it('redirects logged-out users to /auth/login', async () => {
    mockGetCurrentUser.mockResolvedValue(null)

    const { default: AdminLayout } = await import('./layout')
    await AdminLayout({ children: <div>child</div> })

    expect(mockRedirect).toHaveBeenCalledWith('/auth/login')
  })

  it('returns 404 for non-admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'non-admin' })
    mockIsAdminUserId.mockReturnValue(false)

    const { default: AdminLayout } = await import('./layout')
    await AdminLayout({ children: <div>child</div> })

    expect(mockNotFound).toHaveBeenCalled()
  })

  it('renders the admin chrome and children for admin users', async () => {
    mockGetCurrentUser.mockResolvedValue({ id: 'admin-1' })
    mockIsAdminUserId.mockReturnValue(true)

    const { default: AdminLayout } = await import('./layout')
    const result = await AdminLayout({
      children: <div data-testid="admin-child">hello</div>
    })
    render(result as React.ReactElement)

    expect(screen.getByTestId('admin-sidebar')).toBeInTheDocument()
    expect(screen.getByTestId('admin-child')).toBeInTheDocument()
  })
})

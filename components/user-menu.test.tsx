import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}))

vi.mock('@/lib/actions/chat', () => ({
  clearChats: vi.fn()
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signOut: vi.fn()
    }
  })
}))

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
  DropdownMenuLabel: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  DropdownMenuSeparator: () => <hr />,
  DropdownMenuItem: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
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

vi.mock('@/components/ui/alert-dialog', () => ({
  AlertDialog: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTrigger: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogContent: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogHeader: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogTitle: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogDescription: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
  AlertDialogCancel: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  ),
  AlertDialogAction: ({ children }: { children: React.ReactNode }) => (
    <button>{children}</button>
  )
}))

vi.mock('./external-link-items', () => ({
  ExternalLinkItems: () => <div>External links</div>
}))

vi.mock('./theme-menu-items', () => ({
  ThemeMenuItems: () => <div>Theme menu</div>
}))

import UserMenu from './user-menu'

const user = {
  id: 'user-1',
  email: 'admin@example.com',
  user_metadata: { full_name: 'Admin User' }
} as const

describe('UserMenu', () => {
  it('uses a stable trigger id for SSR hydration', () => {
    render(<UserMenu user={user as never} isAdmin={false} />)

    expect(document.getElementById('user-menu-trigger')).toBeInTheDocument()
  })

  it('shows the admin section for the admin user', () => {
    render(<UserMenu user={user as never} isAdmin />)

    expect(screen.getByText('Admin')).toBeInTheDocument()
    expect(screen.getByText('Evals')).toBeInTheDocument()
  })

  it('hides the admin section for non-admin users', () => {
    render(<UserMenu user={user as never} isAdmin={false} />)

    expect(screen.queryByText('Admin')).not.toBeInTheDocument()
    expect(screen.queryByText('Evals')).not.toBeInTheDocument()
  })
})

import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPush = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())
const mockSearchParamGet = vi.hoisted(() => vi.fn())
const mockSignInWithPassword = vi.hoisted(() => vi.fn())
const mockSignInWithOAuth = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh
  }),
  useSearchParams: () => ({
    get: mockSearchParamGet
  })
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
      signInWithOAuth: mockSignInWithOAuth
    }
  })
}))

import { LoginForm } from './login-form'

describe('LoginForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParamGet.mockReturnValue(null)
    mockSignInWithPassword.mockResolvedValue({ error: null })
    mockSignInWithOAuth.mockResolvedValue({ error: null })
  })

  it('returns to the requested path after password login', async () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === 'next' ? '/admin/evals' : null
    )

    render(<LoginForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'admin@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'hunter2' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign In' }))

    await waitFor(() => {
      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'admin@example.com',
        password: 'hunter2'
      })
      expect(mockPush).toHaveBeenCalledWith('/admin/evals')
      expect(mockRefresh).toHaveBeenCalled()
    })
  })

  it('passes the requested path through the OAuth callback URL', async () => {
    mockSearchParamGet.mockImplementation((key: string) =>
      key === 'next' ? '/admin/evals?tab=traffic' : null
    )

    render(<LoginForm />)

    fireEvent.click(screen.getByRole('button', { name: 'Sign In with Google' }))

    await waitFor(() => {
      expect(mockSignInWithOAuth).toHaveBeenCalledWith({
        provider: 'google',
        options: {
          redirectTo: `${location.origin}/auth/oauth?next=%2Fadmin%2Fevals%3Ftab%3Dtraffic`
        }
      })
    })
  })
})

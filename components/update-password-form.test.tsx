import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPush = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())
const mockUpdateUser = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh
  })
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      updateUser: mockUpdateUser
    }
  })
}))

import { UpdatePasswordForm } from './update-password-form'

describe('UpdatePasswordForm a11y wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flags the password input and announces the error when update fails', async () => {
    mockUpdateUser.mockResolvedValue({
      error: new Error('Password too weak')
    })

    render(<UpdatePasswordForm />)

    fireEvent.change(screen.getByLabelText('New password'), {
      target: { value: 'short' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save new password' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('id', 'update-password-error')
    expect(alert).toHaveTextContent('Password too weak')

    const passwordInput = screen.getByLabelText('New password')
    expect(passwordInput).toHaveAttribute('aria-invalid', 'true')
    expect(passwordInput).toHaveAttribute(
      'aria-describedby',
      'update-password-error'
    )

    expect(mockPush).not.toHaveBeenCalled()
  })

  it('does not navigate or flag inputs in the resting state', () => {
    render(<UpdatePasswordForm />)

    const passwordInput = screen.getByLabelText('New password')
    expect(passwordInput).toHaveAttribute('aria-invalid', 'false')
    expect(passwordInput).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(mockPush).not.toHaveBeenCalled()
  })
})

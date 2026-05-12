import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockResetPasswordForEmail = vi.hoisted(() => vi.fn())

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      resetPasswordForEmail: mockResetPasswordForEmail
    }
  })
}))

import { ForgotPasswordForm } from './forgot-password-form'

describe('ForgotPasswordForm a11y wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks the email input invalid and announces the error when reset fails', async () => {
    mockResetPasswordForEmail.mockResolvedValue({
      error: new Error('No such user')
    })

    render(<ForgotPasswordForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'unknown@example.com' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send reset email' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('id', 'forgot-password-error')
    expect(alert).toHaveTextContent('No such user')

    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toHaveAttribute('aria-invalid', 'true')
    expect(emailInput).toHaveAttribute(
      'aria-describedby',
      'forgot-password-error'
    )
  })

  it('does not mark inputs invalid before a submission attempt', () => {
    render(<ForgotPasswordForm />)

    const emailInput = screen.getByLabelText('Email')
    expect(emailInput).toHaveAttribute('aria-invalid', 'false')
    expect(emailInput).not.toHaveAttribute('aria-describedby')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

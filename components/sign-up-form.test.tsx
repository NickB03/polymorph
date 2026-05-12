import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPush = vi.hoisted(() => vi.fn())
const mockRefresh = vi.hoisted(() => vi.fn())
const mockSignUp = vi.hoisted(() => vi.fn())

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    refresh: mockRefresh
  })
}))

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => ({
    auth: {
      signUp: mockSignUp
    }
  })
}))

import { SignUpForm } from './sign-up-form'

describe('SignUpForm a11y wiring', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('flags inputs and surfaces an alert when passwords do not match', async () => {
    render(<SignUpForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'new@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'hunter2hunter2' }
    })
    fireEvent.change(screen.getByLabelText('Repeat Password'), {
      target: { value: 'mismatched' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveAttribute('id', 'signup-error')
    expect(alert).toHaveTextContent('Passwords do not match')

    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByLabelText('Email')).toHaveAttribute(
      'aria-describedby',
      'signup-error'
    )
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'aria-invalid',
      'true'
    )
    expect(screen.getByLabelText('Repeat Password')).toHaveAttribute(
      'aria-invalid',
      'true'
    )

    expect(mockSignUp).not.toHaveBeenCalled()
  })

  it('surfaces supabase signUp errors through the same alert', async () => {
    mockSignUp.mockResolvedValue({
      data: { session: null },
      error: new Error('Email already registered')
    })

    render(<SignUpForm />)

    fireEvent.change(screen.getByLabelText('Email'), {
      target: { value: 'taken@example.com' }
    })
    fireEvent.change(screen.getByLabelText('Password'), {
      target: { value: 'hunter2hunter2' }
    })
    fireEvent.change(screen.getByLabelText('Repeat Password'), {
      target: { value: 'hunter2hunter2' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Sign Up' }))

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Email already registered')
    await waitFor(() => {
      expect(screen.getByLabelText('Email')).toHaveAttribute(
        'aria-invalid',
        'true'
      )
    })
  })
})

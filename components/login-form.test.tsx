import { render } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() })
}))

import { LoginForm } from './login-form'

describe('LoginForm', () => {
  it('password row uses flex-wrap for narrow screen wrapping', () => {
    const { container } = render(<LoginForm />)
    const passwordLabel = container.querySelector('label[for="password"]')!
    const row = passwordLabel.parentElement as HTMLElement
    expect(row.className).toContain('flex-wrap')
  })
})

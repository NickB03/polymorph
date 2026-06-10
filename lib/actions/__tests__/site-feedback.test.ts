import { beforeEach, describe, expect, it, vi } from 'vitest'

const { withOptionalRLS, checkFeedbackLimit, headers } = vi.hoisted(() => ({
  withOptionalRLS: vi.fn(),
  checkFeedbackLimit: vi.fn(),
  headers: vi.fn()
}))

vi.mock('@/lib/db/with-rls', () => ({ withOptionalRLS }))
vi.mock('@/lib/rate-limit/feedback-limits', () => ({ checkFeedbackLimit }))
vi.mock('next/headers', () => ({ headers }))

import { submitFeedback } from '../site-feedback'

const validInput = {
  sentiment: 'positive' as const,
  message: 'Great app!',
  pageUrl: 'https://example.com/some/page'
}

describe('submitFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    headers.mockResolvedValue(new Headers({ 'user-agent': 'test-agent' }))
    checkFeedbackLimit.mockResolvedValue({
      allowed: true,
      remaining: 4,
      resetAt: 0,
      limit: 5
    })
    withOptionalRLS.mockResolvedValue(undefined)
  })

  it('inserts valid feedback', async () => {
    const result = await submitFeedback(validInput)
    expect(result.success).toBe(true)
    expect(withOptionalRLS).toHaveBeenCalled()
  })

  it('rejects an invalid sentiment without touching the DB', async () => {
    const result = await submitFeedback({
      ...validInput,
      sentiment: 'hostile' as never
    })
    expect(result).toEqual({ success: false, error: 'Invalid feedback' })
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })

  it('rejects an oversized message without touching the DB', async () => {
    const result = await submitFeedback({
      ...validInput,
      message: 'x'.repeat(4001)
    })
    expect(result).toEqual({ success: false, error: 'Invalid feedback' })
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })

  it('rejects an empty message', async () => {
    const result = await submitFeedback({ ...validInput, message: '   ' })
    expect(result).toEqual({ success: false, error: 'Invalid feedback' })
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })

  it('rejects a non-http(s) pageUrl without touching the DB', async () => {
    const result = await submitFeedback({
      ...validInput,
      pageUrl: 'javascript:alert(1)'
    })
    expect(result).toEqual({ success: false, error: 'Invalid feedback' })
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })

  it('returns an error when rate limited, without touching the DB', async () => {
    checkFeedbackLimit.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 60_000,
      limit: 5
    })
    const result = await submitFeedback(validInput)
    expect(result.success).toBe(false)
    expect(withOptionalRLS).not.toHaveBeenCalled()
  })
})

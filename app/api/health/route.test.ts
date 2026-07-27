import { NextRequest } from 'next/server'

import { afterEach, describe, expect, it, vi } from 'vitest'

const mockExecute = vi.fn()

vi.mock('@/lib/db', () => ({
  db: {
    execute: (...args: unknown[]) => mockExecute(...args)
  }
}))

import { GET } from './route'

function makeRequest(query = ''): NextRequest {
  return new NextRequest(`http://localhost/api/health${query}`)
}

afterEach(() => {
  vi.unstubAllEnvs()
  mockExecute.mockReset()
  delete globalThis.__polymorphTracingState
})

describe('GET /api/health', () => {
  it('includes tracing in the body for check=phoenix, reflecting the current global state', async () => {
    mockExecute.mockResolvedValue(undefined)
    globalThis.__polymorphTracingState = 'disabled-https'

    const response = await GET(makeRequest('?check=phoenix'))
    const body = await response.json()

    expect(body.tracing).toBe('disabled-https')
  })

  it('includes tracing in the body for check=all, reflecting the current global state', async () => {
    mockExecute.mockResolvedValue(undefined)
    globalThis.__polymorphTracingState = 'enabled'

    const response = await GET(makeRequest('?check=all'))
    const body = await response.json()

    expect(body.tracing).toBe('enabled')
  })

  it('omits tracing from the body when check is unset', async () => {
    mockExecute.mockResolvedValue(undefined)
    globalThis.__polymorphTracingState = 'enabled'

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(body).not.toHaveProperty('tracing')
  })

  it('omits tracing from the body for an unrecognized check value', async () => {
    mockExecute.mockResolvedValue(undefined)
    globalThis.__polymorphTracingState = 'enabled'

    const response = await GET(makeRequest('?check=db'))
    const body = await response.json()

    expect(body).not.toHaveProperty('tracing')
  })

  it('falls back to unknown when the global tracing state was never set', async () => {
    mockExecute.mockResolvedValue(undefined)

    const response = await GET(makeRequest('?check=phoenix'))
    const body = await response.json()

    expect(body.tracing).toBe('unknown')
  })
})

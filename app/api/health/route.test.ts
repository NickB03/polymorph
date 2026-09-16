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

  it('reports spanContent as recorded when masking is off', async () => {
    mockExecute.mockResolvedValue(undefined)

    const response = await GET(makeRequest('?check=phoenix'))
    const body = await response.json()

    expect(body.spanContent).toEqual({
      inputs: 'recorded',
      outputs: 'recorded'
    })
  })

  it('reports spanContent as masked when masking is on', async () => {
    mockExecute.mockResolvedValue(undefined)
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'true')
    vi.stubEnv('OPENINFERENCE_HIDE_OUTPUTS', 'true')

    const response = await GET(makeRequest('?check=all'))
    const body = await response.json()

    expect(body.spanContent).toEqual({ inputs: 'masked', outputs: 'masked' })
  })

  it('reports each masking flag independently', async () => {
    mockExecute.mockResolvedValue(undefined)
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'true')

    const response = await GET(makeRequest('?check=phoenix'))
    const body = await response.json()

    expect(body.spanContent).toEqual({
      inputs: 'masked',
      outputs: 'recorded'
    })
  })

  it('reports TRUE as recorded, because only lowercase true masks', async () => {
    mockExecute.mockResolvedValue(undefined)
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'TRUE')
    vi.stubEnv('OPENINFERENCE_HIDE_OUTPUTS', '1')

    const response = await GET(makeRequest('?check=phoenix'))
    const body = await response.json()

    expect(body.spanContent).toEqual({
      inputs: 'recorded',
      outputs: 'recorded'
    })
  })

  it('omits spanContent from the body when check is unset', async () => {
    mockExecute.mockResolvedValue(undefined)
    vi.stubEnv('OPENINFERENCE_HIDE_INPUTS', 'true')

    const response = await GET(makeRequest())
    const body = await response.json()

    expect(body).not.toHaveProperty('spanContent')
  })

  it('falls back to unknown when the global tracing state was never set', async () => {
    mockExecute.mockResolvedValue(undefined)

    const response = await GET(makeRequest('?check=phoenix'))
    const body = await response.json()

    expect(body.tracing).toBe('unknown')
  })
})

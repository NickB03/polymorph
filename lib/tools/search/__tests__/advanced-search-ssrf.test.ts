// @vitest-environment node
import { EventEmitter } from 'node:events'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  isSafeFetchTarget: vi.fn(),
  httpsGet: vi.fn()
}))

vi.mock('@/lib/utils/safe-url', () => ({
  isSafeFetchTarget: mocks.isSafeFetchTarget
}))
vi.mock('https', () => ({
  default: { Agent: class {}, get: mocks.httpsGet }
}))

import { fetchHtml } from '../advanced-search'

function respondWith(statusCode: number, headers: Record<string, string>) {
  mocks.httpsGet.mockImplementationOnce((_url, _options, callback) => {
    const res = Object.assign(new EventEmitter(), { statusCode, headers })
    callback(res)
    queueMicrotask(() => res.emit('end'))
    return { on: vi.fn(), setTimeout: vi.fn(), destroy: vi.fn() }
  })
}

beforeEach(() => {
  mocks.isSafeFetchTarget.mockReset()
  mocks.httpsGet.mockReset()
})

describe('fetchHtml SSRF guard', () => {
  it('refuses a non-public target without making a request', async () => {
    mocks.isSafeFetchTarget.mockResolvedValue(false)

    await expect(fetchHtml('https://10.0.0.5/admin')).rejects.toThrow(
      'non-public'
    )
    expect(mocks.httpsGet).not.toHaveBeenCalled()
  })

  it('refuses a redirect to a non-public target', async () => {
    mocks.isSafeFetchTarget
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false)
    respondWith(302, { location: 'https://169.254.169.254/latest/meta-data' })

    await expect(fetchHtml('https://example.com/')).rejects.toThrow(
      'non-public'
    )
    expect(mocks.httpsGet).toHaveBeenCalledTimes(1)
    expect(mocks.isSafeFetchTarget).toHaveBeenLastCalledWith(
      'https://169.254.169.254/latest/meta-data'
    )
  })
})

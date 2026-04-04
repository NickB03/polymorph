import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockCreateBrowserClient = vi.fn()
const mockFetch = vi.fn()

vi.mock('@supabase/ssr', () => ({
  createBrowserClient: mockCreateBrowserClient
}))

vi.mock('../config', () => ({
  config: {
    smokeEnabled: true,
    smokeCaseCount: 1,
    smokeTimeoutMs: 1000,
    appUrl: 'https://app.example.com',
    supabaseUrl: 'https://supabase.example.com',
    supabaseAnonKey: 'anon',
    seedUserEmail: 'seed@example.com',
    seedUserPassword: 'password'
  }
}))

vi.mock('../corpus', () => ({
  getSmoketestCases: vi.fn(() => [
    {
      id: 'smoke-basic',
      suite: 'smoke',
      conversation: [
        { role: 'user', parts: [{ type: 'text', text: 'hello' }] }
      ],
      searchMode: 'chat',
      modelType: 'speed',
      tags: ['smoke'],
      requiresTextAnswer: true,
      requiresCitations: false,
      allowsInteractiveOnly: true
    }
  ])
}))

globalThis.fetch = mockFetch as unknown as typeof fetch

describe('runSmokeSuite', () => {
  beforeEach(() => {
    mockCreateBrowserClient.mockReset()
    mockFetch.mockReset()
  })

  it('authenticates and posts a real smoke chat to the app', async () => {
    mockCreateBrowserClient.mockImplementation((_url, _key, options) => ({
      auth: {
        signInWithPassword: vi.fn(async () => {
          options.cookies.setAll([
            {
              name: 'sb-project-auth-token',
              value: 'session-cookie',
              options: {}
            }
          ])

          return { error: null }
        })
      }
    }))

    mockFetch.mockResolvedValueOnce(
      new Response('data: ok\n\n', {
        status: 200,
        headers: { 'content-type': 'text/event-stream' }
      })
    )

    const { runSmokeSuite } = await import('./smoke')
    await runSmokeSuite()

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const [url, init] = mockFetch.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://app.example.com/api/chat')
    expect(init.headers).toMatchObject({
      accept: 'text/event-stream',
      'content-type': 'application/json'
    })
    expect((init.headers as Record<string, string>).cookie).toContain(
      'sb-project-auth-token=session-cookie'
    )
    expect((init.headers as Record<string, string>).cookie).toContain(
      'searchMode=chat'
    )
    expect((init.headers as Record<string, string>).cookie).toContain(
      'modelType=speed'
    )
  })

  it('skips app calls when smoke auth fails', async () => {
    mockCreateBrowserClient.mockReturnValue({
      auth: {
        signInWithPassword: vi.fn(async () => ({
          error: { message: 'invalid credentials' }
        }))
      }
    })

    const { runSmokeSuite } = await import('./smoke')
    await runSmokeSuite()

    expect(mockFetch).not.toHaveBeenCalled()
  })
})

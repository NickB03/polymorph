import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockClient = vi.hoisted(() => ({ id: 'phoenix-client' }))
const mockCreateClient = vi.hoisted(() => vi.fn(() => mockClient))
const mockAddSessionAnnotation = vi.hoisted(() => vi.fn())

vi.mock('server-only', () => ({}))

vi.mock('@arizeai/phoenix-client', () => ({
  createClient: mockCreateClient
}))

vi.mock('@arizeai/phoenix-client/sessions', () => ({
  addSessionAnnotation: mockAddSessionAnnotation
}))

import { annotatePhoenixUserFeedback } from './phoenix-feedback'

describe('annotatePhoenixUserFeedback', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('does nothing when Phoenix is not configured', async () => {
    vi.stubEnv('PHOENIX_COLLECTOR_ENDPOINT', '')

    await annotatePhoenixUserFeedback({
      chatId: 'chat-1',
      messageId: 'msg-1',
      score: 1,
      metadata: null
    })

    expect(mockCreateClient).not.toHaveBeenCalled()
    expect(mockAddSessionAnnotation).not.toHaveBeenCalled()
  })

  it('writes user feedback as a Phoenix session annotation', async () => {
    vi.stubEnv(
      'PHOENIX_COLLECTOR_ENDPOINT',
      'https://phoenix.example.com/v1/traces'
    )
    vi.stubEnv('PHOENIX_API_KEY', 'phoenix-key')

    await annotatePhoenixUserFeedback({
      chatId: 'chat-1',
      messageId: 'msg-1',
      score: -1,
      metadata: {
        correlationId: 'corr-1',
        otelTraceId: 'otel-1',
        traceId: 'legacy-1'
      }
    })

    expect(mockCreateClient).toHaveBeenCalledWith({
      options: {
        baseUrl: 'https://phoenix.example.com',
        headers: {
          Authorization: 'Bearer phoenix-key'
        }
      }
    })
    expect(mockAddSessionAnnotation).toHaveBeenCalledWith({
      client: mockClient,
      sessionAnnotation: {
        sessionId: 'chat-1',
        name: 'user_feedback',
        annotatorKind: 'HUMAN',
        label: 'thumbs_down',
        score: -1,
        identifier: 'msg-1',
        metadata: {
          messageId: 'msg-1',
          correlationId: 'corr-1',
          otelTraceId: 'otel-1',
          legacyTraceId: 'legacy-1'
        }
      }
    })
  })
})

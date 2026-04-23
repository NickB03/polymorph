import { describe, expect, it, vi } from 'vitest'

import { validateJudgeCredentials } from './judge-config'
import { applyJudgeDefaults, JUDGE_DEFAULT_SETTINGS } from './judge-model'

describe('judge credential validation', () => {
  it('throws if JUDGE_API_KEY is missing', () => {
    expect(() =>
      validateJudgeCredentials({
        JUDGE_API_KEY: '',
        JUDGE_BASE_URL: 'https://openrouter.ai/api/v1',
        JUDGE_MODEL: 'google/gemini-3.1-flash-lite-preview'
      } as NodeJS.ProcessEnv)
    ).toThrow('JUDGE_API_KEY is required')
  })

  it('throws if JUDGE_BASE_URL is not a valid URL', () => {
    expect(() =>
      validateJudgeCredentials({
        JUDGE_API_KEY: 'test-key',
        JUDGE_BASE_URL: 'not-a-url'
      } as NodeJS.ProcessEnv)
    ).toThrow('JUDGE_BASE_URL')
  })

  it('passes with valid credentials', () => {
    expect(() =>
      validateJudgeCredentials({
        JUDGE_API_KEY: 'test-key',
        JUDGE_BASE_URL: 'https://openrouter.ai/api/v1',
        JUDGE_MODEL: 'google/gemini-3.1-flash-lite-preview'
      } as NodeJS.ProcessEnv)
    ).not.toThrow()
  })

  it('passes when JUDGE_BASE_URL is not set (uses default)', () => {
    expect(() =>
      validateJudgeCredentials({
        JUDGE_API_KEY: 'test-key'
      } as NodeJS.ProcessEnv)
    ).not.toThrow()
  })
})

describe('JUDGE_DEFAULT_SETTINGS', () => {
  it('forces temperature: 0 so scores are reproducible run-over-run', () => {
    expect(JUDGE_DEFAULT_SETTINGS.temperature).toBe(0)
  })

  it('pins topP: 1 so sampling cutoff does not shift with provider defaults', () => {
    expect(JUDGE_DEFAULT_SETTINGS.topP).toBe(1)
  })
})

describe('applyJudgeDefaults', () => {
  it('routes doGenerate through middleware that injects JUDGE_DEFAULT_SETTINGS', async () => {
    const doGenerate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: []
    })

    const fakeModel = {
      specificationVersion: 'v3' as const,
      modelId: 'fake-judge',
      provider: 'fake',
      supportedUrls: {},
      doGenerate,
      doStream: vi.fn()
    }

    const wrapped = applyJudgeDefaults(
      fakeModel as unknown as import('ai').LanguageModel
    )

    // Call the wrapped model's doGenerate with no temperature/topP set — the
    // middleware should fill in the judge defaults before delegating down.
    await (wrapped as unknown as { doGenerate: typeof doGenerate }).doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }]
    })

    expect(doGenerate).toHaveBeenCalledTimes(1)
    expect(doGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0, topP: 1 })
    )
  })

  it('does not overwrite an explicit caller-supplied temperature', async () => {
    const doGenerate = vi.fn().mockResolvedValue({
      content: [{ type: 'text', text: 'ok' }],
      finishReason: 'stop',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      warnings: []
    })

    const fakeModel = {
      specificationVersion: 'v3' as const,
      modelId: 'fake-judge',
      provider: 'fake',
      supportedUrls: {},
      doGenerate,
      doStream: vi.fn()
    }

    const wrapped = applyJudgeDefaults(
      fakeModel as unknown as import('ai').LanguageModel
    )

    await (wrapped as unknown as { doGenerate: typeof doGenerate }).doGenerate({
      prompt: [{ role: 'user', content: [{ type: 'text', text: 'hi' }] }],
      temperature: 0.7
    })

    expect(doGenerate).toHaveBeenCalledWith(
      expect.objectContaining({ temperature: 0.7 })
    )
  })
})

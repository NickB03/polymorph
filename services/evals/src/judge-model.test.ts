import { describe, expect, it, vi } from 'vitest'

import { validateJudgeCredentials } from './judge-config'

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

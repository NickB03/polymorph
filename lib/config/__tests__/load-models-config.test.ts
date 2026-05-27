import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadModelsConfigSync } from '../load-models-config'

// Both default and cloud profiles must enable OpenRouter reasoning streaming
// for interactive chat/research tiers and exclude reasoning entirely on
// non-interactive background calls. Without these the DeepSeek swap
// re-introduces the dual-"Thought" + freeze symptoms.
describe('loadModelsConfig — DeepSeek reasoning provider options', () => {
  const originalCloud = process.env.POLYMORPH_CLOUD_DEPLOYMENT
  const originalVana = process.env.VANA_CLOUD_DEPLOYMENT

  afterEach(() => {
    if (originalCloud === undefined) {
      delete process.env.POLYMORPH_CLOUD_DEPLOYMENT
    } else {
      process.env.POLYMORPH_CLOUD_DEPLOYMENT = originalCloud
    }
    if (originalVana === undefined) {
      delete process.env.VANA_CLOUD_DEPLOYMENT
    } else {
      process.env.VANA_CLOUD_DEPLOYMENT = originalVana
    }
  })

  describe.each([
    ['default profile', undefined],
    ['cloud profile', 'true']
  ] as const)('%s', (_label, cloudEnv) => {
    beforeEach(() => {
      if (cloudEnv) {
        process.env.POLYMORPH_CLOUD_DEPLOYMENT = cloudEnv
      } else {
        delete process.env.POLYMORPH_CLOUD_DEPLOYMENT
      }
      delete process.env.VANA_CLOUD_DEPLOYMENT
    })

    it('enables OpenRouter reasoning streaming with effort: low for speed tier', () => {
      const config = loadModelsConfigSync()
      for (const mode of ['chat', 'research'] as const) {
        const opts = (config.models.byMode[mode].speed as any).providerOptions
        expect(opts?.openrouter?.reasoning).toEqual({
          enabled: true,
          effort: 'low'
        })
      }
    })

    it('enables OpenRouter reasoning streaming with effort: medium for quality tier', () => {
      const config = loadModelsConfigSync()
      for (const mode of ['chat', 'research'] as const) {
        const opts = (config.models.byMode[mode].quality as any).providerOptions
        expect(opts?.openrouter?.reasoning).toEqual({
          enabled: true,
          effort: 'medium'
        })
      }
    })

    it('excludes reasoning on non-interactive background calls', () => {
      const config = loadModelsConfigSync()
      for (const key of ['relatedQuestions', 'trendingSuggestions'] as const) {
        const opts = (config.models[key] as any).providerOptions
        expect(opts?.openrouter?.reasoning?.exclude).toBe(true)
      }
    })
  })
})

import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { loadModelsConfigSync } from '../load-models-config'

// Both default and cloud profiles must enable OpenRouter reasoning streaming
// for interactive chat/research tiers. GLM-5.3 thinking cannot be disabled,
// so background calls pin the lowest effort and hide the reasoning output
// (`exclude` hides it; it does not skip the cost — effort: low does that).
describe('loadModelsConfig — GLM-5.3 reasoning provider options', () => {
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

    it('uses GLM-5.3-Flash with effort: low for the speed tier', () => {
      const config = loadModelsConfigSync()
      for (const mode of ['chat', 'research'] as const) {
        const model = config.models.byMode[mode].speed
        expect(model.id).toBe('z-ai/glm-5.3-flash')
        expect(model.providerId).toBe('openrouter')
        expect((model as any).providerOptions?.openrouter?.reasoning).toEqual({
          enabled: true,
          effort: 'low'
        })
      }
    })

    it('uses GLM-5.3 with effort: high for the quality tier', () => {
      const config = loadModelsConfigSync()
      for (const mode of ['chat', 'research'] as const) {
        const model = config.models.byMode[mode].quality
        expect(model.id).toBe('z-ai/glm-5.3')
        expect(model.providerId).toBe('openrouter')
        expect((model as any).providerOptions?.openrouter?.reasoning).toEqual({
          enabled: true,
          effort: 'high'
        })
      }
    })

    it('pins background calls to GLM-5.3-Flash at low effort, hidden reasoning, JSON-schema-capable hosts', () => {
      const config = loadModelsConfigSync()
      for (const key of ['relatedQuestions', 'trendingSuggestions'] as const) {
        const model = config.models[key]
        expect(model.id).toBe('z-ai/glm-5.3-flash')
        expect((model as any).providerOptions?.openrouter).toEqual({
          reasoning: { effort: 'low', exclude: true },
          provider: {
            only: [
              'together',
              'fireworks',
              'baseten',
              'parasail',
              'cloudflare',
              'friendli'
            ]
          }
        })
      }
    })
  })
})

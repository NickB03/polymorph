import { describe, expect, it } from 'vitest'

import { getImageModel, registryProviders } from '@/lib/utils/registry'

describe('provider registry', () => {
  // `createProviderRegistry` keys its compatibility handling off the
  // provider-level `specificationVersion`. A provider without it is wrapped in
  // the v2 shim, which double-wraps the v4 `finishReason` object and makes the
  // UI message stream's `finish` chunk fail client-side validation.
  // @openrouter/ai-sdk-provider 3.0.0 omits the field; lib/utils/registry.ts
  // patches it. This pins that every registered provider declares v4.
  it('every registered provider declares a v4 specificationVersion', () => {
    const entries = Object.entries(registryProviders)
    expect(entries.length).toBeGreaterThan(0)
    for (const [name, provider] of entries) {
      expect(
        (provider as { specificationVersion?: string }).specificationVersion,
        `provider "${name}" must declare specificationVersion 'v4'`
      ).toBe('v4')
    }
  })

  it('resolves Gateway image models and rejects ids without a provider prefix', () => {
    const model = getImageModel('gateway:meta/muse-image-1.0')
    expect((model as { modelId?: string }).modelId).toBe('meta/muse-image-1.0')
    expect(() => getImageModel('meta/muse-image-1.0')).toThrow(
      /expected "provider:model-id"/
    )
  })
})

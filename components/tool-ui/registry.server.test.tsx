// @vitest-environment node

import { describe, expect, it } from 'vitest'

describe('tool UI registry server import', () => {
  it('imports without evaluating browser-only geo map runtime on the server', async () => {
    await expect(import('./registry')).resolves.toMatchObject({
      tryRenderToolUIByName: expect.any(Function)
    })
  })
})

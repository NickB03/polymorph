import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/canvas/service', () => ({
  createCanvasArtifactFromSource: vi.fn(),
  updateCanvasArtifactDraftFromSource: vi.fn(),
  saveCanvasArtifactVersion: vi.fn(),
  loadCanvasArtifactState: vi.fn()
}))

vi.mock('@/lib/canvas/guest-token', () => ({
  refreshGuestCanvasToken: vi.fn()
}))

const modules = [
  [
    'display-option-list',
    () => import('@/lib/tools/display-option-list'),
    () => import('@/lib/tools/display-option-list/index')
  ],
  [
    'display-question-wizard',
    () => import('@/lib/tools/display-question-wizard'),
    () => import('@/lib/tools/display-question-wizard/index')
  ],
  [
    'display-citations',
    () => import('@/lib/tools/display-citations'),
    () => import('@/lib/tools/display-citations/index')
  ],
  [
    'display-link-preview',
    () => import('@/lib/tools/display-link-preview'),
    () => import('@/lib/tools/display-link-preview/index')
  ],
  [
    'generate-image',
    () => import('@/lib/tools/generate-image'),
    () => import('@/lib/tools/generate-image/index')
  ],
  [
    'update-canvas-artifact',
    () => import('@/lib/tools/update-canvas-artifact'),
    () => import('@/lib/tools/update-canvas-artifact/index')
  ],
  [
    'create-canvas-artifact',
    () => import('@/lib/tools/create-canvas-artifact'),
    () => import('@/lib/tools/create-canvas-artifact/index')
  ],
  [
    'read-canvas-artifact',
    () => import('@/lib/tools/read-canvas-artifact'),
    () => import('@/lib/tools/read-canvas-artifact/index')
  ]
] as const

function expectModuleContract(mod: unknown) {
  expect(mod).toEqual(
    expect.objectContaining({
      toolName: expect.any(String),
      inputSchema: expect.any(Object),
      outputSchema: expect.any(Object),
      serverTool: expect.anything()
    })
  )
}

describe('migrated tool module contracts', () => {
  it.each(modules)(
    '%s exposes a compatibility module contract',
    async (_name, load) => {
      const mod = await load()

      expectModuleContract(mod)
    }
  )

  it.each(modules)(
    '%s exposes a folder index module contract',
    async (_name, _load, loadFolder) => {
      const mod = await loadFolder()

      expectModuleContract(mod)
    }
  )
})

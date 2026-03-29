// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockEsbuildBuild = vi.fn()
const mockValidateCanvasSource = vi.fn()
const mockBuildTailwindCss = vi.fn()
const mockAssembleCanvasHtml = vi.fn()

vi.mock('esbuild', () => ({
  build: (...args: unknown[]) => mockEsbuildBuild(...args)
}))

vi.mock('../validation/validate-canvas-source', () => ({
  validateCanvasSource: (...args: unknown[]) =>
    mockValidateCanvasSource(...args)
}))

vi.mock('./build-tailwind-css', () => ({
  buildTailwindCss: (...args: unknown[]) => mockBuildTailwindCss(...args)
}))

vi.mock('./assemble-canvas-html', () => ({
  assembleCanvasHtml: (...args: unknown[]) => mockAssembleCanvasHtml(...args)
}))

import { compileCanvasArtifact } from './compile-canvas-artifact'

describe('compileCanvasArtifact progress reporting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockValidateCanvasSource.mockReturnValue({
      ok: true,
      diagnostics: [],
      externalDependencies: []
    })
    mockEsbuildBuild.mockResolvedValue({
      errors: [],
      outputFiles: [{ text: 'bundled-js' }]
    })
    mockBuildTailwindCss.mockResolvedValue('compiled-css')
    mockAssembleCanvasHtml.mockReturnValue('<html>compiled</html>')
  })

  it('emits ordered progress snapshots through a successful compile', async () => {
    const onProgress = vi.fn()

    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'export default function App() { return <div>Hello</div> }'
      },
      artifactId: 'art-1',
      onProgress
    })

    expect(result.ok).toBe(true)
    expect(onProgress).toHaveBeenCalledTimes(5)

    expect(onProgress.mock.calls[0][0]).toMatchObject({
      artifactId: 'art-1',
      steps: [
        { id: 'validate', status: 'in-progress' },
        { id: 'bundle', status: 'pending' },
        { id: 'tailwind', status: 'pending' },
        { id: 'assemble', status: 'pending' }
      ]
    })

    expect(onProgress.mock.calls[1][0].steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'validate', status: 'completed' }),
        expect.objectContaining({ id: 'bundle', status: 'in-progress' })
      ])
    )

    expect(onProgress.mock.calls[2][0].steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'bundle', status: 'completed' }),
        expect.objectContaining({ id: 'tailwind', status: 'in-progress' })
      ])
    )

    expect(onProgress.mock.calls[3][0].steps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: 'tailwind', status: 'completed' }),
        expect.objectContaining({ id: 'assemble', status: 'in-progress' })
      ])
    )

    expect(onProgress.mock.calls[4][0]).toMatchObject({
      artifactId: 'art-1',
      outcome: 'success',
      steps: [
        { id: 'validate', status: 'completed' },
        { id: 'bundle', status: 'completed' },
        { id: 'tailwind', status: 'completed' },
        { id: 'assemble', status: 'completed' }
      ]
    })
  })

  it('emits a failed validate step when source validation fails', async () => {
    mockValidateCanvasSource.mockReturnValue({
      ok: false,
      diagnostics: [{ severity: 'error', message: 'Bad source' }],
      externalDependencies: []
    })

    const onProgress = vi.fn()

    const result = await compileCanvasArtifact({
      source: {
        'App.tsx': 'broken'
      },
      artifactId: 'art-2',
      onProgress
    })

    expect(result.ok).toBe(false)
    expect(onProgress).toHaveBeenCalledTimes(2)
    expect(onProgress.mock.calls[1][0]).toMatchObject({
      artifactId: 'art-2',
      outcome: 'failed',
      errorMessage: 'Bad source',
      steps: [
        { id: 'validate', status: 'failed' },
        { id: 'bundle', status: 'pending' },
        { id: 'tailwind', status: 'pending' },
        { id: 'assemble', status: 'pending' }
      ]
    })
  })
})

import { describe, expect, it, vi } from 'vitest'

import { createCanvasEmitter } from './write-canvas-data'

function createMockWriter() {
  return { write: vi.fn() }
}

describe('createCanvasEmitter', () => {
  it('emitCanvasArtifact writes a persisted data-canvasArtifact part', () => {
    const writer = createMockWriter()
    const emitter = createCanvasEmitter(writer)

    emitter.emitCanvasArtifact({
      artifactId: 'art-1',
      chatId: 'chat-1',
      title: 'Test',
      status: 'ready',
      draftRevision: 1,
      currentVersionId: 'v-1'
    })

    expect(writer.write).toHaveBeenCalledTimes(1)
    const call = writer.write.mock.calls[0][0]
    expect(call.type).toBe('data-canvasArtifact')
    expect(call.data.artifactId).toBe('art-1')
    expect(call.data.status).toBe('ready')
    expect(call.transient).toBeUndefined()
  })

  it('emitCanvasArtifactStatus writes a persisted data-canvasArtifactStatus part', () => {
    const writer = createMockWriter()
    const emitter = createCanvasEmitter(writer)

    emitter.emitCanvasArtifactStatus({
      artifactId: 'art-1',
      chatId: 'chat-1',
      status: 'compiling',
      draftRevision: 2,
      currentVersionId: null,
      updatedAt: '2026-03-19T00:00:00.000Z'
    })

    expect(writer.write).toHaveBeenCalledTimes(1)
    const call = writer.write.mock.calls[0][0]
    expect(call.type).toBe('data-canvasArtifactStatus')
    expect(call.data.status).toBe('compiling')
    expect(call.data.updatedAt).toBe('2026-03-19T00:00:00.000Z')
    expect(call.transient).toBeUndefined()
  })

  it('emitCanvasArtifactEvent writes a transient data-canvasArtifactEvent part', () => {
    const writer = createMockWriter()
    const emitter = createCanvasEmitter(writer)

    emitter.emitCanvasArtifactEvent({
      artifactId: 'art-1',
      event: 'compile-progress',
      payload: {
        artifactId: 'art-1',
        title: 'Test',
        source: 'create',
        startedAt: '2026-03-28T22:00:00.000Z',
        steps: [
          {
            id: 'validate',
            label: 'Validating source',
            status: 'in-progress'
          },
          {
            id: 'bundle',
            label: 'Building React components',
            status: 'pending'
          },
          {
            id: 'tailwind',
            label: 'Compiling Tailwind styles',
            status: 'pending'
          },
          {
            id: 'assemble',
            label: 'Bundling output',
            status: 'pending'
          }
        ]
      }
    })

    expect(writer.write).toHaveBeenCalledTimes(1)
    const call = writer.write.mock.calls[0][0]
    expect(call.type).toBe('data-canvasArtifactEvent')
    expect(call.transient).toBe(true)
    expect(call.data.event).toBe('compile-progress')
  })

  it('emitCanvasDiagnostics writes a transient data-canvasDiagnostics part', () => {
    const writer = createMockWriter()
    const emitter = createCanvasEmitter(writer)

    emitter.emitCanvasDiagnostics({
      artifactId: 'art-1',
      diagnostics: [{ severity: 'error', message: 'boom' }]
    })

    expect(writer.write).toHaveBeenCalledTimes(1)
    const call = writer.write.mock.calls[0][0]
    expect(call.type).toBe('data-canvasDiagnostics')
    expect(call.transient).toBe(true)
    expect(call.data.diagnostics).toHaveLength(1)
    expect(call.data.diagnostics[0].message).toBe('boom')
  })

  it('emits persisted canvas artifact state and ephemeral diagnostics', () => {
    const writer = createMockWriter()
    const emitter = createCanvasEmitter(writer)

    emitter.emitCanvasArtifact({
      artifactId: 'artifact-1',
      chatId: 'chat-1',
      title: 'Test',
      status: 'ready',
      draftRevision: 1,
      currentVersionId: null
    })
    emitter.emitCanvasDiagnostics({
      artifactId: 'artifact-1',
      diagnostics: [{ severity: 'error', message: 'boom' }]
    })

    expect(writer.write.mock.calls[0][0].type).toBe('data-canvasArtifact')
    expect(writer.write.mock.calls[1][0].type).toBe('data-canvasDiagnostics')
    expect(writer.write.mock.calls[1][0].transient).toBe(true)
  })

  it('emitCanvasArtifactStatus includes guestCanvasToken when provided', () => {
    const writer = createMockWriter()
    const emitter = createCanvasEmitter(writer)

    emitter.emitCanvasArtifactStatus({
      artifactId: 'art-1',
      chatId: 'chat-1',
      status: 'ready',
      draftRevision: 1,
      currentVersionId: 'v-1',
      updatedAt: '2026-03-19T00:00:00.000Z',
      guestCanvasToken: 'token-abc'
    })

    const call = writer.write.mock.calls[0][0]
    expect(call.data.guestCanvasToken).toBe('token-abc')
  })
})

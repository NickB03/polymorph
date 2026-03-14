import { describe, expect, it, vi } from 'vitest'

import type { ArtifactToolContext } from '@/lib/artifacts/tool-context'
import type {
  ArtifactData,
  ArtifactEventData,
  ArtifactLogData,
  ArtifactStatusData
} from '@/lib/types/artifact'

import { createArtifactEmitter } from './write-artifact-data'

function createMockWriter() {
  return {
    write: vi.fn(),
    merge: vi.fn(),
    onError: undefined
  }
}

describe('createArtifactEmitter', () => {
  it('returns an object with all four emit functions', () => {
    const writer = createMockWriter()
    const emitter = createArtifactEmitter(writer as any)

    expect(emitter.emitArtifact).toBeTypeOf('function')
    expect(emitter.emitArtifactStatus).toBeTypeOf('function')
    expect(emitter.emitArtifactLog).toBeTypeOf('function')
    expect(emitter.emitArtifactEvent).toBeTypeOf('function')
  })

  describe('persistent parts', () => {
    it('emits data-artifact via writer.write', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      const data: ArtifactData = {
        id: 'artifact-1',
        title: 'My App',
        status: 'building'
      }

      emitter.emitArtifact(data)

      expect(writer.write).toHaveBeenCalledTimes(1)
      expect(writer.write).toHaveBeenCalledWith({
        type: 'data-artifact',
        data
      })
    })

    it('emits data-artifactStatus via writer.write', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      const data: ArtifactStatusData = {
        id: 'artifact-1',
        status: 'ready',
        previewUrl: 'https://preview.example.com'
      }

      emitter.emitArtifactStatus(data)

      expect(writer.write).toHaveBeenCalledTimes(1)
      expect(writer.write).toHaveBeenCalledWith({
        type: 'data-artifactStatus',
        data
      })
    })

    it('persistent parts do not set transient flag', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      emitter.emitArtifact({
        id: 'a1',
        title: 'Test',
        status: 'ready'
      })

      const call = writer.write.mock.calls[0][0]
      expect(call.transient).toBeUndefined()
    })
  })

  describe('transient parts', () => {
    it('emits data-artifactLog with transient flag', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      const data: ArtifactLogData = {
        artifactId: 'artifact-1',
        message: 'Installing dependencies...',
        level: 'info'
      }

      emitter.emitArtifactLog(data)

      expect(writer.write).toHaveBeenCalledTimes(1)
      expect(writer.write).toHaveBeenCalledWith({
        type: 'data-artifactLog',
        data,
        transient: true
      })
    })

    it('emits data-artifactEvent with transient flag', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      const data: ArtifactEventData = {
        artifactId: 'artifact-1',
        event: 'build-complete',
        payload: { duration: 3000 }
      }

      emitter.emitArtifactEvent(data)

      expect(writer.write).toHaveBeenCalledTimes(1)
      expect(writer.write).toHaveBeenCalledWith({
        type: 'data-artifactEvent',
        data,
        transient: true
      })
    })
  })

  describe('emitter as ArtifactToolContext fields', () => {
    it('emitter functions satisfy ArtifactToolContext emit signatures', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      // Verify the emitter shape matches what ArtifactToolContext expects
      const ctx: Pick<
        ArtifactToolContext,
        | 'emitArtifact'
        | 'emitArtifactStatus'
        | 'emitArtifactLog'
        | 'emitArtifactEvent'
      > = emitter

      expect(ctx.emitArtifact).toBeTypeOf('function')
      expect(ctx.emitArtifactStatus).toBeTypeOf('function')
      expect(ctx.emitArtifactLog).toBeTypeOf('function')
      expect(ctx.emitArtifactEvent).toBeTypeOf('function')
    })
  })

  describe('multiple emissions', () => {
    it('handles sequential emissions', () => {
      const writer = createMockWriter()
      const emitter = createArtifactEmitter(writer as any)

      emitter.emitArtifactEvent({
        artifactId: 'a1',
        event: 'create-started'
      })
      emitter.emitArtifactLog({
        artifactId: 'a1',
        message: 'Building...'
      })
      emitter.emitArtifact({
        id: 'a1',
        title: 'App',
        status: 'ready',
        previewUrl: 'https://preview.example.com'
      })
      emitter.emitArtifactStatus({
        id: 'a1',
        status: 'ready',
        previewUrl: 'https://preview.example.com'
      })

      expect(writer.write).toHaveBeenCalledTimes(4)

      // Verify correct types in order
      expect(writer.write.mock.calls[0][0].type).toBe('data-artifactEvent')
      expect(writer.write.mock.calls[1][0].type).toBe('data-artifactLog')
      expect(writer.write.mock.calls[2][0].type).toBe('data-artifact')
      expect(writer.write.mock.calls[3][0].type).toBe('data-artifactStatus')
    })
  })
})

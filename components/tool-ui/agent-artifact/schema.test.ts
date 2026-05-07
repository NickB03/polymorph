import { describe, expect, it } from 'vitest'

import { safeParseSerializableAgentArtifact } from '..'

describe('SerializableAgentArtifactSchema', () => {
  it('accepts a minimal inline artifact', () => {
    expect(
      safeParseSerializableAgentArtifact({
        id: 'artifact-1',
        title: 'API Schema',
        artifactType: 'code',
        content: 'export const schema = {}'
      })
    ).toEqual(
      expect.objectContaining({
        id: 'artifact-1',
        title: 'API Schema'
      })
    )
  })

  it('rejects invalid artifact shape and version edges', () => {
    expect(
      safeParseSerializableAgentArtifact({
        id: 'artifact-1',
        title: '',
        artifactType: 'image',
        content: 'x',
        versions: [{ id: '', label: 'v1', timestamp: 'now', content: 'x' }]
      })
    ).toBeNull()
  })
})

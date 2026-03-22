export type LegacyCanvasNotice = {
  kind: 'legacy-unavailable'
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
}

export function buildLegacyCanvasNotice(input: {
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
}): LegacyCanvasNotice {
  return {
    kind: 'legacy-unavailable' as const,
    artifactId: input.artifactId,
    source: input.source
  }
}

export function resolveLegacyCanvasReference(input: {
  artifactId: string
  source: 'chat-history' | 'public-link' | 'guest-token'
}): LegacyCanvasNotice {
  return buildLegacyCanvasNotice(input)
}

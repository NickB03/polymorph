import { describe, expect, it } from 'vitest'

import {
  parseSerializableGenerateImage,
  safeParseSerializableGenerateImage
} from '../schema'

describe('safeParseSerializableGenerateImage', () => {
  it('parses valid output with all fields', () => {
    const result = safeParseSerializableGenerateImage({
      imageUrl: 'https://example.com/image.png',
      filename: 'generated-123.png',
      mediaType: 'image/png',
      description: 'a sunset',
      aspectRatio: '16:9'
    })
    expect(result).toEqual({
      imageUrl: 'https://example.com/image.png',
      filename: 'generated-123.png',
      mediaType: 'image/png',
      description: 'a sunset',
      aspectRatio: '16:9'
    })
  })

  it('parses valid output without optional fields', () => {
    const result = safeParseSerializableGenerateImage({
      imageUrl: 'https://example.com/image.png',
      filename: 'generated-123.png',
      mediaType: 'image/png',
      description: 'a sunset'
    })
    expect(result).not.toBeNull()
    expect(result?.aspectRatio).toBeUndefined()
  })

  it('returns null for error output', () => {
    const result = safeParseSerializableGenerateImage({
      error: 'something failed'
    })
    expect(result).toBeNull()
  })

  it('returns null for invalid input', () => {
    expect(safeParseSerializableGenerateImage(null)).toBeNull()
    expect(safeParseSerializableGenerateImage({})).toBeNull()
    expect(safeParseSerializableGenerateImage('string')).toBeNull()
  })
})

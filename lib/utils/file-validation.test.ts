import { describe, expect, it } from 'vitest'

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_UPLOAD_TYPES,
  isAllowedUploadType,
  MAX_DATA_URL_LENGTH,
  validateFilePart
} from './file-validation'

describe('file-validation', () => {
  describe('ALLOWED_IMAGE_TYPES', () => {
    it('includes standard web image formats', () => {
      expect(ALLOWED_IMAGE_TYPES).toContain('image/png')
      expect(ALLOWED_IMAGE_TYPES).toContain('image/jpeg')
      expect(ALLOWED_IMAGE_TYPES).toContain('image/gif')
      expect(ALLOWED_IMAGE_TYPES).toContain('image/webp')
    })
  })

  describe('ALLOWED_UPLOAD_TYPES', () => {
    it('includes images and documents', () => {
      expect(ALLOWED_UPLOAD_TYPES).toContain('image/png')
      expect(ALLOWED_UPLOAD_TYPES).toContain('application/pdf')
    })
  })

  describe('isAllowedUploadType', () => {
    it('accepts allowed types', () => {
      expect(isAllowedUploadType('image/png')).toBe(true)
      expect(isAllowedUploadType('application/pdf')).toBe(true)
    })

    it('rejects unknown types', () => {
      expect(isAllowedUploadType('text/html')).toBe(false)
      expect(isAllowedUploadType('application/javascript')).toBe(false)
      expect(isAllowedUploadType('')).toBe(false)
    })
  })

  describe('validateFilePart', () => {
    it('accepts a valid image file part', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'https://example.com/image.png',
        mediaType: 'image/png'
      })
      expect(result).toEqual({ valid: true })
    })

    it('accepts a valid data URL file part', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'data:image/png;base64,iVBOR',
        mediaType: 'image/png'
      })
      expect(result).toEqual({ valid: true })
    })

    it('rejects missing url', () => {
      const result = validateFilePart({
        type: 'file',
        mediaType: 'image/png'
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/url/i)
    })

    it('rejects missing mediaType', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'https://example.com/img.png'
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/mediaType/i)
    })

    it('rejects disallowed mediaType', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'https://example.com/file.exe',
        mediaType: 'application/x-msdownload'
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/not allowed/i)
    })

    it('rejects data URL exceeding max size', () => {
      const bigDataUrl =
        'data:image/png;base64,' + 'A'.repeat(MAX_DATA_URL_LENGTH)
      const result = validateFilePart({
        type: 'file',
        url: bigDataUrl,
        mediaType: 'image/png'
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/too large/i)
    })
  })
})

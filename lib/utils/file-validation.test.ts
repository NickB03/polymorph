import { describe, expect, it } from 'vitest'

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_UPLOAD_TYPES,
  isAllowedUploadType,
  MAX_DATA_URL_LENGTH,
  parseDataUrlMimeType,
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

  describe('parseDataUrlMimeType', () => {
    it('extracts MIME from a standard data URL', () => {
      expect(parseDataUrlMimeType('data:image/png;base64,iVBOR')).toBe(
        'image/png'
      )
    })

    it('extracts MIME from data URL without base64 encoding', () => {
      expect(parseDataUrlMimeType('data:text/plain,hello')).toBe('text/plain')
    })

    it('returns null for non-data URL', () => {
      expect(parseDataUrlMimeType('https://example.com/img.png')).toBeNull()
    })

    it('returns null for malformed data URL', () => {
      expect(parseDataUrlMimeType('data:')).toBeNull()
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

    it('rejects data URL with MIME mismatch (bypass attempt)', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
        mediaType: 'image/png'
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/does not match/i)
    })

    it('rejects data URL with unparseable MIME', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'data:;base64,iVBOR',
        mediaType: 'image/png'
      })
      expect(result.valid).toBe(false)
      if (!result.valid) expect(result.reason).toMatch(/could not parse/i)
    })

    it('accepts data URL with matching MIME', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'data:image/gif;base64,R0lGODlh',
        mediaType: 'image/gif'
      })
      expect(result).toEqual({ valid: true })
    })

    it('does not apply MIME check to non-data URLs', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'https://example.com/image.png',
        mediaType: 'image/png'
      })
      expect(result).toEqual({ valid: true })
    })
  })
})

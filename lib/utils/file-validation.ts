export const ALLOWED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp'
] as const

export const ALLOWED_DOCUMENT_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
] as const

export const ALLOWED_UPLOAD_TYPES = [
  ...ALLOWED_IMAGE_TYPES,
  ...ALLOWED_DOCUMENT_TYPES
] as const

export const MAX_UPLOAD_SIZE_BYTES = 5 * 1024 * 1024 // 5 MB

/** Base64 overhead: 4/3 of original size, so ~6.67 MB for 5 MB file */
export const MAX_DATA_URL_LENGTH =
  Math.ceil(MAX_UPLOAD_SIZE_BYTES * (4 / 3)) + 256 // 256 for prefix

export function isAllowedUploadType(mediaType: string): boolean {
  return (ALLOWED_UPLOAD_TYPES as readonly string[]).includes(mediaType)
}

export function isImageType(mediaType: string): boolean {
  return (ALLOWED_IMAGE_TYPES as readonly string[]).includes(mediaType)
}

type ValidationResult = { valid: true } | { valid: false; reason: string }

export function validateFilePart(
  part: Record<string, unknown>
): ValidationResult {
  if (typeof part.url !== 'string' || part.url.length === 0) {
    return { valid: false, reason: 'File part missing url' }
  }

  if (typeof part.mediaType !== 'string' || part.mediaType.length === 0) {
    return { valid: false, reason: 'File part missing mediaType' }
  }

  if (!isAllowedUploadType(part.mediaType)) {
    return {
      valid: false,
      reason: `Media type '${part.mediaType}' is not allowed`
    }
  }

  // Size-check data URLs (base64 images from guests)
  if (
    typeof part.url === 'string' &&
    part.url.startsWith('data:') &&
    part.url.length > MAX_DATA_URL_LENGTH
  ) {
    return { valid: false, reason: 'Data URL too large (max 5 MB)' }
  }

  return { valid: true }
}

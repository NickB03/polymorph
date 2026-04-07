# Image Upload as LLM Context — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow users (authenticated and guest) to upload images in chat and have them sent to the LLM as multimodal context for analysis.

**Architecture:** Authenticated users upload to Supabase Storage via the existing `/api/upload` endpoint and send the returned URL in a `file` message part. Guest users convert images to base64 data URLs client-side (no server storage needed — guest chats are ephemeral). The Vercel AI SDK's `convertToModelMessages()` handles both URL and data URL formats natively. Server-side validation of file parts is added for all users, not just guests.

**Tech Stack:** Next.js 16 (App Router), React 19, Vercel AI SDK v6, Supabase Storage, Vitest

---

## File Map

| File                                   | Action | Responsibility                                                                                               |
| -------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------ |
| `lib/types/index.ts`                   | Modify | Add `dataUrl` field to `UploadedFile` type                                                                   |
| `lib/utils/file-validation.ts`         | Create | Shared media type allowlist + validation for server and client                                               |
| `lib/utils/file-validation.test.ts`    | Create | Tests for file validation                                                                                    |
| `hooks/use-file-dropzone.ts`           | Modify | Fix `name`/`filename` bug; add base64 guest path                                                             |
| `components/file-upload-button.tsx`    | Modify | Import shared allowlist; support guest base64 flow                                                           |
| `components/chat-panel.tsx`            | Modify | Show `FileUploadButton` for guests; fix send button disabled state; fix Enter key guard for file-only submit |
| `components/chat-panel.test.tsx`       | Modify | Add test for file-only submit enabled                                                                        |
| `components/chat.tsx`                  | Modify | Wire guest base64 path into `onSubmit`; pass `isGuest` to dropzone                                           |
| `app/api/chat/route.ts`                | Modify | Move file part validation outside `isGuest` block; validate for all users                                    |
| `app/api/chat/__tests__/route.test.ts` | Modify | Add tests for file part validation (both guest and auth)                                                     |

**Files that need NO changes:** `lib/db/schema.ts`, `lib/utils/message-mapping.ts`, `lib/streaming/`, `lib/agents/researcher.ts`, `components/render-message.tsx` (already renders file parts), `components/attachment-preview.tsx`, `components/user-file-section.tsx`.

---

## Task 1: Shared File Validation Utility

**Why first:** Both the server route (Task 5) and the client upload components (Tasks 3-4) need a shared allowlist. Defining it once prevents drift between the three places that currently hardcode allowed types (`file-upload-button.tsx:12-16`, `use-file-dropzone.ts:20`, `app/api/upload/route.ts:7`).

**Files:**

- Create: `lib/utils/file-validation.ts`
- Create: `lib/utils/file-validation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// lib/utils/file-validation.test.ts
import { describe, expect, it } from 'vitest'

import {
  ALLOWED_IMAGE_TYPES,
  ALLOWED_UPLOAD_TYPES,
  isAllowedUploadType,
  MAX_UPLOAD_SIZE_BYTES,
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
      expect(result.reason).toMatch(/url/i)
    })

    it('rejects missing mediaType', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'https://example.com/img.png'
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/mediaType/i)
    })

    it('rejects disallowed mediaType', () => {
      const result = validateFilePart({
        type: 'file',
        url: 'https://example.com/file.exe',
        mediaType: 'application/x-msdownload'
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/not allowed/i)
    })

    it('rejects data URL exceeding max size', () => {
      const bigDataUrl =
        'data:image/png;base64,' + 'A'.repeat(MAX_UPLOAD_SIZE_BYTES + 1)
      const result = validateFilePart({
        type: 'file',
        url: bigDataUrl,
        mediaType: 'image/png'
      })
      expect(result.valid).toBe(false)
      expect(result.reason).toMatch(/too large/i)
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- lib/utils/file-validation.test.ts`
Expected: FAIL — module `./file-validation` not found.

- [ ] **Step 3: Write the implementation**

```typescript
// lib/utils/file-validation.ts

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
const MAX_DATA_URL_LENGTH = Math.ceil(MAX_UPLOAD_SIZE_BYTES * (4 / 3)) + 256 // 256 for prefix

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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- lib/utils/file-validation.test.ts`
Expected: All 8 tests PASS.

- [ ] **Step 5: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add lib/utils/file-validation.ts lib/utils/file-validation.test.ts
git commit -m "feat: add shared file validation utility with allowlist and size checks"
```

---

## Task 2: Fix `name`/`filename` Bug in Dropzone Hook

**Why:** `use-file-dropzone.ts:88` reads `uploaded.name` but `lib/supabase/storage.ts:36` returns `{ filename: ... }`. This means drag-dropped files get `name: undefined`, which propagates to `chat.tsx:793` as `filename: undefined` in the message part. The DB `file_fields_required` check constraint requires `file_filename IS NOT NULL`, so drag-dropped file messages would fail to persist.

**Files:**

- Modify: `hooks/use-file-dropzone.ts:88`

- [ ] **Step 1: Fix the property name**

In `hooks/use-file-dropzone.ts`, change line 88 from:

```typescript
                      name: uploaded.name,
```

to:

```typescript
                      name: uploaded.filename,
```

**Context:** The response shape from `/api/upload` is `{ file: { url, filename, key, mediaType, type } }` (returned by `lib/supabase/storage.ts:35-39`). The `UploadedFile` type stores the display name in `name`, but the API returns `filename`. The `FileUploadButton` handler in `chat-panel.tsx:279` already uses `uploaded.filename` correctly — this is only the drag-drop path that's wrong.

- [ ] **Step 2: Verify with typecheck**

Run: `bun typecheck`
Expected: No new errors. (The response object is typed as `any` from `res.json()`, so this is a runtime fix, not a type fix.)

- [ ] **Step 3: Commit**

```bash
git add hooks/use-file-dropzone.ts
git commit -m "fix: read filename (not name) from upload response in drag-drop hook"
```

---

## Task 3: Fix Send Button and Enter Key for File-Only Submit

**Why:** Two guards block submitting with files but no text:

1. `chat-panel.tsx:313` — Send button: `disabled={input.length === 0 && !isLoading}` ignores uploaded files
2. `chat-panel.tsx:231` — Enter key: `if (input.trim().length === 0) { e.preventDefault(); return }` blocks file-only submit via keyboard

Meanwhile, `chat.tsx:782` correctly allows it: `if (input.trim() || uploaded.length > 0)`.

**Files:**

- Modify: `components/chat-panel.tsx:231` and `components/chat-panel.tsx:313`
- Modify: `components/chat-panel.test.tsx`

- [ ] **Step 1: Write the failing test**

Add to `components/chat-panel.test.tsx`, after the existing test block:

```typescript
describe('file-only submit', () => {
  it('enables send button when files are uploaded even with empty input', () => {
    const mockSubmit = vi.fn(e => e.preventDefault())

    render(
      <ChatPanel
        chatId="test-chat"
        input=""
        handleInputChange={vi.fn()}
        handleSubmit={mockSubmit}
        status="ready"
        messages={[]}
        stop={vi.fn()}
        append={vi.fn()}
        showScrollToBottomButton={false}
        scrollContainerRef={{ current: null }}
        uploadedFiles={[
          {
            file: new File(['test'], 'photo.png', { type: 'image/png' }),
            status: 'uploaded',
            url: 'https://example.com/photo.png',
            name: 'photo.png',
          },
        ]}
        setUploadedFiles={vi.fn()}
      />
    )

    const sendButton = screen.getByRole('button', { name: /send message/i })
    expect(sendButton).not.toBeDisabled()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- components/chat-panel.test.tsx`
Expected: FAIL — send button is disabled because `input.length === 0`.

- [ ] **Step 3: Fix the send button disabled state**

In `components/chat-panel.tsx`, change line 313 from:

```typescript
                disabled={input.length === 0 && !isLoading}
```

to:

```typescript
                disabled={
                  input.length === 0 &&
                  !isLoading &&
                  !uploadedFiles.some(f => f.status === 'uploaded')
                }
```

- [ ] **Step 4: Fix the Enter key guard**

In `components/chat-panel.tsx`, change lines 231-234 from:

```typescript
if (input.trim().length === 0) {
  e.preventDefault()
  return
}
```

to:

```typescript
if (
  input.trim().length === 0 &&
  !uploadedFiles.some(f => f.status === 'uploaded')
) {
  e.preventDefault()
  return
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `bun run test -- components/chat-panel.test.tsx`
Expected: All tests PASS, including the new `file-only submit` test.

- [ ] **Step 6: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: No new errors.

- [ ] **Step 7: Commit**

```bash
git add components/chat-panel.tsx components/chat-panel.test.tsx
git commit -m "fix: allow file-only submit via send button and Enter key"
```

---

## Task 4: Guest Base64 Conversion in Upload Components

**Why:** Guests can't use `/api/upload` (requires auth, returns 401). Instead, convert images to base64 data URLs client-side. Guest chats are ephemeral (never persisted to DB), so there's no storage bloat concern.

**Files:**

- Modify: `lib/types/index.ts:101-107` — add `dataUrl` field to `UploadedFile`
- Modify: `components/chat-panel.tsx:248-296` — show `FileUploadButton` for guests, add base64 path
- Modify: `hooks/use-file-dropzone.ts` — add `isGuest` option, use base64 path when guest
- Modify: `components/chat.tsx:810-830` — pass `isGuest` to `useFileDropzone`, update `onSubmit` to use `dataUrl` for guests

- [ ] **Step 1: Add `dataUrl` to `UploadedFile` type**

In `lib/types/index.ts`, change lines 101-107 from:

```typescript
export type UploadedFile = {
  file: File
  status: 'uploading' | 'uploaded' | 'error'
  url?: string
  name?: string
  key?: string
}
```

to:

```typescript
export type UploadedFile = {
  file: File
  status: 'uploading' | 'uploaded' | 'error'
  url?: string
  name?: string
  key?: string
  /** Base64 data URL for guest uploads (no server storage) */
  dataUrl?: string
}
```

- [ ] **Step 2: Add `readFileAsDataUrl` helper to `file-upload-button.tsx`**

This is a small pure function. Add it at the top of `components/file-upload-button.tsx`, after the imports:

```typescript
export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}
```

- [ ] **Step 3: Update `FileUploadButton` to accept `isGuest` and `onGuestFileSelect`**

In `components/file-upload-button.tsx`, update the component props and add a second callback path:

Change the props type from:

```typescript
export function FileUploadButton({
  onFileSelect
}: {
  onFileSelect: (files: File[]) => void
}) {
```

to:

```typescript
export function FileUploadButton({
  onFileSelect,
  isGuest = false,
  onGuestFileSelect
}: {
  onFileSelect: (files: File[]) => void
  isGuest?: boolean
  onGuestFileSelect?: (files: { file: File; dataUrl: string }[]) => void
}) {
```

Then update the `handleFiles` function. Change the block at lines 44-46 from:

```typescript
if (validFiles.length > 0) {
  onFileSelect(validFiles)
}
```

to:

```typescript
if (validFiles.length > 0) {
  if (isGuest && onGuestFileSelect) {
    Promise.all(
      validFiles.map(async file => ({
        file,
        dataUrl: await readFileAsDataUrl(file)
      }))
    ).then(onGuestFileSelect)
  } else {
    onFileSelect(validFiles)
  }
}
```

- [ ] **Step 4: Update `chat-panel.tsx` — show FileUploadButton for guests**

In `components/chat-panel.tsx`, change lines 248-296. Replace the existing `{!isGuest && (` block:

```typescript
              {!isGuest && (
                <FileUploadButton
                  onFileSelect={async files => {
```

with a block that shows for all users:

```typescript
              <FileUploadButton
                isGuest={isGuest}
                onGuestFileSelect={files => {
                  const newFiles: UploadedFile[] = files.map(
                    ({ file, dataUrl }) => ({
                      file,
                      status: 'uploaded' as const,
                      url: dataUrl,
                      name: file.name,
                      dataUrl,
                    })
                  )
                  setUploadedFiles(prev =>
                    [...prev, ...newFiles].slice(0, 3)
                  )
                }}
                onFileSelect={async files => {
```

And change the closing of the `!isGuest` conditional. The entire block from line 248 to 296 should become:

```typescript
              <FileUploadButton
                isGuest={isGuest}
                onGuestFileSelect={files => {
                  const newFiles: UploadedFile[] = files.map(
                    ({ file, dataUrl }) => ({
                      file,
                      status: 'uploaded' as const,
                      url: dataUrl,
                      name: file.name,
                      dataUrl,
                    })
                  )
                  setUploadedFiles(prev =>
                    [...prev, ...newFiles].slice(0, 3)
                  )
                }}
                onFileSelect={async files => {
                  const newFiles: UploadedFile[] = files.map(file => ({
                    file,
                    status: 'uploading',
                  }))
                  setUploadedFiles(prev => [...prev, ...newFiles])
                  await Promise.all(
                    newFiles.map(async uf => {
                      const formData = new FormData()
                      formData.append('file', uf.file)
                      formData.append('chatId', chatId)
                      try {
                        const res = await fetch('/api/upload', {
                          method: 'POST',
                          body: formData,
                        })

                        if (!res.ok) {
                          throw new Error('Upload failed')
                        }

                        const { file: uploaded } = await res.json()
                        setUploadedFiles(prev =>
                          prev.map(f =>
                            f.file === uf.file
                              ? {
                                  ...f,
                                  status: 'uploaded',
                                  url: uploaded.url,
                                  name: uploaded.filename,
                                  key: uploaded.key,
                                }
                              : f
                          )
                        )
                      } catch (e) {
                        toast.error(`Failed to upload ${uf.file.name}`)
                        setUploadedFiles(prev =>
                          prev.map(f =>
                            f.file === uf.file
                              ? { ...f, status: 'error' }
                              : f
                          )
                        )
                      }
                    })
                  )
                }}
              />
```

Note: The `{!isGuest && (` wrapper and its matching `)}` are removed — `FileUploadButton` now renders for all users.

- [ ] **Step 5: Update `use-file-dropzone.ts` — add `isGuest` base64 path**

In `hooks/use-file-dropzone.ts`, add `isGuest` to the props type at line 7:

```typescript
type UseFileDropzoneProps = {
  uploadedFiles: UploadedFile[]
  setUploadedFiles: React.Dispatch<React.SetStateAction<UploadedFile[]>>
  maxFiles?: number
  allowedTypes?: string[]
  chatId: string
  isGuest?: boolean
}
```

Update the destructuring at line 15 to include `isGuest`:

```typescript
export function useFileDropzone({
  uploadedFiles,
  setUploadedFiles,
  chatId,
  maxFiles = 3,
  allowedTypes = ['image/png', 'image/jpeg', 'application/pdf'],
  isGuest = false
}: UseFileDropzoneProps) {
```

Add the `readFileAsDataUrl` import at the top:

```typescript
import { readFileAsDataUrl } from '@/components/file-upload-button'
```

Then in the `handleDrop` callback, replace the upload logic (lines 65-103) with a branching path. Replace:

```typescript
await Promise.all(
  initialFiles.map(async uf => {
    const formData = new FormData()
    formData.append('file', uf.file)
    formData.append('chatId', chatId)

    try {
      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData
      })

      if (!res.ok) throw new Error('Upload failed')

      const { file: uploaded } = await res.json()

      setUploadedFiles(prev =>
        prev.map(f =>
          f.file === uf.file
            ? {
                ...f,
                status: 'uploaded',
                url: uploaded.url,
                name: uploaded.filename,
                key: uploaded.key
              }
            : f
        )
      )
    } catch (err) {
      toast.error(`Failed to upload ${uf.file.name}`)
      setUploadedFiles(prev =>
        prev.map(f => (f.file === uf.file ? { ...f, status: 'error' } : f))
      )
    }
  })
)
```

with:

```typescript
await Promise.all(
  initialFiles.map(async uf => {
    try {
      if (isGuest) {
        const dataUrl = await readFileAsDataUrl(uf.file)
        setUploadedFiles(prev =>
          prev.map(f =>
            f.file === uf.file
              ? {
                  ...f,
                  status: 'uploaded',
                  url: dataUrl,
                  name: uf.file.name,
                  dataUrl
                }
              : f
          )
        )
      } else {
        const formData = new FormData()
        formData.append('file', uf.file)
        formData.append('chatId', chatId)

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData
        })

        if (!res.ok) throw new Error('Upload failed')

        const { file: uploaded } = await res.json()

        setUploadedFiles(prev =>
          prev.map(f =>
            f.file === uf.file
              ? {
                  ...f,
                  status: 'uploaded',
                  url: uploaded.url,
                  name: uploaded.filename,
                  key: uploaded.key
                }
              : f
          )
        )
      }
    } catch (err) {
      toast.error(`Failed to upload ${uf.file.name}`)
      setUploadedFiles(prev =>
        prev.map(f => (f.file === uf.file ? { ...f, status: 'error' } : f))
      )
    }
  })
)
```

Also add `isGuest` to the dependency array at line 105:

```typescript
;[allowedTypes, maxFiles, uploadedFiles, setUploadedFiles, chatId, isGuest]
```

- [ ] **Step 6: Update `chat.tsx` — wire guest drag-drop and use correct URL in onSubmit**

In `components/chat.tsx`, update `useFileDropzone` call at lines 810-815. Change:

```typescript
const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
  useFileDropzone({
    uploadedFiles,
    setUploadedFiles,
    chatId: chatId
  })
```

to:

```typescript
const { isDragging, handleDragOver, handleDragLeave, handleDrop } =
  useFileDropzone({
    uploadedFiles,
    setUploadedFiles,
    chatId: chatId,
    isGuest
  })
```

Then remove the `guestDragHandlers` block and the conditional (lines 816-830). Change:

```typescript
const guestDragHandlers = {
  isDragging: false,
  handleDragOver: (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  },
  handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  },
  handleDrop: (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
  }
}
const dragHandlers = isGuest
  ? guestDragHandlers
  : { isDragging, handleDragOver, handleDragLeave, handleDrop }
```

to:

```typescript
const dragHandlers = { isDragging, handleDragOver, handleDragLeave, handleDrop }
```

The `onSubmit` function at `chat.tsx:789-795` already builds file parts correctly — it reads `f.url!` which will be a Supabase URL for auth users and a data URL for guests. No change needed there.

- [ ] **Step 7: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: No new errors.

- [ ] **Step 8: Commit**

```bash
git add lib/types/index.ts components/file-upload-button.tsx components/chat-panel.tsx hooks/use-file-dropzone.ts components/chat.tsx
git commit -m "feat: enable image upload for guest users via base64 data URLs"
```

---

## Task 5: Server-Side File Part Validation for All Users

**Why:** Currently `app/api/chat/route.ts:174` only validates guest messages. Authenticated users can POST arbitrary file parts (any media type, any URL) with no server-side validation. This task moves file part validation to apply for all users.

**Files:**

- Modify: `app/api/chat/route.ts:173-200`
- Modify: `app/api/chat/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `app/api/chat/__tests__/route.test.ts`. First, read the existing test file to understand the mock setup and test patterns, then add:

```typescript
describe('file part validation', () => {
  it('rejects authenticated user with disallowed file mediaType', async () => {
    const body = {
      chatId: 'chat-123',
      trigger: 'submit-message',
      isNewChat: true,
      message: {
        id: 'msg-1',
        role: 'user',
        parts: [
          {
            type: 'file',
            url: 'https://example.com/f.exe',
            mediaType: 'application/x-msdownload'
          }
        ]
      }
    }

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const { POST } = await import('../route')
    const res = await POST(req)
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/not allowed/i)
  })

  it('rejects guest with disallowed file mediaType', async () => {
    const { getCurrentUserId } = await import('@/lib/auth/get-current-user')
    vi.mocked(getCurrentUserId).mockResolvedValueOnce(null)

    const body = {
      chatId: 'chat-456',
      trigger: 'submit-message',
      isNewChat: true,
      messages: [
        {
          role: 'user',
          parts: [
            {
              type: 'file',
              url: 'data:text/html;base64,abc',
              mediaType: 'text/html'
            }
          ]
        }
      ]
    }

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const { POST } = await import('../route')
    const res = await POST(req)
    expect(res.status).toBe(400)
  })

  it('allows authenticated user with valid image file part', async () => {
    const body = {
      chatId: 'chat-789',
      trigger: 'submit-message',
      isNewChat: true,
      message: {
        id: 'msg-1',
        role: 'user',
        parts: [
          { type: 'text', text: 'analyze this' },
          {
            type: 'file',
            url: 'https://storage.example.com/img.png',
            mediaType: 'image/png'
          }
        ]
      }
    }

    const req = new Request('http://localhost/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    const { POST } = await import('../route')
    const res = await POST(req)
    expect(res.status).toBe(200)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `bun run test -- app/api/chat/__tests__/route.test.ts`
Expected: The "rejects authenticated user with disallowed file mediaType" test FAILs (returns 200 instead of 400).

- [ ] **Step 3: Add file part validation for all users**

In `app/api/chat/route.ts`, add the import at the top:

```typescript
import { validateFilePart } from '@/lib/utils/file-validation'
```

Then, after the existing guest validation block (after line 200), add a new validation block that runs for **all** users. Insert after line 200:

```typescript
// Validate file parts for all users (guests and authenticated)
const messagesToValidate = isGuest ? messages : message?.parts ? [message] : []

for (const msg of messagesToValidate) {
  if (!Array.isArray(msg.parts)) continue
  for (const part of msg.parts) {
    if (part.type === 'file') {
      const result = validateFilePart(part)
      if (!result.valid) {
        return jsonError('BAD_REQUEST', result.reason, 400)
      }
    }
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `bun run test -- app/api/chat/__tests__/route.test.ts`
Expected: All tests PASS, including the new file part validation tests.

- [ ] **Step 5: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: No new errors.

- [ ] **Step 6: Commit**

```bash
git add app/api/chat/route.ts app/api/chat/__tests__/route.test.ts
git commit -m "feat: validate file parts server-side for all users, not just guests"
```

---

## Task 6: Update Upload API Allowlist to Use Shared Constants

**Why:** `app/api/upload/route.ts:7` has its own hardcoded `ALLOWED_TYPES` that's missing `image/gif`, `image/webp`, and the document types that `FileUploadButton` accepts. Replace with the shared constant.

**Files:**

- Modify: `app/api/upload/route.ts:6-7`

- [ ] **Step 1: Replace hardcoded allowlist**

In `app/api/upload/route.ts`, replace lines 4 and 7:

```typescript
import { uploadFileToSupabase } from '@/lib/supabase/storage'

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'application/pdf']
```

with:

```typescript
import { uploadFileToSupabase } from '@/lib/supabase/storage'
import {
  ALLOWED_UPLOAD_TYPES,
  MAX_UPLOAD_SIZE_BYTES
} from '@/lib/utils/file-validation'
```

Then update line 30 from:

```typescript
    if (file.size > MAX_FILE_SIZE) {
```

to:

```typescript
    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
```

And update line 37 from:

```typescript
    if (!ALLOWED_TYPES.includes(file.type)) {
```

to:

```typescript
    if (!(ALLOWED_UPLOAD_TYPES as readonly string[]).includes(file.type)) {
```

- [ ] **Step 2: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: No new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/upload/route.ts
git commit -m "refactor: use shared file validation constants in upload route"
```

---

## Task 7: Final Verification

- [ ] **Step 1: Run the full test suite**

Run: `bun run test`
Expected: All tests pass.

- [ ] **Step 2: Run lint and typecheck**

Run: `bun lint && bun typecheck`
Expected: No errors or warnings.

- [ ] **Step 3: Manual smoke test — authenticated user**

Run: `bun dev`

1. Sign in
2. Click the paperclip icon, select a PNG image
3. Verify image thumbnail appears in the upload preview
4. Type "What's in this image?" and press Enter
5. Verify the LLM responds with image analysis
6. Drag-drop a JPEG image onto the chat
7. Verify it uploads and shows thumbnail
8. Submit with text — verify LLM analyzes the image

- [ ] **Step 4: Manual smoke test — guest user**

1. Open the app in an incognito window (no sign-in)
2. Verify the paperclip icon is visible
3. Click it, select a PNG image
4. Verify the thumbnail appears immediately (no upload spinner — base64 is instant)
5. Type "Describe this image" and press Enter
6. Verify the LLM responds with image analysis
7. Drag-drop an image — verify it works
8. Submit an image with no text (file-only) — verify the send button is enabled and submission works

- [ ] **Step 5: Manual smoke test — file-only submit**

1. Upload an image without typing any text
2. Verify the Send button is enabled
3. Click Send — verify message is sent with just the image
4. Press Enter with an image attached but no text — verify it submits

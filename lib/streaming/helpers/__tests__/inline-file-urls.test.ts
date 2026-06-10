import type { ModelMessage } from 'ai'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const { downloadStorageFile } = vi.hoisted(() => ({
  downloadStorageFile: vi.fn()
}))

vi.mock('@/lib/supabase/server-storage', () => ({ downloadStorageFile }))

import { inlineFileUrls } from '../inline-file-urls'

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => {
  mockFetch.mockReset()
  downloadStorageFile.mockReset()
})

afterEach(() => {
  vi.unstubAllEnvs()
})

function userMsg(content: any[]): ModelMessage {
  return { role: 'user', content } as ModelMessage
}

function assistantMsg(text: string): ModelMessage {
  return {
    role: 'assistant',
    content: [{ type: 'text', text }]
  } as ModelMessage
}

describe('inlineFileUrls', () => {
  it('returns messages unchanged when no file parts exist', async () => {
    const messages: ModelMessage[] = [
      userMsg([{ type: 'text', text: 'hello' }]),
      assistantMsg('hi')
    ]

    const result = await inlineFileUrls(messages)
    expect(result).toBe(messages)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('returns messages unchanged when file parts have non-URL data', async () => {
    const messages: ModelMessage[] = [
      userMsg([
        {
          type: 'file',
          data: new Uint8Array([1, 2, 3]),
          mediaType: 'image/png'
        }
      ])
    ]

    const result = await inlineFileUrls(messages)
    expect(result).toBe(messages)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches URL and replaces with Uint8Array data', async () => {
    const testData = new Uint8Array([137, 80, 78, 71]) // PNG magic bytes
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(testData.buffer),
      headers: new Headers({ 'content-type': 'image/png' })
    })

    const fileUrl = new URL(
      'https://example.supabase.co/storage/v1/object/public/user-uploads/test.png'
    )
    const messages: ModelMessage[] = [
      userMsg([{ type: 'file', data: fileUrl, mediaType: 'image/png' }])
    ]

    const result = await inlineFileUrls(messages)

    expect(mockFetch).toHaveBeenCalledWith(fileUrl)
    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toBeInstanceOf(Uint8Array)
    expect(filePart.data).toEqual(testData)
    expect(filePart.mediaType).toBe('image/png')
  })

  it('fetches string URL and replaces with Uint8Array data', async () => {
    const testData = new Uint8Array([137, 80, 78, 71])
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(testData.buffer),
      headers: new Headers({ 'content-type': 'image/png' })
    })

    // After convertToModelMessages(), data is a string, not a URL instance
    const messages: ModelMessage[] = [
      userMsg([
        {
          type: 'file',
          data: 'https://example.supabase.co/storage/v1/object/public/user-uploads/test.png',
          mediaType: 'image/png'
        }
      ])
    ]

    const result = await inlineFileUrls(messages)

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toBeInstanceOf(Uint8Array)
    expect(filePart.data).toEqual(testData)
  })

  it('skips data: URL strings', async () => {
    const messages: ModelMessage[] = [
      userMsg([
        {
          type: 'file',
          data: 'data:image/png;base64,iVBORw0KGgo=',
          mediaType: 'image/png'
        }
      ])
    ]

    const result = await inlineFileUrls(messages)
    expect(result).toBe(messages)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('does not mutate the original messages', async () => {
    const testData = new Uint8Array([1, 2, 3])
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(testData.buffer),
      headers: new Headers({ 'content-type': 'image/png' })
    })

    const fileUrl = new URL('https://example.com/img.png')
    const messages: ModelMessage[] = [
      userMsg([{ type: 'file', data: fileUrl, mediaType: 'image/png' }])
    ]

    const result = await inlineFileUrls(messages)

    // Original should still have the URL
    const originalPart = (
      messages[0] as { content: Array<Record<string, unknown>> }
    ).content[0]
    expect(originalPart.data).toBe(fileUrl)

    // Result should have the binary data
    const resultPart = (
      result[0] as { content: Array<Record<string, unknown>> }
    ).content[0]
    expect(resultPart.data).toEqual(testData)
  })

  it('handles fetch failure gracefully by leaving URL as-is', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 404,
      statusText: 'Not Found'
    })

    const fileUrl = new URL('https://example.com/missing.png')
    const messages: ModelMessage[] = [
      userMsg([{ type: 'file', data: fileUrl, mediaType: 'image/png' }])
    ]

    const result = await inlineFileUrls(messages)

    // URL should remain since fetch failed
    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toBe(fileUrl)
  })

  it('handles network error gracefully', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))

    const fileUrl = new URL('https://example.com/img.png')
    const messages: ModelMessage[] = [
      userMsg([{ type: 'file', data: fileUrl, mediaType: 'image/png' }])
    ]

    const result = await inlineFileUrls(messages)

    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toBe(fileUrl)
  })

  it('fetches multiple URLs in parallel', async () => {
    const data1 = new Uint8Array([1])
    const data2 = new Uint8Array([2])

    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(data1.buffer),
        headers: new Headers({ 'content-type': 'image/png' })
      })
      .mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(data2.buffer),
        headers: new Headers({ 'content-type': 'image/jpeg' })
      })

    const messages: ModelMessage[] = [
      userMsg([
        {
          type: 'file',
          data: new URL('https://example.com/a.png'),
          mediaType: 'image/png'
        },
        { type: 'text', text: 'describe these' },
        {
          type: 'file',
          data: new URL('https://example.com/b.jpg'),
          mediaType: 'image/jpeg'
        }
      ])
    ]

    const result = await inlineFileUrls(messages)

    expect(mockFetch).toHaveBeenCalledTimes(2)
    const content = (result[0] as { content: Array<Record<string, unknown>> })
      .content
    expect(content[0].data).toEqual(data1)
    expect(content[2].data).toEqual(data2)
    // Text part should be unchanged
    expect(content[1]).toEqual({ type: 'text', text: 'describe these' })
  })

  it('skips assistant and tool messages', async () => {
    const messages: ModelMessage[] = [
      assistantMsg('I have an image'),
      userMsg([{ type: 'text', text: 'no files here' }])
    ]

    const result = await inlineFileUrls(messages)
    expect(result).toBe(messages)
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('resolves relative proxy URLs via storage download instead of fetch', async () => {
    const testData = new Uint8Array([137, 80, 78, 71])
    downloadStorageFile.mockResolvedValueOnce({
      data: testData,
      mediaType: 'image/png'
    })

    const messages: ModelMessage[] = [
      userMsg([
        {
          type: 'file',
          data: '/api/files/user-1/chats/chat-1/123-img.png',
          mediaType: 'image/png'
        }
      ])
    ]

    const result = await inlineFileUrls(messages)

    expect(downloadStorageFile).toHaveBeenCalledWith(
      'user-1/chats/chat-1/123-img.png'
    )
    expect(mockFetch).not.toHaveBeenCalled()
    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toEqual(testData)
    expect(filePart.mediaType).toBe('image/png')
  })

  it('resolves legacy public storage URLs via storage download', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://abc.supabase.co')
    const testData = new Uint8Array([1, 2, 3])
    downloadStorageFile.mockResolvedValueOnce({
      data: testData,
      mediaType: 'application/pdf'
    })

    const messages: ModelMessage[] = [
      userMsg([
        {
          type: 'file',
          data: 'https://abc.supabase.co/storage/v1/object/public/user-uploads/user-1/chats/chat-1/old.pdf',
          mediaType: 'application/pdf'
        }
      ])
    ]

    const result = await inlineFileUrls(messages)

    expect(downloadStorageFile).toHaveBeenCalledWith(
      'user-1/chats/chat-1/old.pdf'
    )
    expect(mockFetch).not.toHaveBeenCalled()
    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toEqual(testData)
  })

  it('leaves the URL in place when storage download fails', async () => {
    downloadStorageFile.mockResolvedValueOnce(null)

    const proxyUrl = '/api/files/user-1/chats/chat-1/123-img.png'
    const messages: ModelMessage[] = [
      userMsg([{ type: 'file', data: proxyUrl, mediaType: 'image/png' }])
    ]

    const result = await inlineFileUrls(messages)

    const filePart = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(filePart.data).toBe(proxyUrl)
  })

  it('handles image parts with URL data', async () => {
    const testData = new Uint8Array([1, 2, 3])
    mockFetch.mockResolvedValueOnce({
      ok: true,
      arrayBuffer: () => Promise.resolve(testData.buffer),
      headers: new Headers({ 'content-type': 'image/webp' })
    })

    const imageUrl = new URL('https://example.com/photo.webp')
    const messages: ModelMessage[] = [
      userMsg([{ type: 'image', data: imageUrl, mediaType: 'image/webp' }])
    ]

    const result = await inlineFileUrls(messages)

    const part = (result[0] as { content: Array<Record<string, unknown>> })
      .content[0]
    expect(part.data).toEqual(testData)
    expect(part.mediaType).toBe('image/webp')
  })
})

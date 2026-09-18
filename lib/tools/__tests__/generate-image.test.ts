import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock the AI SDK generateImage before importing the tool
vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateImage: vi.fn()
  }
})

// Mock server storage
vi.mock('@/lib/supabase/server-storage', () => ({
  uploadGeneratedImage: vi.fn().mockResolvedValue({
    url: 'https://storage.example.com/generated-123.png',
    filename: 'generated-123.png'
  }),
  createSignedDownloadUrl: vi
    .fn()
    .mockResolvedValue('https://storage.example.com/signed/source.png?token=t')
}))

// Mock registry
vi.mock('@/lib/utils/registry', () => ({
  getImageModel: vi.fn().mockReturnValue('mock-image-model')
}))

import { generateImage, NoImageGeneratedError } from 'ai'

import {
  createSignedDownloadUrl,
  uploadGeneratedImage
} from '@/lib/supabase/server-storage'
import { getImageModel } from '@/lib/utils/registry'

import { createGenerateImageTool } from '../generate-image'

const mockGenerateImage = vi.mocked(generateImage)
const mockGetImageModel = vi.mocked(getImageModel)

// Muse returns WebP; mirror that so the media type is carried end to end.
const museResult = {
  image: {
    mediaType: 'image/webp',
    base64: 'UklGR...',
    uint8Array: new Uint8Array([82, 73, 70, 70])
  },
  warnings: []
} as any
const mockUploadGeneratedImage = vi.mocked(uploadGeneratedImage)
const mockCreateSignedDownloadUrl = vi.mocked(createSignedDownloadUrl)

describe('createGenerateImageTool', () => {
  const context = { userId: 'user-1', chatId: 'chat-1' }
  const tool = createGenerateImageTool(context)

  beforeEach(() => {
    // Clears call history only; module-mock default implementations survive.
    vi.clearAllMocks()
  })

  it('has a description', () => {
    expect(tool.description).toBeTruthy()
  })

  it('calls generateImage with the Muse image model, a mapped size, and returns upload URL', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    const execute = tool.execute!
    const result = await execute(
      { prompt: 'a sunset over mountains', aspectRatio: '16:9' },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-1',
        messages: [],
        context: {}
      }
    )

    expect(mockGetImageModel).toHaveBeenCalledWith(
      'gateway:meta/muse-image-1.0'
    )
    // Muse ignores `aspectRatio` (it warns "use size instead"), so the tool
    // must translate the ratio into a size and never forward aspectRatio.
    expect(mockGenerateImage).toHaveBeenCalledWith({
      model: 'mock-image-model',
      prompt: 'a sunset over mountains',
      size: '1792x1024'
    })
    expect(result).toEqual(
      expect.objectContaining({
        imageUrl: 'https://storage.example.com/generated-123.png',
        mediaType: 'image/webp',
        description: 'a sunset over mountains',
        aspectRatio: '16:9'
      })
    )
  })

  it('returns error when no image is generated', async () => {
    mockGenerateImage.mockRejectedValueOnce(
      new NoImageGeneratedError({ responses: [] })
    )

    const execute = tool.execute!
    const result = await execute(
      { prompt: 'something' },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-2',
        messages: [],
        context: {}
      }
    )

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('No image')
      })
    )
  })

  it('signs own proxy-path edit sources before calling the model', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    await tool.execute!(
      {
        prompt: 'make it bluer',
        sourceImageUrl: '/api/files/user-1/chats/chat-1/generated-1.png'
      },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-sign',
        messages: [],
        context: {}
      }
    )

    expect(mockCreateSignedDownloadUrl).toHaveBeenCalledWith(
      'user-1/chats/chat-1/generated-1.png',
      expect.any(Number)
    )
    expect(mockGenerateImage).toHaveBeenCalledWith({
      model: 'mock-image-model',
      prompt: {
        text: 'make it bluer',
        images: ['https://storage.example.com/signed/source.png?token=t']
      }
    })
  })

  it('rejects edit sources owned by another user without calling the model', async () => {
    const result = await tool.execute!(
      {
        prompt: 'make it bluer',
        sourceImageUrl: '/api/files/victim-user/chats/c/generated-1.png'
      },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-forged',
        messages: [],
        context: {}
      }
    )

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('not accessible')
      })
    )
    expect(mockCreateSignedDownloadUrl).not.toHaveBeenCalled()
    expect(mockGenerateImage).not.toHaveBeenCalled()
  })

  it('requests a signed URL for guest contexts', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    const guestTool = createGenerateImageTool({
      userId: 'guest',
      chatId: 'chat-1',
      isGuest: true
    })
    await guestTool.execute!(
      { prompt: 'a sunset' },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-guest',
        messages: [],
        context: {}
      }
    )

    expect(mockUploadGeneratedImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'image/webp',
      'guest',
      'chat-1',
      { useSignedUrl: true }
    )
  })

  it('rejects guest proxy-path edit sources without signing them', async () => {
    const guestTool = createGenerateImageTool({
      userId: 'guest',
      chatId: 'chat-1',
      isGuest: true
    })

    const result = await guestTool.execute!(
      {
        prompt: 'make it bluer',
        sourceImageUrl: '/api/files/guest/chats/other-chat/generated-1.png'
      },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-guest-forged',
        messages: [],
        context: {}
      }
    )

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('not accessible')
      })
    )
    expect(mockCreateSignedDownloadUrl).not.toHaveBeenCalled()
    expect(mockGenerateImage).not.toHaveBeenCalled()
  })

  it('allows guest edit sources that are already fetchable URLs', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    const guestTool = createGenerateImageTool({
      userId: 'guest',
      chatId: 'chat-1',
      isGuest: true
    })

    await guestTool.execute!(
      {
        prompt: 'make it bluer',
        sourceImageUrl: 'https://storage.example.com/signed/source.png?token=t'
      },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-guest-edit',
        messages: [],
        context: {}
      }
    )

    expect(mockCreateSignedDownloadUrl).not.toHaveBeenCalled()
    expect(mockGenerateImage).toHaveBeenCalledWith({
      model: 'mock-image-model',
      prompt: {
        text: 'make it bluer',
        images: ['https://storage.example.com/signed/source.png?token=t']
      }
    })
  })

  it('uses the proxy URL (no signed URL) for authenticated contexts', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    await tool.execute!(
      { prompt: 'a sunset' },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-auth',
        messages: [],
        context: {}
      }
    )

    expect(mockUploadGeneratedImage).toHaveBeenLastCalledWith(
      expect.any(Uint8Array),
      'image/webp',
      'user-1',
      'chat-1',
      { useSignedUrl: undefined }
    )
  })

  it('passes the source image URL as an edit input', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    const execute = tool.execute!
    await execute(
      {
        prompt: 'make it bluer',
        sourceImageUrl: 'https://example.com/original.png'
      },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-3',
        messages: [],
        context: {}
      }
    )

    expect(mockGenerateImage).toHaveBeenCalledWith({
      model: 'mock-image-model',
      prompt: {
        text: 'make it bluer',
        images: ['https://example.com/original.png']
      }
    })
  })

  it.each([
    ['1:1', '1024x1024'],
    ['16:9', '1792x1024'],
    ['9:16', '1024x1792'],
    ['4:3', '1536x1152'],
    ['3:4', '768x1024']
  ] as const)('maps aspect ratio %s to size %s', async (aspectRatio, size) => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    await tool.execute!(
      { prompt: 'a sunset', aspectRatio },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-size',
        messages: [],
        context: {}
      }
    )

    expect(mockGenerateImage).toHaveBeenCalledWith(
      expect.objectContaining({ size })
    )
  })

  it('omits size when no aspect ratio is requested', async () => {
    mockGenerateImage.mockResolvedValueOnce(museResult)

    await tool.execute!(
      { prompt: 'a sunset' },
      {
        abortSignal: undefined as any,
        toolCallId: 'tc-nosize',
        messages: [],
        context: {}
      }
    )

    expect(mockGenerateImage.mock.calls[0][0]).not.toHaveProperty('size')
  })
})

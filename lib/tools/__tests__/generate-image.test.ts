import { describe, expect, it, vi } from 'vitest'

// Mock the AI SDK generateText before importing the tool
vi.mock('ai', async importOriginal => {
  const actual = await importOriginal<typeof import('ai')>()
  return {
    ...actual,
    generateText: vi.fn()
  }
})

// Mock server storage
vi.mock('@/lib/supabase/server-storage', () => ({
  uploadGeneratedImage: vi.fn().mockResolvedValue({
    url: 'https://storage.example.com/generated-123.png',
    filename: 'generated-123.png'
  })
}))

// Mock registry
vi.mock('@/lib/utils/registry', () => ({
  getModel: vi.fn().mockReturnValue('mock-model')
}))

import { generateText } from 'ai'

import { uploadGeneratedImage } from '@/lib/supabase/server-storage'

import { createGenerateImageTool } from '../generate-image'

const mockGenerateText = vi.mocked(generateText)
const mockUploadGeneratedImage = vi.mocked(uploadGeneratedImage)

describe('createGenerateImageTool', () => {
  const context = { userId: 'user-1', chatId: 'chat-1' }
  const tool = createGenerateImageTool(context)

  it('has a description', () => {
    expect(tool.description).toBeTruthy()
  })

  it('calls generateText with the image model and returns upload URL', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      files: [
        {
          mediaType: 'image/png',
          base64: 'iVBOR...',
          uint8Array: new Uint8Array([137, 80, 78, 71])
        }
      ]
    } as any)

    const execute = tool.execute!
    const result = await execute(
      { prompt: 'a sunset over mountains', aspectRatio: '16:9' },
      { abortSignal: undefined as any, toolCallId: 'tc-1', messages: [] }
    )

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: 'a sunset over mountains'
              })
            ])
          })
        ])
      })
    )
    expect(result).toEqual(
      expect.objectContaining({
        imageUrl: 'https://storage.example.com/generated-123.png',
        mediaType: 'image/png',
        description: 'a sunset over mountains'
      })
    )
  })

  it('returns error when no image is generated', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: 'Sorry, I cannot generate that image.',
      files: []
    } as any)

    const execute = tool.execute!
    const result = await execute(
      { prompt: 'something' },
      { abortSignal: undefined as any, toolCallId: 'tc-2', messages: [] }
    )

    expect(result).toEqual(
      expect.objectContaining({
        error: expect.stringContaining('No image')
      })
    )
  })

  it('requests a signed URL for guest contexts', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      files: [
        {
          mediaType: 'image/png',
          base64: 'iVBOR...',
          uint8Array: new Uint8Array([137, 80, 78, 71])
        }
      ]
    } as any)

    const guestTool = createGenerateImageTool({
      userId: 'guest',
      chatId: 'chat-1',
      isGuest: true
    })
    await guestTool.execute!(
      { prompt: 'a sunset' },
      { abortSignal: undefined as any, toolCallId: 'tc-guest', messages: [] }
    )

    expect(mockUploadGeneratedImage).toHaveBeenCalledWith(
      expect.any(Uint8Array),
      'image/png',
      'guest',
      'chat-1',
      { useSignedUrl: true }
    )
  })

  it('uses the proxy URL (no signed URL) for authenticated contexts', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      files: [
        {
          mediaType: 'image/png',
          base64: 'iVBOR...',
          uint8Array: new Uint8Array([137, 80, 78, 71])
        }
      ]
    } as any)

    await tool.execute!(
      { prompt: 'a sunset' },
      { abortSignal: undefined as any, toolCallId: 'tc-auth', messages: [] }
    )

    expect(mockUploadGeneratedImage).toHaveBeenLastCalledWith(
      expect.any(Uint8Array),
      'image/png',
      'user-1',
      'chat-1',
      { useSignedUrl: undefined }
    )
  })

  it('includes sourceImageUrl in content for editing', async () => {
    mockGenerateText.mockResolvedValueOnce({
      text: '',
      files: [
        {
          mediaType: 'image/png',
          base64: 'iVBOR...',
          uint8Array: new Uint8Array([137, 80, 78, 71])
        }
      ]
    } as any)

    const execute = tool.execute!
    await execute(
      {
        prompt: 'make it bluer',
        sourceImageUrl: 'https://example.com/original.png'
      },
      { abortSignal: undefined as any, toolCallId: 'tc-3', messages: [] }
    )

    expect(mockGenerateText).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            content: expect.arrayContaining([
              expect.objectContaining({
                type: 'text',
                text: 'make it bluer'
              }),
              expect.objectContaining({ type: 'image' })
            ])
          })
        ])
      })
    )
  })
})

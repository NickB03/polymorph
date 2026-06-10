import { generateText, tool } from 'ai'

import {
  storagePathFromLegacyPublicUrl,
  storagePathFromProxyUrl
} from '@/lib/supabase/file-url'
import {
  createSignedDownloadUrl,
  uploadGeneratedImage
} from '@/lib/supabase/server-storage'
import { getErrorMessage } from '@/lib/utils/error'
import { getModel } from '@/lib/utils/registry'

import type { GenerateImageError, GenerateImageOutput } from './schema'
import { inputSchema } from './schema'

const IMAGE_MODEL = 'gateway:google/gemini-2.5-flash-image'

type ImageToolContext = {
  userId: string
  chatId: string
  // Guest chats cannot be authorized by the /api/files proxy route, so their
  // generated images are returned as signed URLs instead of proxy URLs.
  isGuest?: boolean
}

const SOURCE_IMAGE_URL_TTL_SECONDS = 300

/**
 * Resolve a model-supplied source image reference to a URL the image provider
 * can fetch. Generated images are persisted as private /api/files proxy paths
 * (older outputs as public storage URLs); both are signed after verifying the
 * path belongs to the requesting user, since the model can echo arbitrary
 * paths from conversation history. Other http(s) URLs pass through unchanged.
 */
async function resolveSourceImageUrl(
  sourceImageUrl: string,
  context: ImageToolContext
): Promise<URL | null> {
  const storagePath =
    storagePathFromProxyUrl(sourceImageUrl) ??
    storagePathFromLegacyPublicUrl(sourceImageUrl)

  if (storagePath) {
    if (!storagePath.startsWith(`${context.userId}/`)) return null
    const signedUrl = await createSignedDownloadUrl(
      storagePath,
      SOURCE_IMAGE_URL_TTL_SECONDS
    )
    return signedUrl ? new URL(signedUrl) : null
  }

  try {
    return new URL(sourceImageUrl)
  } catch {
    return null
  }
}

export function createGenerateImageTool(context: ImageToolContext) {
  return tool({
    description:
      'Generate or edit an image from a text description. Use for visual content the user requests: illustrations, diagrams, photos, concept art, UI mockups, etc. For editing, provide the sourceImageUrl of a previously generated image along with the edit instructions in the prompt.',
    inputSchema,
    execute: async ({
      prompt,
      aspectRatio,
      sourceImageUrl
    }): Promise<GenerateImageOutput | GenerateImageError> => {
      try {
        const model = getModel(IMAGE_MODEL)

        // Build messages: text-only for generation, text+image for editing.
        const content: Array<
          { type: 'text'; text: string } | { type: 'image'; image: URL }
        > = [{ type: 'text', text: prompt }]

        if (sourceImageUrl) {
          const resolved = await resolveSourceImageUrl(sourceImageUrl, context)
          if (!resolved) {
            return {
              error:
                'The source image is not accessible for editing. Generate a new image instead.'
            }
          }
          content.push({ type: 'image', image: resolved })
        }

        const result = await generateText({
          model,
          messages: [{ role: 'user', content }],
          ...(aspectRatio && {
            providerOptions: { google: { aspectRatio } }
          })
        })

        const imageFile = result.files.find(f =>
          f.mediaType?.startsWith('image/')
        )

        if (!imageFile) {
          return {
            error:
              'No image was generated. The model may have declined the request. Text response: ' +
              (result.text || '(none)')
          }
        }

        const { url, filename } = await uploadGeneratedImage(
          imageFile.uint8Array,
          imageFile.mediaType ?? 'image/png',
          context.userId,
          context.chatId,
          { useSignedUrl: context.isGuest }
        )

        return {
          imageUrl: url,
          filename,
          mediaType: imageFile.mediaType ?? 'image/png',
          description: prompt,
          aspectRatio
        }
      } catch (err) {
        console.error('[generateImage] Failed:', err)
        return {
          error: 'Image generation failed: ' + getErrorMessage(err)
        }
      }
    },
    toModelOutput: ({ output }) => {
      if ('error' in output) {
        return {
          type: 'text',
          value: `Image generation failed: ${output.error}`
        }
      }
      const parts = [`Image generated successfully: "${output.description}"`]
      if (output.aspectRatio) parts.push(`(${output.aspectRatio})`)
      parts.push(
        '— the image is displayed automatically in the chat. Do NOT embed or repeat the image URL in your response.'
      )
      return { type: 'text', value: parts.join(' ') }
    }
  })
}

export const serverTool = createGenerateImageTool

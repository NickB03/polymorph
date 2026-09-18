import { trace } from '@opentelemetry/api'
import { generateImage, NoImageGeneratedError, tool } from 'ai'

import {
  storagePathFromLegacyPublicUrl,
  storagePathFromProxyUrl
} from '@/lib/supabase/file-url'
import {
  createSignedDownloadUrl,
  uploadGeneratedImage
} from '@/lib/supabase/server-storage'
import { getErrorMessage } from '@/lib/utils/error'
import { getImageModel } from '@/lib/utils/registry'

import type {
  GenerateImageError,
  GenerateImageInput,
  GenerateImageOutput
} from './schema'
import { inputSchema } from './schema'

const IMAGE_MODEL = 'gateway:meta/muse-image-1.0'

// Muse ignores `aspectRatio` (the Gateway warns "use size instead"). `size`
// acts as a ratio hint: output is snapped to ~2.4MP at the requested ratio
// (e.g. 1792x1024 -> 2016x1152). Verified live for all five ratios.
const ASPECT_RATIO_SIZES: Record<
  NonNullable<GenerateImageInput['aspectRatio']>,
  `${number}x${number}`
> = {
  '1:1': '1024x1024',
  '16:9': '1792x1024',
  '9:16': '1024x1792',
  '4:3': '1536x1152',
  '3:4': '768x1024'
}

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
    if (context.isGuest) return null
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
        let sourceImage: string | undefined
        if (sourceImageUrl) {
          const resolved = await resolveSourceImageUrl(sourceImageUrl, context)
          if (!resolved) {
            return {
              error:
                'The source image is not accessible for editing. Generate a new image instead.'
            }
          }
          // An http(s) string is forwarded as a URL file, so the Gateway
          // fetches it; this server never downloads model-supplied URLs.
          sourceImage = resolved.href
        }

        const size = aspectRatio && ASPECT_RATIO_SIZES[aspectRatio]

        // generateImage has no telemetry option; annotate the enclosing tool
        // span instead. No-op when tracing is disabled.
        trace.getActiveSpan()?.setAttributes({
          'image.model': IMAGE_MODEL,
          'image.is_edit': Boolean(sourceImage),
          ...(size && { 'image.size': size })
        })

        const { image: imageFile } = await generateImage({
          model: getImageModel(IMAGE_MODEL),
          prompt: sourceImage
            ? { text: prompt, images: [sourceImage] }
            : prompt,
          ...(size && { size })
        })

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
        if (NoImageGeneratedError.isInstance(err)) {
          return {
            error:
              'No image was generated. The model may have declined the request.'
          }
        }
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

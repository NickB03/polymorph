import { generateText, tool } from 'ai'
import { z } from 'zod'

import { uploadGeneratedImage } from '@/lib/supabase/server-storage'
import { getModel } from '@/lib/utils/registry'

const IMAGE_MODEL = 'gateway:google/gemini-2.5-flash-image'

const GenerateImageSchema = z.object({
  prompt: z
    .string()
    .min(1)
    .describe(
      'Detailed description of the image to generate. Be specific about subject, style, composition, lighting, and mood.'
    ),
  aspectRatio: z
    .enum(['1:1', '16:9', '9:16', '4:3', '3:4'])
    .optional()
    .describe(
      'Aspect ratio for the generated image. Defaults to model default if not specified.'
    ),
  sourceImageUrl: z
    .string()
    .url()
    .optional()
    .describe(
      'URL of an existing image to edit. When provided, the prompt describes the desired changes to this image.'
    )
})

export type GenerateImageInput = z.infer<typeof GenerateImageSchema>

export type GenerateImageOutput = {
  imageUrl: string
  filename: string
  mediaType: string
  description: string
  aspectRatio?: string
}

export type GenerateImageError = {
  error: string
}

type ImageToolContext = {
  userId: string
  chatId: string
}

export function createGenerateImageTool(context: ImageToolContext) {
  return tool({
    description:
      'Generate or edit an image from a text description. Use for visual content the user requests: illustrations, diagrams, photos, concept art, UI mockups, etc. For editing, provide the sourceImageUrl of a previously generated image along with the edit instructions in the prompt.',
    inputSchema: GenerateImageSchema,
    execute: async ({
      prompt,
      aspectRatio,
      sourceImageUrl
    }): Promise<GenerateImageOutput | GenerateImageError> => {
      try {
        const model = getModel(IMAGE_MODEL)

        // Build messages: text-only for generation, text+image for editing
        const content: Array<
          { type: 'text'; text: string } | { type: 'image'; image: URL }
        > = [{ type: 'text', text: prompt }]

        if (sourceImageUrl) {
          content.push({ type: 'image', image: new URL(sourceImageUrl) })
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
          context.chatId
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
          error:
            'Image generation failed: ' +
            (err instanceof Error ? err.message : String(err))
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

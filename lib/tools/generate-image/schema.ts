import { z } from 'zod'

export const toolName = 'generateImage' as const

export const inputSchema = z.object({
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

export const generateImageOutputSchema = z.object({
  // Authenticated chats return relative /api/files proxy paths; guest chats
  // return absolute signed URLs.
  imageUrl: z
    .string()
    .refine(
      value => value.startsWith('/api/files/') || /^https?:\/\//i.test(value),
      'imageUrl must be an http(s) URL or an /api/files/ path'
    ),
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  description: z.string().min(1),
  aspectRatio: z.string().optional()
})

export const generateImageErrorSchema = z.object({
  error: z.string().min(1)
})

export const outputSchema = z.union([
  generateImageOutputSchema,
  generateImageErrorSchema
])

export type GenerateImageInput = z.infer<typeof inputSchema>
export type GenerateImageOutput = z.infer<typeof generateImageOutputSchema>
export type GenerateImageError = z.infer<typeof generateImageErrorSchema>

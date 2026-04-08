import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'

export const GenerateImagePropsSchema = z.object({
  imageUrl: z.string().url(),
  filename: z.string().min(1),
  mediaType: z.string().min(1),
  description: z.string().min(1),
  aspectRatio: z.string().optional()
})

export type GenerateImageProps = z.infer<typeof GenerateImagePropsSchema>

export const SerializableGenerateImageSchema = GenerateImagePropsSchema

export type SerializableGenerateImage = z.infer<
  typeof SerializableGenerateImageSchema
>

const SerializableGenerateImageContract = defineToolUiContract(
  'GenerateImage',
  SerializableGenerateImageSchema
)

export const parseSerializableGenerateImage: (
  input: unknown
) => SerializableGenerateImage = SerializableGenerateImageContract.parse

export const safeParseSerializableGenerateImage: (
  input: unknown
) => SerializableGenerateImage | null =
  SerializableGenerateImageContract.safeParse

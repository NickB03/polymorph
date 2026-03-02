import { z } from 'zod'

import { defineToolUiContract } from '../shared/contract'
import {
  ToolUIIdSchema,
  ToolUIReceiptSchema,
  ToolUIRoleSchema
} from '../shared/schema'

export const TimelineEventCategorySchema = z.enum([
  'milestone',
  'event',
  'release',
  'announcement',
  'default'
])

export type TimelineEventCategory = z.infer<typeof TimelineEventCategorySchema>

export const TimelineEventSchema = z.object({
  id: z.string().min(1),
  date: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  category: TimelineEventCategorySchema.optional()
})

export const SerializableTimelineSchema = z
  .object({
    id: ToolUIIdSchema,
    role: ToolUIRoleSchema.optional(),
    receipt: ToolUIReceiptSchema.optional(),
    title: z.string().min(1),
    description: z.string().optional(),
    events: z.array(TimelineEventSchema).min(1)
  })
  .superRefine((value, ctx) => {
    const seenIds = new Set<string>()
    value.events.forEach((event, index) => {
      if (seenIds.has(event.id)) {
        ctx.addIssue({
          code: 'custom',
          path: ['events', index, 'id'],
          message: `Duplicate event id "${event.id}".`
        })
        return
      }
      seenIds.add(event.id)
    })
  })

export type SerializableTimeline = z.infer<typeof SerializableTimelineSchema>

export type TimelineProps = SerializableTimeline & {
  className?: string
}

const SerializableTimelineSchemaContract = defineToolUiContract(
  'Timeline',
  SerializableTimelineSchema
)

export const parseSerializableTimeline: (
  input: unknown
) => SerializableTimeline = SerializableTimelineSchemaContract.parse

export const safeParseSerializableTimeline: (
  input: unknown
) => SerializableTimeline | null = SerializableTimelineSchemaContract.safeParse

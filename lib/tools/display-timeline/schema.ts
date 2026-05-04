import { z } from 'zod'

export const toolName = 'displayTimeline' as const

const TimelineEventSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this event'),
  date: z
    .string()
    .min(1)
    .describe(
      'Date or time period label. Flexible format: "2024", "March 2024", "2024-03-15", "Q3 2023", "1990s", etc.'
    ),
  title: z.string().min(1).describe('Short headline for this event'),
  description: z
    .string()
    .optional()
    .describe('Brief supporting detail (1-2 sentences)'),
  category: z
    .enum(['milestone', 'event', 'release', 'announcement', 'default'])
    .optional()
    .describe(
      'Visual category: "milestone" for major turning points, "release" for product/version launches, "announcement" for news/reveals, "event" for notable occurrences, "default" for general entries'
    )
})

export const inputSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this timeline'),
  title: z.string().min(1).describe('Timeline heading'),
  description: z.string().optional().describe('Brief context for the timeline'),
  events: z
    .array(TimelineEventSchema)
    .min(1)
    .describe('Chronologically ordered events to display')
})

export const outputSchema = inputSchema

export type DisplayTimelineInput = z.infer<typeof inputSchema>
export type DisplayTimelineOutput = z.infer<typeof outputSchema>

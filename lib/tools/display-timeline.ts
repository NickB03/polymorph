import { tool } from 'ai'
import { z } from 'zod'

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

const DisplayTimelineSchema = z.object({
  id: z.string().min(1).describe('Unique identifier for this timeline'),
  title: z.string().min(1).describe('Timeline heading'),
  description: z.string().optional().describe('Brief context for the timeline'),
  events: z
    .array(TimelineEventSchema)
    .min(1)
    .describe('Chronologically ordered events to display')
})

export const displayTimelineTool = tool({
  description:
    'Display a vertical timeline of chronological events. Use for histories ("history of X"), event sequences ("what happened with Y"), version histories, project milestones, biographical timelines, or any temporal progression. Events should be in chronological order. Keep to 3-10 events for readability.',
  inputSchema: DisplayTimelineSchema,
  execute: async params => params
})

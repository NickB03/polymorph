'use client'

import { memo } from 'react'

import { Calendar, Flag, Megaphone, Package, Star } from 'lucide-react'

import { cn } from './_adapter'
import type { TimelineEventCategory, TimelineProps } from './schema'

const categoryConfig: Record<
  NonNullable<TimelineEventCategory>,
  {
    icon: typeof Star
    dot: string
    dateBg: string
    dateText: string
  }
> = {
  milestone: {
    icon: Star,
    dot: 'border-amber-400 bg-amber-100 dark:border-amber-500 dark:bg-amber-950',
    dateBg: 'bg-amber-50 dark:bg-amber-950/50',
    dateText: 'text-amber-700 dark:text-amber-400'
  },
  release: {
    icon: Package,
    dot: 'border-emerald-400 bg-emerald-100 dark:border-emerald-500 dark:bg-emerald-950',
    dateBg: 'bg-emerald-50 dark:bg-emerald-950/50',
    dateText: 'text-emerald-700 dark:text-emerald-400'
  },
  announcement: {
    icon: Megaphone,
    dot: 'border-violet-400 bg-violet-100 dark:border-violet-500 dark:bg-violet-950',
    dateBg: 'bg-violet-50 dark:bg-violet-950/50',
    dateText: 'text-violet-700 dark:text-violet-400'
  },
  event: {
    icon: Calendar,
    dot: 'border-blue-400 bg-blue-100 dark:border-blue-500 dark:bg-blue-950',
    dateBg: 'bg-blue-50 dark:bg-blue-950/50',
    dateText: 'text-blue-700 dark:text-blue-400'
  },
  default: {
    icon: Flag,
    dot: 'border-border bg-muted',
    dateBg: 'bg-muted/50',
    dateText: 'text-muted-foreground'
  }
}

interface TimelineEventItemProps {
  event: TimelineProps['events'][number]
  isLast: boolean
}

const TimelineEventItem = memo(function TimelineEventItem({
  event,
  isLast
}: TimelineEventItemProps) {
  const config = categoryConfig[event.category ?? 'default']
  const Icon = config.icon

  return (
    <li className="relative flex gap-4">
      {/* Connector line */}
      {!isLast && (
        <div
          className="bg-border absolute top-7 left-[11px] w-px"
          style={{ height: 'calc(100% + 0.5rem)' }}
          aria-hidden="true"
        />
      )}

      {/* Dot marker */}
      <div className="relative z-10 flex shrink-0 pt-0.5">
        <span
          className={cn(
            'flex size-6 items-center justify-center rounded-full border-2',
            config.dot
          )}
          aria-hidden="true"
        >
          <Icon className="size-3 text-current opacity-70" />
        </span>
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1 pb-6">
        <span
          className={cn(
            'inline-block rounded-md px-2 py-0.5 text-xs font-medium',
            config.dateBg,
            config.dateText
          )}
        >
          {event.date}
        </span>
        <p className="mt-1 text-sm leading-5 font-semibold">{event.title}</p>
        {event.description && (
          <p className="text-muted-foreground mt-0.5 text-sm leading-relaxed text-pretty">
            {event.description}
          </p>
        )}
      </div>
    </li>
  )
})

export const Timeline = memo(function Timeline({
  id,
  title,
  description,
  events,
  className
}: TimelineProps) {
  return (
    <section
      aria-label={title}
      data-tool-ui-id={id}
      data-slot="timeline"
      className={cn(
        'max-w-xl min-w-80 rounded-xl border px-5 py-4',
        'bg-card',
        className
      )}
    >
      <div className="mb-4">
        <h3 className="text-sm leading-5 font-semibold">{title}</h3>
        {description && (
          <p className="text-muted-foreground mt-0.5 text-sm text-pretty">
            {description}
          </p>
        )}
      </div>

      <ol className="space-y-2" aria-label="Timeline events">
        {events.map((event, index) => (
          <TimelineEventItem
            key={event.id}
            event={event}
            isLast={index === events.length - 1}
          />
        ))}
      </ol>
    </section>
  )
})

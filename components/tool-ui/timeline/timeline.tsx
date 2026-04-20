'use client'

import { memo } from 'react'

import { Calendar, Flag, Megaphone, Package, Star } from 'lucide-react'

import { StaggerList } from '@/components/motion/stagger-list'

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
    dot: 'border-warning-border bg-warning-bg',
    dateBg: 'bg-warning-bg',
    dateText: 'text-warning'
  },
  release: {
    icon: Package,
    dot: 'border-success-border bg-success-bg',
    dateBg: 'bg-success-bg',
    dateText: 'text-success'
  },
  announcement: {
    icon: Megaphone,
    dot: 'border-tip-border bg-tip-bg',
    dateBg: 'bg-tip-bg',
    dateText: 'text-tip'
  },
  event: {
    icon: Calendar,
    dot: 'border-info-border bg-info-bg',
    dateBg: 'bg-info-bg',
    dateText: 'text-info'
  },
  default: {
    icon: Flag,
    dot: 'border-border bg-muted',
    dateBg: 'bg-muted/50',
    dateText: 'text-muted-foreground'
  }
}

interface TimelineEventContentProps {
  event: TimelineProps['events'][number]
  isLast: boolean
}

const TimelineEventContent = memo(function TimelineEventContent({
  event,
  isLast
}: TimelineEventContentProps) {
  const config = categoryConfig[event.category ?? 'default']
  const Icon = config.icon

  return (
    <>
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
            'inline-block rounded-lg px-2 py-0.5 text-xs font-medium',
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
    </>
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
        'max-w-xl rounded-xl border px-5 py-4',
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

      <StaggerList
        items={events}
        getKey={event => event.id}
        className="space-y-2"
        ariaLabel="Timeline events"
        itemClassName="relative flex gap-4"
      >
        {(event, _index, isLast) => (
          <TimelineEventContent event={event} isLast={isLast} />
        )}
      </StaggerList>
    </section>
  )
})

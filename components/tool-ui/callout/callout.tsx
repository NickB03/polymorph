'use client'

import { memo } from 'react'

import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Info,
  Lightbulb,
  XCircle
} from 'lucide-react'

import { cn } from './_adapter'
import type { CalloutProps, CalloutVariant } from './schema'

const variantConfig: Record<
  CalloutVariant,
  {
    icon: typeof Info
    border: string
    bg: string
    iconColor: string
    label: string
  }
> = {
  info: {
    icon: Info,
    border: 'border-info-border',
    bg: 'bg-info-bg',
    iconColor: 'text-info',
    label: 'Information'
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-warning-border',
    bg: 'bg-warning-bg',
    iconColor: 'text-warning',
    label: 'Warning'
  },
  tip: {
    icon: Lightbulb,
    border: 'border-tip-border',
    bg: 'bg-tip-bg',
    iconColor: 'text-tip',
    label: 'Tip'
  },
  success: {
    icon: CheckCircle2,
    border: 'border-success-border',
    bg: 'bg-success-bg',
    iconColor: 'text-success',
    label: 'Success'
  },
  error: {
    icon: XCircle,
    border: 'border-error-border',
    bg: 'bg-error-bg',
    iconColor: 'text-error',
    label: 'Error'
  },
  definition: {
    icon: BookOpen,
    border: 'border-border',
    bg: 'bg-muted/50',
    iconColor: 'text-muted-foreground',
    label: 'Definition'
  }
}

export const Callout = memo(function Callout({
  id,
  variant,
  title,
  content,
  className
}: CalloutProps) {
  const config = variantConfig[variant]
  const Icon = config.icon

  return (
    <aside
      role="note"
      aria-label={title ?? config.label}
      data-tool-ui-id={id}
      data-slot="callout"
      className={cn(
        'max-w-xl rounded-xl border px-4 py-3',
        config.border,
        config.bg,
        className
      )}
    >
      <div className="flex gap-3">
        <Icon
          className={cn('mt-0.5 size-4 shrink-0', config.iconColor)}
          aria-hidden="true"
        />
        <div className="flex flex-col gap-0.5">
          {title && <p className="text-sm leading-5 font-semibold">{title}</p>}
          <p className="text-sm leading-relaxed text-pretty">{content}</p>
        </div>
      </div>
    </aside>
  )
})

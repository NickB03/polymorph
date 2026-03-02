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
    border: 'border-blue-200 dark:border-blue-500/30',
    bg: 'bg-blue-50/50 dark:bg-blue-950/30',
    iconColor: 'text-blue-600 dark:text-blue-400',
    label: 'Information'
  },
  warning: {
    icon: AlertTriangle,
    border: 'border-amber-200 dark:border-amber-500/30',
    bg: 'bg-amber-50/50 dark:bg-amber-950/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    label: 'Warning'
  },
  tip: {
    icon: Lightbulb,
    border: 'border-violet-200 dark:border-violet-500/30',
    bg: 'bg-violet-50/50 dark:bg-violet-950/30',
    iconColor: 'text-violet-600 dark:text-violet-400',
    label: 'Tip'
  },
  success: {
    icon: CheckCircle2,
    border: 'border-emerald-200 dark:border-emerald-500/30',
    bg: 'bg-emerald-50/50 dark:bg-emerald-950/30',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    label: 'Success'
  },
  error: {
    icon: XCircle,
    border: 'border-red-200 dark:border-red-500/30',
    bg: 'bg-red-50/50 dark:bg-red-950/30',
    iconColor: 'text-red-600 dark:text-red-400',
    label: 'Error'
  },
  definition: {
    icon: BookOpen,
    border: 'border-slate-200 dark:border-slate-500/30',
    bg: 'bg-slate-50/50 dark:bg-slate-800/30',
    iconColor: 'text-slate-600 dark:text-slate-400',
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
        'max-w-xl min-w-80 rounded-xl border px-4 py-3',
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

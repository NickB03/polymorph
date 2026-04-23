'use client'

import { useOptimistic, useState, useTransition } from 'react'

import { toast } from 'sonner'

import { setPreferredEvalsLayout } from '@/lib/actions/eval-preferences'
import { getTemplate } from '@/lib/evals/layout/templates'
import type { TemplateId } from '@/lib/evals/layout/types'
import type { EvalsDashboardData } from '@/lib/evals/types'

import { AlertBanner } from '@/components/evals/widgets/alert-banner'
import { LayoutRenderer } from '@/components/evals/widgets/layout-renderer'

import { TemplateSwitcher } from './template-switcher'

export function EvalsDashboardV2({
  data,
  initialLayout
}: {
  data: EvalsDashboardData
  initialLayout: TemplateId
}) {
  const [layoutId, setLayoutId] = useState<TemplateId>(initialLayout)
  const [optimisticLayoutId, setOptimisticLayoutId] = useOptimistic<
    TemplateId,
    TemplateId
  >(layoutId, (_current, next) => next)
  const [pending, startTransition] = useTransition()

  const template = getTemplate(optimisticLayoutId)

  function handleChange(next: TemplateId) {
    if (next === optimisticLayoutId) return
    startTransition(async () => {
      setOptimisticLayoutId(next)
      const result = await setPreferredEvalsLayout(next)
      if (result.success) {
        setLayoutId(next)
      } else {
        toast.error("Couldn't save layout preference", {
          description: result.error ?? 'Please try again.'
        })
      }
    })
  }

  return (
    <div className="space-y-6">
      <AlertBanner data={data} />
      <div className="flex items-center justify-end">
        <TemplateSwitcher
          value={optimisticLayoutId}
          onChange={handleChange}
          pending={pending}
        />
      </div>
      <div
        key={template.id}
        className="motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
      >
        <LayoutRenderer template={template} data={data} />
      </div>
    </div>
  )
}

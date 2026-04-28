'use client'

import { Sparkles } from 'lucide-react'

import type { TemplateId } from '@/lib/evals/layout/types'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const COPY: Record<TemplateId, { title: string; body: string }> = {
  a: {
    title: 'No health signals yet',
    body: "The evals service hasn't recorded a Traffic Monitor run. Once a run lands, system health, pass rate, and freshness will populate this board."
  },
  b: {
    title: 'Nothing to compare yet',
    body: 'This layout compares capability, regression, and traffic-monitor suites. Run at least one suite to see the side-by-side board.'
  },
  c: {
    title: 'Activity feed is quiet',
    body: "As eval runs land in Postgres, they'll stream into this feed newest-first. The next Traffic Monitor run is scheduled by Railway cron."
  }
}

const PHOENIX_URL = 'https://phoenix-production-c6b5.up.railway.app'
const RUNBOOK_URL = '/docs/operations/runbooks/day-2-operations'

export function EvalsEmptyState({ templateId }: { templateId: TemplateId }) {
  const { title, body } = COPY[templateId]
  return (
    <Card className="mx-auto w-full max-w-3xl rounded-xl shadow-xs">
      <CardContent
        className="flex flex-col items-center gap-4 px-8 py-16 text-center"
        data-testid="evals-empty-state"
        data-template-id={templateId}
      >
        <div className="rounded-full bg-accent-blue/10 p-3 text-accent-blue">
          <Sparkles aria-hidden className="h-6 w-6" />
        </div>
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="mx-auto max-w-md text-sm text-muted-foreground">
            {body}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button size="sm" asChild>
            <a href={PHOENIX_URL} rel="noreferrer" target="_blank">
              Open Phoenix
            </a>
          </Button>
          <Button size="sm" variant="outline" asChild>
            <a href={RUNBOOK_URL}>How to trigger a run</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

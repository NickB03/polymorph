import type { TemplateId } from '@/lib/evals/layout/types'

import { Card, CardContent } from '@/components/ui/card'

export function EvalsEmptyState({
  templateId: _templateId
}: {
  templateId: TemplateId
}) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center gap-2 p-12 text-center">
        <p className="text-sm font-medium">No eval runs yet</p>
        <p className="text-xs text-muted-foreground">
          The evals cron has not produced any snapshots. Trigger a run from the
          Railway dashboard to populate the dashboard.
        </p>
      </CardContent>
    </Card>
  )
}

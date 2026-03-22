import { AlertTriangle } from 'lucide-react'

import type { LegacyCanvasNotice } from '@/lib/types/canvas'

import { Button } from '@/components/ui/button'

import { useCanvas } from './canvas-context'

const SOURCE_LABELS: Record<LegacyCanvasNotice['source'], string> = {
  'chat-history': 'a previous conversation',
  'public-link': 'a shared link',
  'guest-token': 'a guest session'
}

export function CanvasLegacyNotice({ notice }: { notice: LegacyCanvasNotice }) {
  const canvas = useCanvas()

  return (
    <div
      className="flex h-full flex-col items-center justify-center gap-4 p-6 text-center"
      data-testid="canvas-legacy-notice"
    >
      <AlertTriangle className="h-10 w-10 text-muted-foreground" />
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Legacy artifact unavailable</h3>
        <p className="text-sm text-muted-foreground max-w-sm">
          This artifact was created with a previous system and is no longer
          available. It was referenced from {SOURCE_LABELS[notice.source]}.
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={() => canvas.closeWorkspace()}
        data-testid="canvas-legacy-close"
      >
        Close
      </Button>
    </div>
  )
}

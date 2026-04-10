import { Badge } from '@/components/ui/badge'

function formatDelta(delta: number) {
  const rounded = Math.round(delta * 100)
  if (rounded === 0) {
    return 'No change'
  }

  return `${rounded > 0 ? '+' : ''}${rounded}%`
}

export function DeltaBadge({ delta }: { delta: number | null }) {
  if (delta == null) {
    return (
      <Badge variant="outline" className="text-muted-foreground">
        No baseline
      </Badge>
    )
  }

  const variant = delta > 0 ? 'default' : delta < 0 ? 'destructive' : 'outline'

  return <Badge variant={variant}>{formatDelta(delta)}</Badge>
}

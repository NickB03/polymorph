import { Check, Loader2 } from 'lucide-react'

interface ResearchStatusLineProps {
  selectedLabel: string
  isStreaming: boolean
}

export function ResearchStatusLine({
  selectedLabel,
  isStreaming
}: ResearchStatusLineProps) {
  const label = selectedLabel.toLowerCase()

  if (isStreaming) {
    return (
      <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground shimmer">
        <Loader2 className="size-3.5 shrink-0 animate-spin" />
        <span>Starting {label} research...</span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 py-1.5 text-sm text-muted-foreground">
      <Check className="size-3.5 shrink-0 text-emerald-500" />
      <span>{selectedLabel}</span>
    </div>
  )
}

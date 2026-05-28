import { ArrowLeft, ArrowRight, Lock } from 'lucide-react'

import { cn } from '@/lib/utils'

interface BrowserFrameProps {
  /** URL string shown in the address bar (e.g. "https://polymorph.ai") */
  url: string
  /** Optional className to tweak the outer wrapper (e.g. height constraints) */
  className?: string
  children: React.ReactNode
}

export function BrowserFrame({ url, className, children }: BrowserFrameProps) {
  return (
    <div
      className={cn(
        'flex flex-col overflow-hidden rounded-lg border border-border bg-card shadow-xl',
        className
      )}
    >
      <div className="flex items-center gap-3 border-b border-border bg-muted/40 px-3 py-2">
        <div className="flex gap-1.5">
          <span className="size-3 rounded-full bg-[#ff5f57]" aria-hidden />
          <span className="size-3 rounded-full bg-[#febc2e]" aria-hidden />
          <span className="size-3 rounded-full bg-[#28c840]" aria-hidden />
        </div>
        <div className="flex items-center gap-1 text-muted-foreground">
          <ArrowLeft className="size-3.5" aria-hidden />
          <ArrowRight className="size-3.5" aria-hidden />
        </div>
        <div className="flex flex-1 items-center gap-1.5 rounded-md bg-background px-2.5 py-1 text-xs text-muted-foreground">
          <Lock className="size-3" aria-hidden />
          <span className="truncate">{url}</span>
        </div>
      </div>
      <div className="relative flex-1 overflow-hidden bg-background">
        {children}
      </div>
    </div>
  )
}

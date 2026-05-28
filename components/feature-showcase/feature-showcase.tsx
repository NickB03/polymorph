'use client'

import { useEffect, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle
} from '@/components/ui/dialog'

import { BuildPreview } from './previews/build-preview'
import { ChatSearchPreview } from './previews/chat-search-preview'
import { GenerativeUIPreview } from './previews/generative-ui-preview'
import { ResearchPreview } from './previews/research-preview'
import { CATEGORIES, type CategoryId } from './categories'
import { CategoryCard } from './category-card'
import { FeaturePager } from './feature-pager'

interface FeatureShowcaseProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type PreviewComponent = React.ComponentType<Record<string, never>>

const PREVIEW_BY_ID: Record<CategoryId, PreviewComponent> = {
  'chat-search': ChatSearchPreview,
  research: ResearchPreview,
  build: BuildPreview,
  'generative-ui': GenerativeUIPreview
}

export function FeatureShowcase({ open, onOpenChange }: FeatureShowcaseProps) {
  const [activeIndex, setActiveIndex] = useState(0)

  // Reset to the first category every time the modal opens so returning users start fresh.
  useEffect(() => {
    if (open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing transient view state to the open transition
      setActiveIndex(0)
    }
  }, [open])

  const active = CATEGORIES[activeIndex]
  const Preview = PREVIEW_BY_ID[active.id]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-h-[720px] max-w-5xl flex-col gap-0 overflow-hidden p-0">
        <DialogTitle className="sr-only">See what Polymorph can do</DialogTitle>
        <DialogDescription className="sr-only">
          Browse Polymorph&apos;s core capabilities — chat with search,
          multi-step research, canvas artifacts, and tool-driven generative UI.
        </DialogDescription>

        {/* Visible header — present at every breakpoint, paired with the sr-only DialogTitle for assistive tech */}
        <div className="border-b border-border px-5 py-3">
          <div className="text-base font-semibold text-foreground">
            See what Polymorph can do
          </div>
        </div>

        <div className="flex min-h-0 flex-1">
          <aside className="hidden w-72 shrink-0 flex-col gap-1.5 border-r border-border bg-muted/20 p-4 md:flex">
            {CATEGORIES.map((c, i) => (
              <CategoryCard
                key={c.id}
                title={c.title}
                description={c.description}
                Icon={c.Icon}
                active={i === activeIndex}
                onClick={() => setActiveIndex(i)}
              />
            ))}
          </aside>

          <div className="flex min-w-0 flex-1 flex-col p-4">
            <div className="flex-1 overflow-hidden rounded-lg">
              <Preview />
            </div>
          </div>
        </div>

        <FeaturePager
          activeIndex={activeIndex}
          total={CATEGORIES.length}
          onPrev={() => setActiveIndex(i => Math.max(0, i - 1))}
          onNext={() =>
            setActiveIndex(i => Math.min(CATEGORIES.length - 1, i + 1))
          }
        />
      </DialogContent>
    </Dialog>
  )
}

/*
 * Mobile note: the category aside is hidden below `md`. On phones, users navigate categories
 * exclusively via the Previous/Next pager. The visible header above remains at all breakpoints.
 *
 * shadcn `Dialog` auto-renders an X close button at top-right via `DialogPrimitive.Close` inside
 * `components/ui/dialog.tsx`. We keep it — it matches the reference design's close affordance.
 */

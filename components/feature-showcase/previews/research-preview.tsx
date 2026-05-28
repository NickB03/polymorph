import { Check, Search } from 'lucide-react'

import { BrowserFrame } from '../browser-frame'

const activitySteps = [
  'Search: cognitive reserve Alzheimer’s pathology',
  'Search: resilient brains in Alzheimer’s disease',
  'Search: neuroinflammation and cognitive resilience'
]

export function ResearchPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-1 flex-col overflow-y-auto border-r border-border">
          <div className="space-y-4 px-6 py-5">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                Why do some brains with Alzheimer&apos;s pathology stay sharp?
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-base font-semibold text-foreground">
                Brains with Alzheimer&apos;s pathology that stay sharp share
                three protections
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Some individuals harbor amyloid plaques and tau tangles yet
                maintain normal cognition — a phenomenon called{' '}
                <span className="font-medium">cognitive reserve</span> or{' '}
                <span className="font-medium">brain reserve</span>.
              </p>

              <ul className="space-y-2 text-sm leading-relaxed text-foreground">
                <li>
                  <span className="font-medium">Cognitive reserve:</span>{' '}
                  education, mental stimulation, and social engagement build
                  neural redundancy.
                </li>
                <li>
                  <span className="font-medium">
                    Reduced neuroinflammation:
                  </span>{' '}
                  resilient brains show lower microglial activation and altered
                  cytokine profiles.
                </li>
                <li>
                  <span className="font-medium">Cellular protections:</span>{' '}
                  preserved mitochondrial function and ongoing neuron growth in
                  &ldquo;superagers.&rdquo;
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border bg-card px-4 py-3">
            <div className="flex items-center justify-between rounded-full border border-border bg-background px-4 py-2.5">
              <span className="text-sm text-muted-foreground">
                Ask anything…
              </span>
              <span className="rounded-full bg-foreground px-3 py-1 text-xs font-medium text-background">
                Research
              </span>
            </div>
          </div>
        </div>

        <aside className="hidden w-56 shrink-0 flex-col bg-muted/30 md:flex">
          <div className="border-b border-border px-3 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Research Activity
          </div>
          <ul className="flex-1 space-y-2 px-3 py-3 text-xs">
            {activitySteps.map(step => (
              <li key={step} className="flex items-start gap-2 text-foreground">
                <Check
                  className="mt-0.5 size-3.5 shrink-0 text-foreground/70"
                  aria-hidden
                />
                <span className="leading-snug">{step}</span>
              </li>
            ))}
            <li className="flex items-start gap-2 text-muted-foreground">
              <Search
                className="mt-0.5 size-3.5 shrink-0 animate-pulse"
                aria-hidden
              />
              <span className="leading-snug">Synthesizing findings…</span>
            </li>
          </ul>
        </aside>
      </div>
    </BrowserFrame>
  )
}

import { ExternalLink, FileCode2 } from 'lucide-react'

import { BrowserFrame } from '../browser-frame'

export function BuildPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full overflow-hidden">
        <div className="flex w-2/5 min-w-0 flex-col border-r border-border">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                Build a modern, responsive landing page with a hero section,
                features grid, and CTA.
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm leading-relaxed text-foreground">
                I&apos;ve built a modern landing page — hero, feature grid, and
                a CTA — fully responsive with a dark theme.
              </p>

              <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-3 py-2.5">
                <div className="flex size-8 items-center justify-center rounded-md bg-muted">
                  <FileCode2
                    className="size-4 text-muted-foreground"
                    aria-hidden
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium text-foreground">
                    Vibrant Modern Landing Page
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Canvas · Interactive
                  </div>
                </div>
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background px-2.5 py-1 text-xs font-medium">
                  Open <ExternalLink className="size-3" aria-hidden />
                </span>
              </div>
            </div>
          </div>

          <div className="border-t border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between rounded-full border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Ask anything…
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Build
              </span>
            </div>
          </div>
        </div>

        {/* Generic landing page — no fictional brand name. The mark is an abstract gradient square. */}
        <div
          className="relative flex-1 overflow-hidden bg-[#0b0b14]"
          aria-hidden
        >
          <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5 text-white">
            <div className="flex items-center gap-2">
              <div className="size-6 rounded-md bg-gradient-to-br from-indigo-400 to-purple-500" />
              <span className="text-sm font-semibold">Landing Page</span>
            </div>
            <div className="hidden gap-4 text-xs text-white/70 md:flex">
              <span>Features</span>
              <span>Pricing</span>
              <span>Docs</span>
              <span className="rounded-md bg-white px-3 py-1 font-medium text-[#0b0b14]">
                Sign Up
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center px-6 py-8 text-center">
            <span className="mb-4 rounded-full bg-white/10 px-3 py-1 text-[10px] font-medium uppercase tracking-wider text-white/80">
              Now with AI-powered workflows
            </span>
            <div className="text-2xl font-bold text-white md:text-3xl">
              Ship Faster with{' '}
              <span className="bg-gradient-to-r from-pink-400 to-purple-400 bg-clip-text text-transparent">
                Playful Precision
              </span>
            </div>
            <p className="mt-3 max-w-md text-sm text-white/70">
              A modern landing page generated as a canvas artifact — fully
              responsive, dark-themed, and editable in place.
            </p>
            <div className="mt-5 flex gap-3">
              <span className="rounded-md bg-gradient-to-r from-indigo-500 to-purple-600 px-4 py-2 text-sm font-medium text-white">
                Get Started Free →
              </span>
              <span className="rounded-md border border-white/20 px-4 py-2 text-sm font-medium text-white">
                Watch Demo
              </span>
            </div>
          </div>
        </div>
      </div>
    </BrowserFrame>
  )
}

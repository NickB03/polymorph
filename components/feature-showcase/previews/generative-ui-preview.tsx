import { MapPin } from 'lucide-react'

import { cn } from '@/lib/utils'

import { BrowserFrame } from '../browser-frame'

const pins = [
  { label: 'Bishop Arts', x: 22, y: 60 },
  { label: 'Knox-Henderson', x: 55, y: 35 },
  { label: 'Deep Ellum', x: 70, y: 55 },
  { label: 'Lower Greenville', x: 80, y: 30 },
  { label: 'Uptown', x: 45, y: 25 }
]

export function GenerativeUIPreview() {
  return (
    <BrowserFrame url="https://polymorph.ai" className="h-full">
      <div className="flex h-full overflow-hidden">
        <div className="flex w-2/5 min-w-0 flex-col border-r border-border">
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
            <div className="flex justify-end">
              <div className="max-w-[90%] rounded-2xl bg-muted px-4 py-2.5 text-sm text-foreground">
                What are the best Italian restaurants in Dallas, TX?
              </div>
            </div>

            <div className="space-y-3">
              <div className="text-base font-semibold text-foreground">
                Best Italian in Dallas
              </div>
              <p className="text-sm leading-relaxed text-foreground">
                Dallas has a deep Italian scene — Bishop Arts mainstays, Lower
                Greenville wood-fired concepts, and new Knox-Henderson tasting
                menus.
              </p>
              <ul className="space-y-1.5 text-sm leading-relaxed text-foreground">
                <li>
                  <span className="font-medium">Lucia</span> · Bishop Arts ·
                  seasonal pastas
                </li>
                <li>
                  <span className="font-medium">Partenope Ristorante</span> ·
                  Downtown · Neapolitan
                </li>
                <li>
                  <span className="font-medium">Carbone</span> · Knox-Henderson
                  · NYC import
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-border bg-card px-3 py-3">
            <div className="flex items-center justify-between rounded-full border border-border bg-background px-3 py-2">
              <span className="text-xs text-muted-foreground">
                Ask anything…
              </span>
              <span className="rounded-full bg-muted px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Research
              </span>
            </div>
          </div>
        </div>

        <div
          className="relative flex-1 overflow-hidden bg-gradient-to-br from-slate-200 via-slate-100 to-slate-200 dark:from-slate-800 dark:via-slate-900 dark:to-slate-800"
          aria-hidden
        >
          <div
            className="absolute inset-0 opacity-30"
            style={{
              backgroundImage:
                'linear-gradient(to right, rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(0,0,0,0.05) 1px, transparent 1px)',
              backgroundSize: '40px 40px'
            }}
          />
          {pins.map(pin => (
            <div
              key={pin.label}
              className={cn(
                'absolute flex -translate-x-1/2 -translate-y-full flex-col items-center'
              )}
              style={{ left: `${pin.x}%`, top: `${pin.y}%` }}
            >
              <span className="rounded-md bg-foreground px-2 py-0.5 text-[10px] font-medium text-background shadow-sm">
                {pin.label}
              </span>
              <MapPin className="size-5 fill-red-500 stroke-red-700 drop-shadow-sm" />
            </div>
          ))}
        </div>
      </div>
    </BrowserFrame>
  )
}

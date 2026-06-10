'use client'

import { HelpCircle } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'

export function CarsearchHeader() {
  return (
    <header className="border-b border-zinc-200 bg-white">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="mb-3 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Personal EV shortlist
          </div>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            EV options for your commute
          </h1>
          <p className="mt-3 max-w-2xl text-base leading-7 text-zinc-600 sm:text-lg">
            Cars that fit what you drive every day: AWD, the safety help you
            like, and enough range for Frisco to Fort Worth and back.
          </p>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-sky-200 bg-sky-50 p-4 text-sky-950 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm leading-6">
            <strong>Your daily drive:</strong> Home to Cook Children&apos;s is
            about 50 miles each way, close to 30,000 miles a year.
          </div>
          <Dialog>
            <DialogTrigger asChild>
              <Button
                className="min-h-11 shrink-0 border-sky-300 bg-white text-sky-950 hover:bg-sky-100 hover:text-sky-950"
                variant="outline"
              >
                <HelpCircle aria-hidden className="h-4 w-4" />
                Why these cars?
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-xl border-zinc-200 bg-white text-zinc-950">
              <DialogHeader>
                <DialogTitle>Why these specific cars?</DialogTitle>
                <DialogDescription className="text-zinc-600">
                  The shortlist is tuned for a high-mileage Dallas-Fort Worth
                  commute, not a generic EV search.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm leading-6 text-zinc-700">
                <p>
                  <strong>
                    You drive 50 miles each way to Cook Children&apos;s.
                  </strong>{' '}
                  That is a lot of daily EV use, so the list favors cars with
                  comfortable range and predictable home charging.
                </p>
                <p>
                  <strong>All-wheel drive.</strong> The default filter keeps the
                  same rainy-weather confidence you wanted from the XC90.
                </p>
                <p>
                  <strong>Driver assist that is actually useful.</strong> Volvos
                  and Polestars are labeled around Pilot Assist. Fords are
                  labeled around BlueCruise.
                </p>
                <p>
                  <strong>Clean history and reasonable economics.</strong> Lemon
                  listings are hidden by default, and top picks are promoted for
                  price, miles, warranty, range, and distance.
                </p>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </header>
  )
}

'use client'

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 pb-8 pt-20 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-6 w-48 rounded-md" />
            <Skeleton className="h-4 w-72 rounded-md" />
          </div>
          <Skeleton className="h-8 w-44 rounded-md" />
        </div>

        <div className="grid grid-cols-12 gap-4">
          <Skeleton className="col-span-12 h-24 rounded-xl" />
          <Skeleton className="col-span-12 h-20 rounded-xl md:col-span-6" />
          <Skeleton className="col-span-12 h-20 rounded-xl md:col-span-6" />
          <Skeleton className="col-span-12 h-64 rounded-xl" />
          <Skeleton className="col-span-12 h-96 rounded-xl" />
        </div>
      </div>
    </div>
  )
}

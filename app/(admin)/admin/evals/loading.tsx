'use client'

import { Skeleton } from '@/components/ui/skeleton'

export default function Loading() {
  return (
    <div className="flex flex-1 min-h-0 min-w-0 overflow-y-auto">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-10 px-4 pb-16 pt-12 sm:px-8 lg:px-12">
        <div className="border-b border-border/60 pb-6">
          <Skeleton className="mb-3 h-3 w-40 rounded" />
          <Skeleton className="mb-3 h-12 w-72 rounded-md" />
          <Skeleton className="h-4 w-full max-w-xl rounded" />
        </div>
        <div className="grid grid-cols-2 gap-6 lg:grid-cols-4">
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
          <Skeleton className="h-24 rounded-md" />
        </div>
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <Skeleton className="h-96 rounded-2xl lg:col-span-4" />
          <Skeleton className="h-96 rounded-2xl lg:col-span-8" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
        <Skeleton className="h-72 rounded-2xl" />
      </div>
    </div>
  )
}

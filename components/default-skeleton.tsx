'use client'

import { Skeleton, SkeletonBlock } from './ui/skeleton'

export function DefaultSkeleton() {
  return (
    <Skeleton
      name="default-loading"
      loading
      fallback={
        <div className="flex flex-col gap-2 pb-4 pt-2">
          {[...Array(2)].map((_, index) => (
            <SkeletonBlock key={index} className="h-6 w-full" />
          ))}
        </div>
      }
    >
      <div className="flex flex-col gap-2 pb-4 pt-2">
        <div className="h-6 w-full" />
        <div className="h-6 w-full" />
      </div>
    </Skeleton>
  )
}

export function SearchSkeleton() {
  return (
    <Skeleton
      name="search-loading"
      loading
      fallback={
        <div className="flex flex-wrap gap-2 pb-0.5">
          {[...Array(4)].map((_, index) => (
            <div
              key={index}
              className="w-[calc(50%-0.5rem)] md:w-[calc(25%-0.5rem)]"
            >
              <SkeletonBlock
                className="h-20 w-full"
                style={{ animationDelay: `${index * 100}ms` }}
              />
            </div>
          ))}
        </div>
      }
    >
      <div className="flex flex-wrap gap-2 pb-0.5">
        {[...Array(4)].map((_, index) => (
          <div
            key={index}
            className="w-[calc(50%-0.5rem)] md:w-[calc(25%-0.5rem)]"
          >
            <div className="h-20 w-full" />
          </div>
        ))}
      </div>
    </Skeleton>
  )
}

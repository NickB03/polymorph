import { Skeleton } from 'boneyard-js/react'

import { cn } from '@/lib/utils/index'

function SkeletonBlock({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('skeleton-shimmer rounded-md', className)} {...props} />
  )
}

export { Skeleton, SkeletonBlock }

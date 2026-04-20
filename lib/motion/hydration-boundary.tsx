'use client'

import { createContext, type ReactNode, useContext, useState } from 'react'

const HydrationSnapshot = createContext<ReadonlySet<string>>(new Set())

export function HydrationAnimationProvider({
  initialPartIds,
  children
}: {
  initialPartIds: string[]
  children: ReactNode
}) {
  const [seen] = useState(() => new Set(initialPartIds))
  return (
    <HydrationSnapshot.Provider value={seen}>
      {children}
    </HydrationSnapshot.Provider>
  )
}

export function useIsNewPart(partId: string): boolean {
  const seen = useContext(HydrationSnapshot)
  return !seen.has(partId)
}

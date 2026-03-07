'use client'

import { ReactNode } from 'react'

import { ActivityProvider } from './activity-context'

export default function ActivityRoot({ children }: { children: ReactNode }) {
  return <ActivityProvider>{children}</ActivityProvider>
}

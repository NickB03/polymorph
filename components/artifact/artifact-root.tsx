'use client'

import { ReactNode } from 'react'

import { ActivityProvider } from '@/components/activity/activity-context'

import { ArtifactProvider } from './artifact-context'
import { ChatArtifactContainer } from './chat-artifact-container'

export default function ArtifactRoot({ children }: { children: ReactNode }) {
  return (
    <ArtifactProvider>
      <ActivityProvider>
        <ChatArtifactContainer>{children}</ChatArtifactContainer>
      </ActivityProvider>
    </ArtifactProvider>
  )
}

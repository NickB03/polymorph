'use client'

import { ActivityProvider } from '@/components/activity/activity-context'

import { CanvasProvider } from './canvas-context'
import { ChatCanvasShell } from './chat-canvas-shell'

/**
 * Root provider for the canvas namespace. Wraps all required context
 * providers and the split-pane shell layout.
 */
export function CanvasRoot({ children }: { children: React.ReactNode }) {
  return (
    <CanvasProvider>
      <ActivityProvider>
        <ChatCanvasShell>{children}</ChatCanvasShell>
      </ActivityProvider>
    </CanvasProvider>
  )
}

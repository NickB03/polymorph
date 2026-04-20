'use client'

import { useParams } from 'next/navigation'

import { ActivityProvider } from '@/components/activity/activity-context'

import { CanvasProvider } from './canvas-context'
import { ChatCanvasShell } from './chat-canvas-shell'

/**
 * Root provider for the canvas namespace. Wraps all required context
 * providers and the split-pane shell layout.
 *
 * CanvasProvider is keyed on the current chat id so that canvas and
 * activity state never leaks across chat swaps. Without the key, the
 * layout-persistent providers retain the previous chat's artifact and
 * activity state (and any in-flight openCanvasArtifact fetch would
 * still land on the current instance). Remounting the provider subtree
 * gives each chat an isolated state scope and orphans any pending
 * fetch's state setters from the previous chat.
 */
export function CanvasRoot({ children }: { children: React.ReactNode }) {
  const params = useParams<{ id?: string }>()
  const chatKey = (typeof params?.id === 'string' && params.id) || 'new'

  return (
    <CanvasProvider key={chatKey}>
      <ActivityProvider>
        <ChatCanvasShell>{children}</ChatCanvasShell>
      </ActivityProvider>
    </CanvasProvider>
  )
}

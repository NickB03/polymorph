'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { useMediaQuery } from '@/lib/hooks/use-media-query'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'

import { useArtifact } from '@/components/artifact/artifact-context'

import { InspectorPanel } from './inspector-panel'

export function InspectorDrawer() {
  const { state, close } = useArtifact()
  const part = state.inspectedPart
  const isMobile = useMediaQuery('(max-width: 767px)')

  // Function to get the title based on part type (mirrors ArtifactPanel logic)
  const getTitle = () => {
    if (!part) return 'Artifact' // Default title
    switch (part.type) {
      case 'tool-search':
        return 'search'
      case 'tool-fetch':
        return 'fetch'
      case 'reasoning':
        return 'Thoughts'
      case 'text':
        return 'Text'
      default:
        return 'Content'
    }
  }

  // Don't show inspector drawer when workspace is open or not on mobile
  if (!isMobile || state.workspace.isOpen) return null

  const isOpen = part !== null

  return (
    <Drawer
      open={isOpen}
      onOpenChange={open => {
        if (!open) close()
      }}
      modal={true}
    >
      <DrawerContent className="p-0 max-h-[90vh] md:hidden">
        <DrawerTitle asChild>
          <VisuallyHidden>{getTitle()}</VisuallyHidden>
        </DrawerTitle>
        <InspectorPanel />
      </DrawerContent>
    </Drawer>
  )
}

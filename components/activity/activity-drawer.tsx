'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { useMediaQuery } from '@/lib/hooks/use-media-query'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'

import { useActivity } from './activity-context'
import { ActivityPanel } from './activity-panel'

export function ActivityDrawer() {
  const { state, close } = useActivity()
  const isMobile = useMediaQuery('(max-width: 767px)')

  if (!isMobile) return null

  return (
    <Drawer
      open={state.isOpen}
      onOpenChange={open => {
        if (!open) close()
      }}
      modal={true}
    >
      <DrawerContent className="p-0 max-h-[90vh] md:hidden">
        <DrawerTitle asChild>
          <VisuallyHidden>Research Activity</VisuallyHidden>
        </DrawerTitle>
        <ActivityPanel />
      </DrawerContent>
    </Drawer>
  )
}

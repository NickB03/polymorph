'use client'

import { VisuallyHidden } from '@radix-ui/react-visually-hidden'

import { useIsMobile } from '@/hooks/use-mobile'

import { Drawer, DrawerContent, DrawerTitle } from '@/components/ui/drawer'

import { useActivity } from './activity-context'
import { ActivityPanel } from './activity-panel'

export function ActivityDrawer() {
  const { state, close } = useActivity()
  const isMobile = useIsMobile()

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

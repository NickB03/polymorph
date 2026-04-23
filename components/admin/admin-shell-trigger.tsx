'use client'

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

export function AdminShellTrigger() {
  const { open, isMobile } = useSidebar()

  if (open && !isMobile) {
    return null
  }

  return (
    <div className="absolute left-3 top-3 z-20">
      <SidebarTrigger className="animate-fade-in border bg-background/80 shadow-sm backdrop-blur-sm" />
    </div>
  )
}

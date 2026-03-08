'use client'

import { Suspense, useCallback } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { Plus } from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarTrigger,
  useSidebar
} from '@/components/ui/sidebar'

import { ChatHistoryClient } from './sidebar/chat-history-client'
import { ChatHistorySkeleton } from './sidebar/chat-history-skeleton'

export default function AppSidebar({ hasUser = false }: { hasUser?: boolean }) {
  const router = useRouter()
  const { setOpenMobile, isMobile } = useSidebar()

  const navigateHome = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      if (isMobile) setOpenMobile(false)
      window.dispatchEvent(new CustomEvent('new-chat-requested'))
      router.push('/')
    },
    [router, isMobile, setOpenMobile]
  )

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row justify-between items-center">
        <a
          href="/"
          onClick={navigateHome}
          className="flex items-center px-2 py-3"
        >
          <Image
            src="/images/polymorph-sidebar-logo-darkm.png"
            alt="Polymorph"
            width={261}
            height={160}
            className="h-6 w-auto block dark:hidden"
          />
          <Image
            src="/images/polymorph-sidebar-logo.png"
            alt="Polymorph"
            width={261}
            height={160}
            className="h-6 w-auto hidden dark:block"
          />
        </a>
        <SidebarTrigger />
      </SidebarHeader>
      <SidebarContent className="flex flex-col px-2 py-4 h-full">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <a
                href="/"
                onClick={navigateHome}
                className="flex items-center gap-2"
              >
                <Plus className="size-4" />
                <span>New</span>
              </a>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        {hasUser ? (
          <div className="flex-1 overflow-y-auto">
            <Suspense fallback={<ChatHistorySkeleton />}>
              <ChatHistoryClient />
            </Suspense>
          </div>
        ) : null}

        {!hasUser ? (
          <div className="mt-auto px-2 py-4 text-xs text-muted-foreground">
            <p>Enjoying the chat?</p>
            <Link
              href="/auth/login"
              className="text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Sign in to save your chat history
            </Link>
          </div>
        ) : null}
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  )
}

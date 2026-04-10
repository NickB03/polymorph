'use client'

// import Link from 'next/link' // No longer needed directly here for Sign In button
import React, { useState } from 'react'
import { usePathname } from 'next/navigation'

import { User } from '@supabase/supabase-js'

import { cn } from '@/lib/utils'

import { SidebarTrigger, useSidebar } from '@/components/ui/sidebar'

import { FeedbackModal } from './feedback-modal'
// import { Button } from './ui/button' // No longer needed directly here for Sign In button
import GuestMenu from './guest-menu' // Import the new GuestMenu component
import UserMenu from './user-menu'

interface HeaderProps {
  user: User | null
  isAdmin: boolean
}

export const Header: React.FC<HeaderProps> = ({ user, isAdmin }) => {
  const { open, isMobile } = useSidebar()
  const pathname = usePathname()
  const [feedbackOpen, setFeedbackOpen] = useState(false)
  const isRootPage = pathname === '/'
  const isAuthPage = pathname.startsWith('/auth/')

  return (
    <>
      {!isAuthPage && (
        <header
          className={cn(
            'absolute top-0 right-0 p-3 flex justify-between items-center z-10 backdrop-blur-sm lg:backdrop-blur-none bg-background/80 lg:bg-transparent transition-[width] duration-200 ease-linear',
            open ? 'md:w-[calc(100%-var(--sidebar-width))]' : 'md:w-full',
            'w-full'
          )}
        >
          <div>
            {(!open || isMobile) && (
              <SidebarTrigger className="animate-fade-in" />
            )}
          </div>

          <div className="flex items-center gap-2">
            {user ? (
              <UserMenu
                user={user}
                isAdmin={isAdmin}
                onFeedbackClick={
                  isRootPage ? () => setFeedbackOpen(true) : undefined
                }
              />
            ) : (
              <GuestMenu
                onFeedbackClick={
                  isRootPage ? () => setFeedbackOpen(true) : undefined
                }
              />
            )}
          </div>
        </header>
      )}

      {isRootPage && (
        <FeedbackModal open={feedbackOpen} onOpenChange={setFeedbackOpen} />
      )}
    </>
  )
}

export default Header

'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'

import { EllipsisVertical, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { deleteChat } from '@/lib/actions/chat'
import { Chat as DBChat } from '@/lib/db/schema'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import {
  SidebarMenuAction,
  SidebarMenuButton,
  SidebarMenuItem
} from '@/components/ui/sidebar'

import { Spinner } from '../ui/spinner'

interface ChatMenuItemProps {
  chat: DBChat
}

export function ChatMenuItem({ chat }: ChatMenuItemProps) {
  const pathname = usePathname()
  const path = `/search/${chat.id}`
  const isActive = pathname === path
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [isAlertOpen, setIsAlertOpen] = useState(false)

  const handleDeleteChat = useCallback(() => {
    startTransition(async () => {
      const result = await deleteChat(chat.id)

      if (result?.success) {
        toast.success('Chat deleted')
        if (isActive) {
          router.push('/')
        }
        window.dispatchEvent(new CustomEvent('chat-history-updated'))
      } else if (result?.error) {
        toast.error(result.error)
      } else {
        toast.error('An unexpected error occurred while deleting the chat.')
      }
      setIsAlertOpen(false)
      setIsMenuOpen(false)
    })
  }, [chat.id, isActive, router, startTransition])

  const handleAlertOpenChange = useCallback(
    (open: boolean) => {
      setIsAlertOpen(open)
      if (!open && !isPending) {
        setIsMenuOpen(false)
      }
    },
    [isPending, setIsMenuOpen, setIsAlertOpen]
  )

  const handleMenuOpenChange = useCallback(
    (open: boolean) => {
      setIsMenuOpen(open)
      if (!open && !isPending) {
        setIsAlertOpen(false)
      }
    },
    [isPending, setIsMenuOpen, setIsAlertOpen]
  )

  return (
    <SidebarMenuItem>
      <SidebarMenuButton asChild isActive={isActive} className="pr-8">
        <Link href={path}>
          <span className="text-xs font-medium truncate select-none">
            {chat.title}
          </span>
        </Link>
      </SidebarMenuButton>

      <DropdownMenu open={isMenuOpen} onOpenChange={handleMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <SidebarMenuAction
            showOnHover
            className="size-8 p-1.5 mr-1 overflow-hidden"
          >
            <EllipsisVertical size={13} />
            <span className="sr-only">Chat Actions</span>
          </SidebarMenuAction>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start">
          <AlertDialog open={isAlertOpen} onOpenChange={handleAlertOpenChange}>
            <AlertDialogTrigger asChild>
              <DropdownMenuItem
                className="gap-2 text-destructive focus:text-destructive"
                onSelect={e => {
                  e.preventDefault()
                }}
              >
                <Trash2 size={14} />
                Delete Chat
              </DropdownMenuItem>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                <AlertDialogDescription>
                  This action cannot be undone. This will permanently delete
                  this chat history.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isPending}>
                  Cancel
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={isPending}
                  onClick={event => {
                    event.preventDefault()
                    handleDeleteChat()
                  }}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {isPending ? (
                    <div className="flex items-center justify-center">
                      <Spinner />
                    </div>
                  ) : (
                    'Delete'
                  )}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </DropdownMenuContent>
      </DropdownMenu>
    </SidebarMenuItem>
  )
}

'use client'

import { useCallback, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

import { User } from '@supabase/supabase-js'
import {
  ChartColumnIncreasing,
  Link2,
  LogOut,
  MessageSquare,
  Palette,
  Trash2
} from 'lucide-react'
import { toast } from 'sonner'

import { clearChats } from '@/lib/actions/chat'
import { createClient } from '@/lib/supabase/client'

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
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'

import { Button } from './ui/button'
import { Spinner } from './ui/spinner'
import { ExternalLinkItems } from './external-link-items'
import { ThemeMenuItems } from './theme-menu-items'

interface UserMenuProps {
  user: User
  isAdmin: boolean
  onFeedbackClick?: () => void
}

const USER_MENU_TRIGGER_ID = 'user-menu-trigger'

export default function UserMenu({
  user,
  isAdmin,
  onFeedbackClick
}: UserMenuProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [isClearAlertOpen, setIsClearAlertOpen] = useState(false)

  const handleClearHistory = useCallback(() => {
    startTransition(async () => {
      const res = await clearChats()
      if (res?.success) {
        toast.success('History cleared')
        router.push('/')
        window.dispatchEvent(new CustomEvent('chat-history-updated'))
      } else if (res?.error) {
        toast.error(res.error)
      }
      setIsClearAlertOpen(false)
    })
  }, [router])

  const userName =
    user.user_metadata?.full_name || user.user_metadata?.name || 'User'
  const avatarUrl =
    user.user_metadata?.avatar_url || user.user_metadata?.picture

  const getInitials = (name: string, email: string | undefined) => {
    if (name && name !== 'User') {
      const names = name.split(' ').filter(Boolean)
      if (names.length > 1) {
        return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase()
      }
      return name.substring(0, 2).toUpperCase()
    }
    if (email) {
      return email.split('@')[0].substring(0, 2).toUpperCase()
    }
    return 'U'
  }

  const handleLogout = async () => {
    try {
      const supabase = createClient()
      await supabase.auth.signOut()
      router.push('/')
      router.refresh()
    } catch (error) {
      console.error('Error logging out:', error)
      router.push('/')
      router.refresh()
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          id={USER_MENU_TRIGGER_ID}
          variant="ghost"
          size="icon"
          className="relative rounded-full"
        >
          <Avatar className="h-6 w-6">
            <AvatarImage src={avatarUrl} alt={userName} />
            <AvatarFallback>{getInitials(userName, user.email)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-60" align="end" forceMount>
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            <p className="text-sm font-medium leading-none truncate">
              {userName}
            </p>
            <p className="text-xs leading-none text-muted-foreground truncate">
              {user.email}
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Palette className="mr-2 h-4 w-4" />
            <span>Theme</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ThemeMenuItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Link2 className="mr-2 h-4 w-4" />
            <span>Links</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <ExternalLinkItems />
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        {onFeedbackClick ? (
          <DropdownMenuItem onClick={onFeedbackClick}>
            <MessageSquare className="mr-2 h-4 w-4" />
            <span>Feedback</span>
          </DropdownMenuItem>
        ) : null}
        <AlertDialog open={isClearAlertOpen} onOpenChange={setIsClearAlertOpen}>
          <AlertDialogTrigger asChild>
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={e => e.preventDefault()}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              <span>Clear History</span>
            </DropdownMenuItem>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This action cannot be undone. It will permanently delete your
                history.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                disabled={isPending}
                onClick={e => {
                  e.preventDefault()
                  handleClearHistory()
                }}
              >
                {isPending ? <Spinner /> : 'Clear'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
        {isAdmin ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Admin</DropdownMenuLabel>
            <DropdownMenuItem asChild>
              <Link href="/admin/evals">
                <ChartColumnIncreasing className="mr-2 h-4 w-4" />
                <span>Evals</span>
              </Link>
            </DropdownMenuItem>
          </>
        ) : null}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout}>
          <LogOut className="mr-2 h-4 w-4" />
          <span>Logout</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

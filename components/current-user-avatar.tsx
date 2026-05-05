'use client'

import { User2 } from 'lucide-react'

import { useCurrentUser } from '@/hooks/use-current-user'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export const CurrentUserAvatar = () => {
  const { name, image } = useCurrentUser()
  const initials = name
    ?.split(' ')
    ?.filter(Boolean)
    ?.map(word => word[0])
    ?.join('')
    ?.toUpperCase()

  return (
    <Avatar className="size-7">
      {image && <AvatarImage src={image} alt={initials} />}
      <AvatarFallback className="bg-primary text-[0.6875rem] font-semibold leading-none text-primary-foreground ring-1 ring-border/60">
        {initials === '?' ? (
          <User2 size={16} className="text-primary-foreground" />
        ) : (
          initials
        )}
      </AvatarFallback>
    </Avatar>
  )
}

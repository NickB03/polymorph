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
    <Avatar className="size-6">
      {image && <AvatarImage src={image} alt={initials} />}
      <AvatarFallback>
        {initials === '?' ? (
          <User2 size={16} className="text-muted-foreground" />
        ) : (
          initials
        )}
      </AvatarFallback>
    </Avatar>
  )
}

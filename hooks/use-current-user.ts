import { useEffect, useState } from 'react'

import { createClient } from '@/lib/supabase/client'

interface CurrentUser {
  name: string
  image: string | null
}

export function useCurrentUser(): CurrentUser {
  const [user, setUser] = useState<CurrentUser>({ name: '?', image: null })

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const { data, error } = await createClient().auth.getSession()
        if (error) {
          console.error(error)
        }
        const metadata = data.session?.user.user_metadata
        setUser({
          name: metadata?.full_name ?? '?',
          image: metadata?.avatar_url ?? null
        })
      } catch {
        setUser({ name: 'Anonymous', image: null })
      }
    }

    fetchUser()
  }, [])

  return user
}

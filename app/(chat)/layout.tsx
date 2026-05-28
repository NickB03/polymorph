import { isAdminUserId } from '@/lib/auth/is-admin'
import { createClient } from '@/lib/supabase/server'

import { SidebarProvider } from '@/components/ui/sidebar'

import AppSidebar from '@/components/app-sidebar'
import { CanvasRoot } from '@/components/canvas/canvas-root'
import { FeatureShowcaseHost } from '@/components/feature-showcase'
import Header from '@/components/header'

export default async function ChatLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null
  let isAdmin = false
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
    isAdmin = isAdminUserId(supabaseUser?.id)
  }

  return (
    <SidebarProvider defaultOpen>
      <AppSidebar hasUser={!!user} />
      <div className="flex flex-col flex-1 min-w-0">
        <Header user={user} isAdmin={isAdmin} />
        <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          <CanvasRoot>{children}</CanvasRoot>
        </main>
      </div>
      <FeatureShowcaseHost />
    </SidebarProvider>
  )
}

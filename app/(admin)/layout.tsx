import { notFound, redirect } from 'next/navigation'

import { getCurrentUser } from '@/lib/auth/get-current-user'
import { isAdminUserId } from '@/lib/auth/is-admin'

import { SidebarProvider } from '@/components/ui/sidebar'

import { AdminSidebar } from '@/components/admin/admin-sidebar'

export const dynamic = 'force-dynamic'

export default async function AdminLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  const user = await getCurrentUser()

  if (!user) {
    redirect('/auth/login')
    return null
  }

  if (!isAdminUserId(user.id)) {
    notFound()
    return null
  }

  return (
    <SidebarProvider defaultOpen>
      <AdminSidebar />
      <div className="flex flex-col flex-1 min-w-0">
        <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}

'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Activity,
  ChartColumnIncreasing,
  Flag,
  Gauge,
  MessageSquare,
  Settings,
  Sparkles,
  Users
} from 'lucide-react'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail
} from '@/components/ui/sidebar'

type AdminNavItem = {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
  disabled?: boolean
}

const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { label: 'Evals', href: '/admin/evals', icon: ChartColumnIncreasing },
  { label: 'Users', href: '/admin/users', icon: Users, disabled: true },
  { label: 'Usage', href: '/admin/usage', icon: Gauge, disabled: true },
  {
    label: 'Feedback',
    href: '/admin/feedback',
    icon: MessageSquare,
    disabled: true
  },
  { label: 'Traffic', href: '/admin/traffic', icon: Activity, disabled: true },
  { label: 'Flags', href: '/admin/flags', icon: Flag, disabled: true },
  { label: 'Settings', href: '/admin/settings', icon: Settings, disabled: true }
]

export function AdminSidebar() {
  const pathname = usePathname()
  const visibleItems = ADMIN_NAV_ITEMS.filter(item => !item.disabled)

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row items-center justify-between px-2 py-3">
        <div className="flex items-center gap-2">
          <Sparkles
            aria-hidden
            className="size-4 text-[color:var(--accent-blue)]"
          />
          <span className="text-sm font-semibold tracking-tight text-foreground select-none">
            Polymorph Admin
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarGroup>
          <SidebarMenu>
            {visibleItems.map(item => {
              const active =
                pathname === item.href ||
                (pathname?.startsWith(`${item.href}/`) ?? false)
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.href}>
                  <SidebarMenuButton asChild isActive={active}>
                    <Link
                      href={item.href}
                      data-active={active ? 'true' : 'false'}
                      className="flex items-center gap-2"
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="px-2 py-3 border-t border-sidebar-border">
        <div className="text-xs text-muted-foreground">Admin workspace</div>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  )
}

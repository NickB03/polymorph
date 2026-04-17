'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

import {
  Activity,
  ArrowLeft,
  ChartColumnIncreasing,
  Flag,
  MessageSquare,
  Settings,
  Users
} from 'lucide-react'

import { cn } from '@/lib/utils'

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
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
  {
    label: 'Feedback',
    href: '/admin/feedback',
    icon: MessageSquare,
    disabled: true
  },
  { label: 'Traffic', href: '/admin/traffic', icon: Activity, disabled: true },
  { label: 'Users', href: '/admin/users', icon: Users, disabled: true },
  { label: 'Flags', href: '/admin/flags', icon: Flag, disabled: true },
  { label: 'Settings', href: '/admin/settings', icon: Settings, disabled: true }
]

export function AdminSidebar() {
  const pathname = usePathname()

  return (
    <Sidebar side="left" variant="sidebar" collapsible="offcanvas">
      <SidebarHeader className="flex flex-row items-center justify-between px-2 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xl font-semibold tracking-tight text-foreground select-none">
            pm
          </span>
          <span className="rounded-full border border-[color:var(--accent-blue)]/30 bg-[color:var(--accent-blue)]/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-[color:var(--accent-blue)] uppercase">
            Admin
          </span>
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <Link href="/" className="flex items-center gap-2">
                <ArrowLeft className="size-4" />
                <span>Back to chat</span>
              </Link>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>

        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarMenu>
            {ADMIN_NAV_ITEMS.map(item => {
              const active =
                pathname === item.href ||
                (pathname?.startsWith(`${item.href}/`) ?? false)
              const Icon = item.icon
              return (
                <SidebarMenuItem key={item.href}>
                  {item.disabled ? (
                    <SidebarMenuButton
                      isActive={active}
                      disabled
                      aria-disabled
                      tabIndex={-1}
                      className="cursor-default opacity-50"
                    >
                      <Icon className="size-4" />
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  ) : (
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
                  )}
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

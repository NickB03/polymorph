import type { Metadata, Viewport } from 'next'
import { Inter as FontSans } from 'next/font/google'

import { Analytics } from '@vercel/analytics/next'

import { createClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import { createAppMetadata } from '@/lib/utils/app-metadata'

import { SidebarProvider } from '@/components/ui/sidebar'
import { Toaster } from '@/components/ui/sonner'

import AppSidebar from '@/components/app-sidebar'
import { CanvasRoot } from '@/components/canvas/canvas-root'
import Header from '@/components/header'
import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const fontSans = FontSans({
  subsets: ['latin'],
  variable: '--font-sans'
})

export const metadata: Metadata = createAppMetadata()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default async function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  let user = null
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (supabaseUrl && supabaseAnonKey) {
    const supabase = await createClient()
    const {
      data: { user: supabaseUser }
    } = await supabase.auth.getUser()
    user = supabaseUser
  }

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'min-h-screen flex flex-col font-sans antialiased overflow-hidden pb-safe',
          fontSans.variable
        )}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <SidebarProvider defaultOpen>
            <AppSidebar hasUser={!!user} />
            <div className="flex flex-col flex-1 min-w-0">
              <Header user={user} />
              <main className="flex flex-1 min-h-0 min-w-0 overflow-hidden">
                <CanvasRoot>{children}</CanvasRoot>
              </main>
            </div>
          </SidebarProvider>
          <Toaster />
          <Analytics />
        </ThemeProvider>
      </body>
    </html>
  )
}

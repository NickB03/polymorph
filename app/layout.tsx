import type { Metadata, Viewport } from 'next'

import { Analytics } from '@vercel/analytics/next'
import { GeistMono } from 'geist/font/mono'
import { GeistSans } from 'geist/font/sans'

import { cn } from '@/lib/utils'
import { createAppMetadata } from '@/lib/utils/app-metadata'

import { Toaster } from '@/components/ui/sonner'

import { ThemeProvider } from '@/components/theme-provider'
import { VisualViewportHeight } from '@/components/visual-viewport-height'

import './globals.css'
import 'leaflet/dist/leaflet.css'

export const metadata: Metadata = createAppMetadata()

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover'
}

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={cn(
          'h-app-viewport min-h-app-viewport flex flex-col font-sans antialiased overflow-hidden',
          GeistSans.variable,
          GeistMono.variable
        )}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:shadow-md focus:ring-2 focus:ring-ring"
        >
          Skip to content
        </a>
        <VisualViewportHeight />
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
        </ThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}

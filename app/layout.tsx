import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { Analytics } from '@vercel/analytics/next'

import { cn } from '@/lib/utils'
import { createAppMetadata } from '@/lib/utils/app-metadata'

import { Toaster } from '@/components/ui/sonner'

import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'

const fontSans = localFont({
  src: './fonts/inter-latin-variable.woff2',
  variable: '--font-sans',
  display: 'swap'
})

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
          {children}
        </ThemeProvider>
        <Toaster />
        <Analytics />
      </body>
    </html>
  )
}

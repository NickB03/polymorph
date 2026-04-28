import type { Metadata, Viewport } from 'next'
import localFont from 'next/font/local'

import { Analytics } from '@vercel/analytics/next'

import { cn } from '@/lib/utils'
import { createAppMetadata } from '@/lib/utils/app-metadata'

import { Toaster } from '@/components/ui/sonner'

import { ThemeProvider } from '@/components/theme-provider'

import './globals.css'
import 'leaflet/dist/leaflet.css'

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

// Tracks the actual visible viewport height so mobile browsers (especially iOS
// Safari) keep the chat composer above the soft keyboard. CSS `dvh` covers the
// URL-bar case but does not shrink for the keyboard on iOS; visualViewport does.
const setAppHeightScript = `(function(){
  var d=document.documentElement;
  function set(){
    var h=(window.visualViewport&&window.visualViewport.height)||window.innerHeight;
    d.style.setProperty('--app-height',h+'px');
  }
  set();
  window.addEventListener('resize',set);
  window.addEventListener('orientationchange',set);
  if(window.visualViewport){
    window.visualViewport.addEventListener('resize',set);
    window.visualViewport.addEventListener('scroll',set);
  }
})();`

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: setAppHeightScript }} />
      </head>
      <body
        className={cn(
          'h-app flex flex-col font-sans antialiased overflow-hidden pb-safe',
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

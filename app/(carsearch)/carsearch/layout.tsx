import type { CSSProperties } from 'react'

const carsearchLightTheme = {
  colorScheme: 'light',
  '--background': 'oklch(0.99 0 0)',
  '--foreground': 'oklch(0 0 0)',
  '--primary': 'oklch(0 0 0)',
  '--primary-foreground': 'oklch(1 0 0)',
  '--accent': 'oklch(0.94 0 0)',
  '--accent-foreground': 'oklch(0 0 0)',
  '--border': 'oklch(0.92 0 0)',
  '--input': 'oklch(0.94 0 0)',
  '--muted-foreground': 'oklch(0.44 0 0)',
  '--ring': 'oklch(0.546 0.245 263)'
} as CSSProperties

export default function CarsearchLayout({
  children
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <main
      className="min-h-0 flex-1 overflow-y-auto bg-zinc-50 text-zinc-950"
      style={carsearchLightTheme}
    >
      {children}
    </main>
  )
}

import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

describe('root viewport sizing', () => {
  it('anchors the app shell to the visual viewport, not 100vh', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'app/layout.tsx'),
      'utf8'
    )

    expect(source).toContain('VisualViewportHeight')
    expect(source).toContain('min-h-app-viewport')
    expect(source).not.toContain('min-h-screen')
  })

  it('defines app viewport utilities backed by the synced CSS variable', () => {
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app/globals.css'),
      'utf8'
    )

    expect(css).toContain('--app-visual-viewport-height: 100dvh')
    expect(css).toContain('@utility h-app-viewport')
    expect(css).toContain('@utility min-h-app-viewport')
    expect(css).toContain('height: var(--app-visual-viewport-height, 100dvh)')
    expect(css).toContain(
      'min-height: var(--app-visual-viewport-height, 100dvh)'
    )
  })

  it('compacts the empty chat offset when the soft keyboard is visible', () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), 'components/chat.tsx'),
      'utf8'
    )

    expect(source).toContain('--app-keyboard-inset-height')
    expect(source).toContain(
      'pt-[max(1rem,calc(10vh-var(--app-keyboard-inset-height,0px)))]'
    )
    expect(source).not.toContain(
      'items-center justify-center pt-[10vh] md:pt-[8vh] md:pb-0'
    )
  })

  it('bottom-aligns the empty chat composer while the mobile keyboard is open', () => {
    const chatSource = fs.readFileSync(
      path.join(process.cwd(), 'components/chat.tsx'),
      'utf8'
    )
    const panelSource = fs.readFileSync(
      path.join(process.cwd(), 'components/chat-panel.tsx'),
      'utf8'
    )
    const css = fs.readFileSync(
      path.join(process.cwd(), 'app/globals.css'),
      'utf8'
    )

    expect(chatSource).toContain('data-empty-chat-layout')
    expect(panelSource).toContain('data-empty-chat-suggestions')
    expect(css).toContain(
      "html[data-soft-keyboard='open'] [data-empty-chat-layout='true']"
    )
    expect(css).toContain('justify-content: flex-end')
    expect(css).toContain(
      "html[data-soft-keyboard='open'] [data-empty-chat-suggestions='true']"
    )
    expect(css).toContain('max-height: 0')
  })
})

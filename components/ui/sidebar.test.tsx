import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

vi.mock('@/hooks/use-mobile', () => ({
  useIsMobile: () => true
}))

import { SidebarProvider, SidebarTrigger } from './sidebar'

describe('SidebarProvider', () => {
  it('does NOT hide the shell before hydration with opacity-0', () => {
    const { container } = render(
      <SidebarProvider>
        <div>content</div>
      </SidebarProvider>
    )
    const wrapper = container.querySelector(
      '[class*="sidebar-wrapper"]'
    ) as HTMLElement
    expect(wrapper).toBeTruthy()
    expect(wrapper.className).not.toContain('opacity-0')
  })
})

describe('SidebarTrigger', () => {
  it('renders a 44x44 hit target', () => {
    render(
      <SidebarProvider>
        <SidebarTrigger data-testid="trigger" />
      </SidebarProvider>
    )
    const trigger = screen.getByTestId('trigger')
    expect(trigger.className).toContain('h-11')
  })
})

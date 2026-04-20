import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HydrationAnimationProvider } from '@/lib/motion/hydration-boundary'

import { ToolCardMount } from './tool-card-mount'

describe('ToolCardMount', () => {
  it('renders its children inside a motion wrapper', () => {
    render(
      <HydrationAnimationProvider initialPartIds={['seen-id']}>
        <ToolCardMount partId="seen-id">
          <span data-testid="content-seen">hello</span>
        </ToolCardMount>
        <ToolCardMount partId="new-id">
          <span data-testid="content-new">hi</span>
        </ToolCardMount>
      </HydrationAnimationProvider>
    )

    expect(screen.getByTestId('content-seen')).toBeInTheDocument()
    expect(screen.getByTestId('content-new')).toBeInTheDocument()
  })
})

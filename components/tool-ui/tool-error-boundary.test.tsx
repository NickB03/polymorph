import { render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ToolErrorBoundary } from './tool-error-boundary'

function Bomb(): null {
  throw new Error('child render failed')
}

describe('ToolErrorBoundary', () => {
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
  })

  it('renders children when no error is thrown', () => {
    render(
      <ToolErrorBoundary toolName="someTool">
        <span>child content</span>
      </ToolErrorBoundary>
    )

    expect(screen.getByText('child content')).toBeInTheDocument()
  })

  it('renders the fallback with rounded-xl framing and the tool name when a child throws', () => {
    render(
      <ToolErrorBoundary toolName="someTool">
        <Bomb />
      </ToolErrorBoundary>
    )

    const fallback = screen.getByText(/Failed to render someTool/)
    expect(fallback).toBeInTheDocument()
    expect(fallback.className).toMatch(/rounded-xl/)
    expect(fallback.className).not.toMatch(/rounded-lg/)
  })
})

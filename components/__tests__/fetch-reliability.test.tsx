import React from 'react'

import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { ToolPart } from '@/lib/types/ai'

import { ActivityFetchItem } from '../activity/activity-fetch-item'
import { FetchSection } from '../fetch-section'

vi.mock('@/components/tool-ui/shared/media', () => ({
  openSafeNavigationHref: vi.fn()
}))

function buildFetchTool(
  overrides: Partial<ToolPart<'fetch'>> = {}
): ToolPart<'fetch'> {
  return {
    type: 'tool-fetch',
    toolCallId: 'fetch-1',
    input: { url: 'https://example.com/article' },
    state: 'output-error',
    errorText: 'Tavily extract error 432: Plan usage limit exceeded',
    ...overrides
  } as ToolPart<'fetch'>
}

describe('fetch reliability UI', () => {
  it('renders fetch provider errors in the fetch section', () => {
    render(
      <FetchSection
        tool={buildFetchTool()}
        isOpen={false}
        onOpenChange={() => {}}
      />
    )

    expect(
      screen.getAllByText('Tavily extract error 432: Plan usage limit exceeded')
    ).toHaveLength(2)
    expect(
      screen.getByTitle('Tavily extract error 432: Plan usage limit exceeded')
    ).toBeInTheDocument()
  })

  it('surfaces fetch provider errors in the activity row without changing success layout', () => {
    render(<ActivityFetchItem tool={buildFetchTool()} />)

    expect(
      screen.getByText('Tavily extract error 432: Plan usage limit exceeded')
    ).toBeInTheDocument()
    expect(
      screen.getByTitle('Tavily extract error 432: Plan usage limit exceeded')
    ).toBeInTheDocument()
  })
})

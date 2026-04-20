import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  HydrationAnimationProvider,
  useIsNewPart
} from '@/lib/motion/hydration-boundary'
import { collectInitialPartIds } from '@/lib/motion/part-ids'
import type { UIMessage } from '@/lib/types/ai'

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

  it('does not flag text-extracted tool UIs as new on rehydrated history', () => {
    // Regression: text parts containing ```json blocks spawn tool UIs with
    // partId `${messageId}-extract-${match.index}`. The hydration seeder
    // must include these IDs so the cards don't flash entrance animations.
    const timelineJson = JSON.stringify({
      id: 'tl-1',
      title: 'Roadmap',
      events: [{ id: 'e1', date: '2024-01-01', title: 'Kickoff' }]
    })
    const text = `Here is the timeline:\n\n\`\`\`json\n${timelineJson}\n\`\`\``
    const messageId = 'hist-1'
    const savedMessages: UIMessage[] = [
      {
        id: messageId,
        role: 'assistant',
        parts: [{ type: 'text', text }]
      } as UIMessage
    ]

    const initialPartIds = collectInitialPartIds(savedMessages)
    const extractedPartId = `${messageId}-extract-${text.indexOf('```json')}`

    // The probe reports whether the hydration boundary sees this partId
    // as new (would animate) or seen (skips entrance animation).
    function Probe({ partId }: { partId: string }) {
      const isNew = useIsNewPart(partId)
      return <span data-testid="extracted-probe">{isNew ? 'new' : 'seen'}</span>
    }

    render(
      <HydrationAnimationProvider initialPartIds={initialPartIds}>
        <Probe partId={extractedPartId} />
      </HydrationAnimationProvider>
    )

    expect(screen.getByTestId('extracted-probe')).toHaveTextContent('seen')
  })
})

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CollapsibleMessage } from './collapsible-message'

describe('CollapsibleMessage', () => {
  it('uses caller-provided stable ids for collapsible trigger/content wiring', () => {
    const { container } = render(
      <CollapsibleMessage
        role="assistant"
        isCollapsible
        isOpen={false}
        showIcon={false}
        collapsibleContentId="stable-message-content"
        header={<span>Search results</span>}
      >
        <div>Hidden body</div>
      </CollapsibleMessage>
    )

    expect(screen.getByRole('button', { name: 'Expand' })).toHaveAttribute(
      'aria-controls',
      'stable-message-content'
    )
    expect(container.querySelector('#stable-message-content')).toBeTruthy()
  })
})

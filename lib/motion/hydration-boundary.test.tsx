import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { HydrationAnimationProvider, useIsNewPart } from './hydration-boundary'

function Probe({ partId }: { partId: string }) {
  const isNew = useIsNewPart(partId)
  return <span data-testid={partId}>{isNew ? 'new' : 'seen'}</span>
}

describe('HydrationAnimationProvider', () => {
  it('marks ids present at initial render as seen, absent ids as new', () => {
    render(
      <HydrationAnimationProvider initialPartIds={['a', 'b']}>
        <Probe partId="a" />
        <Probe partId="b" />
        <Probe partId="c" />
      </HydrationAnimationProvider>
    )

    expect(screen.getByTestId('a')).toHaveTextContent('seen')
    expect(screen.getByTestId('b')).toHaveTextContent('seen')
    expect(screen.getByTestId('c')).toHaveTextContent('new')
  })

  it('snapshot is stable across re-renders with different initialPartIds', () => {
    const { rerender } = render(
      <HydrationAnimationProvider initialPartIds={['a']}>
        <Probe partId="a" />
        <Probe partId="b" />
      </HydrationAnimationProvider>
    )

    expect(screen.getByTestId('a')).toHaveTextContent('seen')
    expect(screen.getByTestId('b')).toHaveTextContent('new')

    rerender(
      <HydrationAnimationProvider initialPartIds={['a', 'b']}>
        <Probe partId="a" />
        <Probe partId="b" />
      </HydrationAnimationProvider>
    )

    // Snapshot captured once; b is still new despite being in the updated prop.
    expect(screen.getByTestId('a')).toHaveTextContent('seen')
    expect(screen.getByTestId('b')).toHaveTextContent('new')
  })

  it('returns true by default when no provider is mounted', () => {
    render(<Probe partId="orphan" />)
    expect(screen.getByTestId('orphan')).toHaveTextContent('new')
  })
})

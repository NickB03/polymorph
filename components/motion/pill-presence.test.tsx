import {
  render,
  screen,
  waitForElementToBeRemoved
} from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { PillPresence } from './pill-presence'

describe('PillPresence', () => {
  it('renders children when activeKey is set', () => {
    render(
      <PillPresence activeKey="research">
        <span data-testid="pill">Research</span>
      </PillPresence>
    )

    expect(screen.getByTestId('pill')).toBeInTheDocument()
  })

  it('renders nothing when activeKey is null', () => {
    render(
      <PillPresence activeKey={null}>
        <span data-testid="pill">Research</span>
      </PillPresence>
    )

    expect(screen.queryByTestId('pill')).not.toBeInTheDocument()
  })

  it('keeps child mounted during exit animation when activeKey becomes null, then unmounts', async () => {
    const { rerender } = render(
      <PillPresence activeKey="research">
        <span data-testid="pill">Research</span>
      </PillPresence>
    )

    expect(screen.getByTestId('pill')).toBeInTheDocument()

    rerender(
      <PillPresence activeKey={null}>
        <span data-testid="pill">Research</span>
      </PillPresence>
    )

    // AnimatePresence must keep the child mounted while the exit variant runs.
    // If this assertion ever flips to "not in document," the exit animation has
    // been short-circuited and the pill will disappear without its fade-out.
    expect(screen.getByTestId('pill')).toBeInTheDocument()

    await waitForElementToBeRemoved(() => screen.queryByTestId('pill'), {
      timeout: 500
    })

    expect(screen.queryByTestId('pill')).not.toBeInTheDocument()
  })

  it('swaps children on key change: incoming mounts while outgoing is still present, then outgoing unmounts', async () => {
    const { rerender } = render(
      <PillPresence activeKey="research">
        <span data-testid="pill-research">Research</span>
      </PillPresence>
    )

    expect(screen.getByTestId('pill-research')).toBeInTheDocument()
    expect(screen.queryByTestId('pill-build')).not.toBeInTheDocument()

    rerender(
      <PillPresence activeKey="build">
        <span data-testid="pill-build">Build</span>
      </PillPresence>
    )

    // popLayout mode: the incoming child mounts immediately while the outgoing
    // child runs its exit. Both are in the DOM during the transition window.
    expect(screen.getByTestId('pill-build')).toBeInTheDocument()
    expect(screen.getByTestId('pill-research')).toBeInTheDocument()

    await waitForElementToBeRemoved(
      () => screen.queryByTestId('pill-research'),
      {
        timeout: 500
      }
    )

    expect(screen.queryByTestId('pill-research')).not.toBeInTheDocument()
    expect(screen.getByTestId('pill-build')).toBeInTheDocument()
  })
})

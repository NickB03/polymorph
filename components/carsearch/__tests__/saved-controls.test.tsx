import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import { SavedControls } from '../saved-controls'

describe('SavedControls', () => {
  it('does not expose save mutations to unauthorized viewers', () => {
    render(<SavedControls canManage={false} saved={null} vin="VIN1234567890" />)

    expect(
      screen.getByText(/Sign in with an approved account/i)
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /save/i })
    ).not.toBeInTheDocument()
  })

  it('calls the save endpoint for authorized users', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })))

    render(<SavedControls canManage saved={null} vin="VIN1234567890" />)
    const saveButton = screen.getByRole('button', { name: /save listing/i })
    expect(saveButton).toHaveClass('text-white')
    fireEvent.click(saveButton)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith('/api/carsearch/saved', {
        body: JSON.stringify({ vin: 'VIN1234567890' }),
        headers: { 'content-type': 'application/json' },
        method: 'POST'
      })
    })
    expect(screen.getByText(/Shared notes/i)).toBeInTheDocument()

    fetchMock.mockRestore()
  })
})

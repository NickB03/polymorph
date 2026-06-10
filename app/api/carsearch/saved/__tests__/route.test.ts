import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetCurrentUser = vi.fn()
const mockCanManageCarsearch = vi.fn()
const mockSaveCarsearchListing = vi.fn()
const mockUpdateCarsearchSavedListing = vi.fn()
const mockUnsaveCarsearchListing = vi.fn()

vi.mock('@/lib/auth/get-current-user', () => ({
  getCurrentUser: () => mockGetCurrentUser()
}))

vi.mock('@/lib/carsearch/auth', () => ({
  canManageCarsearch: (...args: unknown[]) => mockCanManageCarsearch(...args)
}))

vi.mock('@/lib/carsearch/mutations', () => ({
  saveCarsearchListing: (...args: unknown[]) =>
    mockSaveCarsearchListing(...args),
  updateCarsearchSavedListing: (...args: unknown[]) =>
    mockUpdateCarsearchSavedListing(...args),
  unsaveCarsearchListing: (...args: unknown[]) =>
    mockUnsaveCarsearchListing(...args)
}))

import { DELETE, PATCH } from '../[vin]/route'
import { POST } from '../route'

function jsonRequest(path: string, body: unknown) {
  return new Request(`https://example.com${path}`, {
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json' },
    method: 'POST'
  })
}

describe('carsearch saved API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetCurrentUser.mockResolvedValue({ id: 'user-1' })
    mockCanManageCarsearch.mockReturnValue(true)
  })

  it('rejects unauthorized saves', async () => {
    mockCanManageCarsearch.mockReturnValue(false)

    const response = await POST(
      jsonRequest('/api/carsearch/saved', { vin: 'VIN1234567890' })
    )

    expect(response.status).toBe(403)
    expect(mockSaveCarsearchListing).not.toHaveBeenCalled()
  })

  it('validates save body', async () => {
    const response = await POST(jsonRequest('/api/carsearch/saved', {}))

    expect(response.status).toBe(400)
    expect(mockSaveCarsearchListing).not.toHaveBeenCalled()
  })

  it('saves a listing for the current user', async () => {
    const response = await POST(
      jsonRequest('/api/carsearch/saved', {
        vin: 'VIN1234567890',
        note: 'Ask about tires'
      })
    )

    expect(response.status).toBe(200)
    expect(mockSaveCarsearchListing).toHaveBeenCalledWith({
      vin: 'VIN1234567890',
      note: 'Ask about tires',
      savedByUserId: 'user-1'
    })
  })

  it('patches saved listing state', async () => {
    const response = await PATCH(
      jsonRequest('/api/carsearch/saved/VIN1234567890', {
        status: 'contacted',
        note: 'Dealer replied'
      }),
      { params: Promise.resolve({ vin: 'VIN1234567890' }) }
    )

    expect(response.status).toBe(200)
    expect(mockUpdateCarsearchSavedListing).toHaveBeenCalledWith({
      vin: 'VIN1234567890',
      status: 'contacted',
      note: 'Dealer replied'
    })
  })

  it('unsaves a listing', async () => {
    const response = await DELETE(
      new Request('https://example.com/api/carsearch/saved/VIN1234567890'),
      { params: Promise.resolve({ vin: 'VIN1234567890' }) }
    )

    expect(response.status).toBe(200)
    expect(mockUnsaveCarsearchListing).toHaveBeenCalledWith('VIN1234567890')
  })
})

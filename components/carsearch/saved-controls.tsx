'use client'

import { useEffect, useRef, useState } from 'react'

import { Heart, Trash2 } from 'lucide-react'

import type {
  CarsearchSavedListing,
  CarsearchSavedStatus
} from '@/lib/carsearch/types'

import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const statusOptions: Array<{ value: CarsearchSavedStatus; label: string }> = [
  { value: 'saved', label: 'Saved' },
  { value: 'contacted', label: 'Contacted dealer' },
  { value: 'test_drive', label: 'Test drive' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'purchased', label: 'Purchased' }
]

export function SavedControls({
  vin,
  saved,
  canManage
}: {
  vin: string
  saved: CarsearchSavedListing | null
  canManage: boolean
}) {
  const [isSaved, setIsSaved] = useState(Boolean(saved))
  const [status, setStatus] = useState<CarsearchSavedStatus>(
    saved?.status ?? 'saved'
  )
  const [note, setNote] = useState(saved?.note ?? '')
  const [pending, setPending] = useState(false)
  const hasHydrated = useRef(false)
  const statusName = `carsearch-status-${vin}`
  const notesName = `carsearch-notes-${vin}`

  useEffect(() => {
    if (!isSaved || !canManage) return
    if (!hasHydrated.current) {
      hasHydrated.current = true
      return
    }

    const timeout = window.setTimeout(() => {
      void fetch(`/api/carsearch/saved/${vin}`, {
        body: JSON.stringify({ note, status }),
        headers: { 'content-type': 'application/json' },
        method: 'PATCH'
      })
    }, 500)

    return () => window.clearTimeout(timeout)
  }, [canManage, isSaved, note, status, vin])

  async function saveListing() {
    if (!canManage) return
    setPending(true)
    const response = await fetch('/api/carsearch/saved', {
      body: JSON.stringify({ vin }),
      headers: { 'content-type': 'application/json' },
      method: 'POST'
    })
    if (response.ok) setIsSaved(true)
    setPending(false)
  }

  async function removeListing() {
    if (!canManage) return
    setPending(true)
    const response = await fetch(`/api/carsearch/saved/${vin}`, {
      method: 'DELETE'
    })
    if (response.ok) {
      setIsSaved(false)
      setNote('')
      setStatus('saved')
    }
    setPending(false)
  }

  if (!canManage) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600">
        Sign in with an approved account to save listings and share notes.
      </div>
    )
  }

  if (!isSaved) {
    return (
      <Button
        className="min-h-11 w-full bg-zinc-950 text-white hover:bg-zinc-800 hover:text-white"
        disabled={pending}
        onClick={saveListing}
        type="button"
      >
        <Heart aria-hidden className="h-4 w-4" />
        Save listing
      </Button>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-zinc-200 bg-white p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="font-semibold text-zinc-950">Shared notes</div>
          <div className="text-sm text-zinc-500">
            Visible to approved users.
          </div>
        </div>
        <Button
          aria-label="Remove saved listing"
          disabled={pending}
          className="border-zinc-300 bg-white text-zinc-950 hover:bg-zinc-100 hover:text-zinc-950"
          onClick={removeListing}
          size="icon"
          type="button"
          variant="outline"
        >
          <Trash2 aria-hidden className="h-4 w-4" />
        </Button>
      </div>
      <label className="block text-sm font-semibold text-zinc-700">
        Status
        <select
          className="mt-1 min-h-11 w-full rounded-md border border-zinc-200 bg-white px-3 text-sm text-zinc-950"
          name={statusName}
          onChange={event =>
            setStatus(event.target.value as CarsearchSavedStatus)
          }
          value={status}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm font-semibold text-zinc-700">
        Notes
        <Textarea
          className="mt-1 min-h-32 border-zinc-200 bg-white text-zinc-950 placeholder:text-zinc-400"
          name={notesName}
          onChange={event => setNote(event.target.value)}
          placeholder="Questions for the dealer, test-drive notes, price conversation..."
          value={note}
        />
      </label>
    </div>
  )
}

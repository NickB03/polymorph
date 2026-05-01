import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockSearchParamGet = vi.hoisted(() =>
  vi.fn<(key: string) => string | null>(() => null)
)

vi.mock('next/navigation', () => ({
  useSearchParams: () => ({
    get: mockSearchParamGet
  })
}))

import { isView, type View } from './url-state'
import { useUrlState } from './use-url-state'

describe('useUrlState', () => {
  let replaceSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    mockSearchParamGet.mockReset()
    mockSearchParamGet.mockReturnValue(null)
    window.history.replaceState({}, '', '/admin/evals')
    replaceSpy = vi.spyOn(window.history, 'replaceState')
  })

  afterEach(() => {
    replaceSpy.mockRestore()
  })

  it('returns the URL param when it passes the validator', () => {
    mockSearchParamGet.mockReturnValue('history')
    const { result } = renderHook(() =>
      useUrlState<View>('view', 'suites', isView)
    )
    expect(result.current[0]).toBe('history')
  })

  it('falls back to the default when the URL param is missing', () => {
    mockSearchParamGet.mockReturnValue(null)
    const { result } = renderHook(() =>
      useUrlState<View>('view', 'suites', isView)
    )
    expect(result.current[0]).toBe('suites')
  })

  it('falls back to the default when the URL param fails the validator', () => {
    mockSearchParamGet.mockReturnValue('not-a-view')
    const { result } = renderHook(() =>
      useUrlState<View>('view', 'suites', isView)
    )
    expect(result.current[0]).toBe('suites')
  })

  it('updates state and URL when the setter is called', () => {
    const { result } = renderHook(() =>
      useUrlState<View>('view', 'suites', isView)
    )
    act(() => {
      result.current[1]('history')
    })
    expect(result.current[0]).toBe('history')
    expect(window.location.search).toContain('view=history')
    expect(replaceSpy).toHaveBeenCalledTimes(1)
  })

  it('skips history.replaceState when the URL already has the same value', () => {
    window.history.replaceState({}, '', '/admin/evals?view=history')
    replaceSpy.mockClear()

    const { result } = renderHook(() =>
      useUrlState<View>('view', 'suites', isView)
    )
    act(() => {
      result.current[1]('history')
    })
    expect(replaceSpy).not.toHaveBeenCalled()
  })
})

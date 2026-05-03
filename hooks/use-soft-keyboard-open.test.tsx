import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it } from 'vitest'

import { useSoftKeyboardOpen } from './use-soft-keyboard-open'

describe('useSoftKeyboardOpen', () => {
  afterEach(() => {
    document.documentElement.removeAttribute('data-soft-keyboard')
  })

  it('reads the initial keyboard state from the root attribute', () => {
    document.documentElement.setAttribute('data-soft-keyboard', 'open')

    const { result } = renderHook(() => useSoftKeyboardOpen())

    expect(result.current).toBe(true)
  })

  it('updates when the visual viewport sync dispatches keyboard changes', () => {
    const { result } = renderHook(() => useSoftKeyboardOpen())

    expect(result.current).toBe(false)

    act(() => {
      document.documentElement.setAttribute('data-soft-keyboard', 'open')
      window.dispatchEvent(
        new CustomEvent('app-soft-keyboard-change', {
          detail: { open: true, keyboardInset: 320 }
        })
      )
    })

    expect(result.current).toBe(true)

    act(() => {
      document.documentElement.removeAttribute('data-soft-keyboard')
      window.dispatchEvent(
        new CustomEvent('app-soft-keyboard-change', {
          detail: { open: false, keyboardInset: 0 }
        })
      )
    })

    expect(result.current).toBe(false)
  })
})

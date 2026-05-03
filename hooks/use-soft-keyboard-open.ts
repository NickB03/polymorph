'use client'

import { useSyncExternalStore } from 'react'

export const SOFT_KEYBOARD_CHANGE_EVENT = 'app-soft-keyboard-change'

export interface SoftKeyboardChangeDetail {
  open: boolean
  keyboardInset: number
}

function readSoftKeyboardOpen() {
  if (typeof document === 'undefined') return false
  return document.documentElement.getAttribute('data-soft-keyboard') === 'open'
}

function subscribeToSoftKeyboardChanges(callback: () => void) {
  window.addEventListener(SOFT_KEYBOARD_CHANGE_EVENT, callback)
  return () => {
    window.removeEventListener(SOFT_KEYBOARD_CHANGE_EVENT, callback)
  }
}

export function useSoftKeyboardOpen() {
  return useSyncExternalStore(
    subscribeToSoftKeyboardChanges,
    readSoftKeyboardOpen,
    () => false
  )
}

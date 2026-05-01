'use client'

import { useCallback, useState } from 'react'
import { useSearchParams } from 'next/navigation'

import { replaceSearchParam } from './url-state'

export function useUrlState<T extends string>(
  key: string,
  defaultValue: T,
  isValid: (value: string | null) => value is T
): [T, (next: T) => void] {
  const search = useSearchParams()
  const param = search.get(key)
  const initial: T = isValid(param) ? param : defaultValue
  const [value, setValueState] = useState<T>(initial)

  const setValue = useCallback(
    (next: T) => {
      setValueState(next)
      replaceSearchParam(key, next)
    },
    [key]
  )

  return [value, setValue]
}

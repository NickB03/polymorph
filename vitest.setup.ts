import { vi } from 'vitest'

import '@testing-library/jest-dom'

// Ensure a functional localStorage is available in jsdom (bun passes --localstorage-file
// without a valid path which can produce a stub that lacks .clear())
if (
  typeof global.localStorage === 'undefined' ||
  typeof global.localStorage.clear !== 'function'
) {
  const store: Record<string, string> = {}
  global.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value)
    },
    removeItem: (key: string) => {
      delete store[key]
    },
    clear: () => {
      Object.keys(store).forEach(k => delete store[k])
    },
    get length() {
      return Object.keys(store).length
    },
    key: (index: number) => Object.keys(store)[index] ?? null
  } as Storage
}

// jsdom doesn't implement window.matchMedia — provide a minimal stub
if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: () => {},
      removeListener: () => {},
      addEventListener: () => {},
      removeEventListener: () => {},
      dispatchEvent: () => false
    })
  })
}

// @visx/responsive uses ResizeObserver which jsdom doesn't provide
if (typeof global.ResizeObserver === 'undefined') {
  global.ResizeObserver = class ResizeObserver {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

// Provide dummy values for environment variables required during tests
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/testdb'

// Mock Next.js functions
vi.mock('next/cache', () => ({
  revalidateTag: vi.fn(),
  revalidatePath: vi.fn(),
  unstable_cache: vi.fn(fn => fn)
}))

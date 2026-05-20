import { vi } from 'vitest'

import '@testing-library/jest-dom'

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

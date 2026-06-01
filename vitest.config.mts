import react from '@vitejs/plugin-react'
import path from 'path'
import { defineConfig } from 'vitest/config'

// Provide dummy env vars at configuration time to avoid import errors during bundling
process.env.DATABASE_URL =
  process.env.DATABASE_URL ?? 'postgres://user:pass@localhost:5432/testdb'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      'server-only': path.resolve(__dirname, './tests/support/server-only.ts'),
      'zod/v4': 'zod'
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './vitest.setup.ts',
    exclude: ['**/node_modules/**', 'services/**', '.claude/worktrees/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'text-summary', 'json-summary', 'lcov'],
      include: [
        'lib/**/*.{ts,tsx}',
        'app/**/*.{ts,tsx}',
        'components/**/*.{ts,tsx}',
        'hooks/**/*.{ts,tsx}'
      ],
      exclude: [
        '**/__tests__/**',
        '**/*.test.ts',
        '**/*.test.tsx',
        '**/*.d.ts',
        'lib/db/migrations/**',
        'lib/canvas/compiler/vendor/**',
        '**/*.generated.ts'
      ],
      // Ratchet floor: set a few points below the measured baseline so this
      // gates regressions without being aspirational. Raise as coverage grows.
      thresholds: {
        statements: 58,
        branches: 71,
        functions: 67,
        lines: 58
      }
    }
  }
})

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Vitest's 5000 ms default is too tight for this package under parallel
    // worker load: several tests in index.test.ts, runner.test.ts and
    // runners/*.test.ts import module graphs that pull in all seven
    // evaluators, and the collect phase alone has been observed above 5 s
    // wall-clock while the tests themselves run in single-digit milliseconds.
    // 10000 ms absorbs that variance with ~2x headroom over the worst observed
    // collect time without letting a genuinely hung test stall CI for long.
    testTimeout: 10000
  }
})

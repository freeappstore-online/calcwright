import { defineConfig } from 'vitest/config'

// Unit and reference tests only. The e2e suite (e2e/, Playwright) has its own
// runner: `pnpm test:e2e`.
export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
  },
})

import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/app/api/v1/tap-tap-adventure/**/*.test.ts',
      'src/app/tap-tap-adventure/**/*.test.ts',
      'src/app/daily-card-game/**/*.test.ts',
      'src/app/daily-card-game/**/*.test.tsx',
      'src/lib/trivia/**/*.test.ts',
      'src/app/trivia/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})

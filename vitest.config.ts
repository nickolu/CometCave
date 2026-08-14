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
      'src/app/comet-cards/**/*.test.ts',
      'src/app/comet-cards/**/*.test.tsx',
      'src/lib/trivia/**/*.test.ts',
      'src/app/trivia/**/*.test.ts',
      'src/app/micro-land/**/*.test.ts',
      'src/lib/micro-land/**/*.test.ts',
      'src/app/dicebound/**/*.test.ts',
      'src/lib/dicebound/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})

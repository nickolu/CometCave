import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

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
      'src/app/api/v1/fantasy-tycoon/**/*.test.ts',
      'src/app/fantasy-tycoon/**/*.test.ts',
      'src/app/daily-card-game/**/*.test.ts',
      'src/app/daily-card-game/**/*.test.tsx',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
})

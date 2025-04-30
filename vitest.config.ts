import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: [
      'src/app/api/v1/fantasy-tycoon/**/*.test.ts',
      'src/app/fantasy-tycoon/**/*.test.ts',
    ],
    coverage: {
      reporter: ['text', 'json', 'html'],
    },
  },
});

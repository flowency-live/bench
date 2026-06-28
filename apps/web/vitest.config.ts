import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  esbuild: {
    jsx: 'automatic',
  },
  test: {
    globals: false,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.test.tsx'],
    environmentMatchGlobs: [
      // Use jsdom for React component tests
      ['**/*.test.tsx', 'jsdom'],
    ],
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
});

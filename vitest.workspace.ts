import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/@bench/domain/vitest.config.ts',
  // Add more package configs as they get tests
]);

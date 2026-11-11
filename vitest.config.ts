import { defineConfig } from 'vitest/config';

// Headless tests of the simulation core. The engines in src/sim have no DOM dependency;
// persistence tests use fake-indexeddb to exercise the real IndexedDB save layer.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
    testTimeout: 120_000,
    hookTimeout: 120_000,
    pool: 'forks',
  },
});

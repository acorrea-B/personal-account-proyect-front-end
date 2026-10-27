import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    // Hermetic tests: pin the api base so no run (local shell, CI, deploy
    // validate job exporting the production URL) couples assertions to it.
    env: {
      NEXT_PUBLIC_API_BASE_URL: '',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});

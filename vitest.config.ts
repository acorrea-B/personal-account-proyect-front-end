import path from 'node:path';

import { defineConfig } from 'vitest/config';

export default defineConfig({
  // The app's tsconfig keeps jsx: preserve for Next; the test harness needs
  // its own working transform - the same automatic runtime Next compiles
  // with, so component tests render the real JSX.
  oxc: {
    jsx: {
      runtime: 'automatic',
      importSource: 'react',
    },
  },
  // Component tests import the shared @ alias from the app; the same
  // mapping as tsconfig keeps vitest and Next on one vocabulary.
  resolve: {
    alias: {
      '@': path.resolve(__dirname),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    // Hermetic tests: pin the api base so no run (local shell, CI, deploy
    // validate job exporting the production URL) couples assertions to it.
    env: {
      NEXT_PUBLIC_API_BASE_URL: '',
      // Date formatting tests need one deterministic zone; the browser
      // renders in the user's zone at runtime.
      TZ: 'UTC',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov'],
    },
  },
});

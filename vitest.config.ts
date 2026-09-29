import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'artifacts/api-server/test/**/*.test.ts',
      'artifacts/ketan-resume/src/**/*.test.ts',
    ],
  },
});
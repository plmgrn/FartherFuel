import { defineConfig } from 'vitest/config';

export default defineConfig({
  // Pages serves the site under /<repo name>/
  base: '/FartherFuel/',
  test: { include: ['src/**/*.test.ts'] },
});

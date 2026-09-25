import path from 'node:path';
import { defineConfig } from 'vitest/config';

// Unit tests for pure TypeScript (domain + mapping). UI is covered by the
// Playwright walkthrough described in the README.
export default defineConfig({
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  test: { include: ['src/**/*.test.ts'] },
});

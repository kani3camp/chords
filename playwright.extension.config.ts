import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'tests/extension',
  fullyParallel: true,
  timeout: 30000,
  expect: { timeout: 5000 },
  reporter: 'list',
  webServer: {
    command: 'node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4175 --strictPort',
    port: 4175,
    reuseExistingServer: !process.env.CI,
  },
});

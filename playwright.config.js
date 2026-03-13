// playwright.config.js
const { defineConfig } = require('@playwright/test');

const isCI = process.env.CI === 'true';

module.exports = defineConfig({
  testDir: '.',
  timeout: 30000,

  // In CI: run tests one at a time (stable)
  // Locally: run in parallel (fast)
  workers: isCI ? 1 : undefined,

  use: {
    baseURL: 'http://localhost:3000',
    // No screenshots/videos locally; capture on failure in CI
    screenshot: isCI ? 'only-on-failure' : 'off',
    video:      isCI ? 'retain-on-failure' : 'off',
  },

  reporter: isCI
    ? [['list'], ['html', { open: 'never' }]]
    : [['list']],

  webServer: {
    command: 'node server_main.js',
    url:     'http://localhost:3000',
    reuseExistingServer: !isCI,  // reuse locally, always fresh in CI
    timeout: 10000,
  },
});
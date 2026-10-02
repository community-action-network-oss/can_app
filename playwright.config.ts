import { defineConfig } from '@playwright/test';

// Browsers install with `npm run e2e:install`; they are not part of `npm run verify`.
export default defineConfig({
  testDir: './e2e',
  retries: 1,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { baseURL: 'http://localhost:8081', trace: 'on-first-retry' },
  projects: [
    { name: 'phone-360', use: { browserName: 'chromium', viewport: { width: 360, height: 800 } } },
    {
      name: 'desktop-1280',
      use: { browserName: 'chromium', viewport: { width: 1280, height: 800 } },
    },
  ],
  webServer: {
    command: 'npx expo start --web --port 8081 --no-dev',
    url: 'http://localhost:8081',
    reuseExistingServer: true,
    timeout: 240_000,
  },
});

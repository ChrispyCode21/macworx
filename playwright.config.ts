import { defineConfig, devices } from '@playwright/test'

// Browser checks of the built app (SPEC §2): the app runs on an iPad, installed from Safari.
// WebKit stands in for iPad Safari; Chromium catches engine-specific layout bugs.
const PORT = 4173

const ipads = [
  { name: 'portrait', viewport: { width: 820, height: 1180 } },
  { name: 'landscape', viewport: { width: 1180, height: 820 } },
]
const browsers = [
  { name: 'webkit', use: devices['Desktop Safari'] },
  { name: 'chromium', use: devices['Desktop Chrome'] },
]

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  // No retries: a flaky test is a race to fix, not to hide.
  retries: 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The service worker would cache the app between tests; each test starts from a fresh page.
    serviceWorkers: 'block',
    trace: 'retain-on-failure',
  },
  projects: browsers.flatMap((browser) =>
    ipads.map((ipad) => ({
      name: `${browser.name}-${ipad.name}`,
      use: { ...browser.use, viewport: ipad.viewport, hasTouch: true },
    })),
  ),
  // The production build under the production headers (vite.config.ts applies public/_headers).
  webServer: {
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    // Always a fresh build, never an older preview left running on the port.
    reuseExistingServer: false,
    timeout: 180_000,
  },
})

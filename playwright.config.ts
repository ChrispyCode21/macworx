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

// The parent portal isn't iPad-specific (a parent's phone, tablet or computer), so its specs run on two
// projects, not four: WebKit at 820 wide (the tablet side-bar range, 768px to 1023px) and Chromium at 1180
// (the wide layout, 1024px and up). Both engines and both breakpoints stay covered; phone widths come from
// the tests that call setViewportSize themselves.
const PORTAL_SPECS = /(parent|portal)\.spec\.ts$/
const runsPortal = (project: string) => project === 'webkit-portrait' || project === 'chromium-landscape'
// Tapping through a whole assignment checks flow and payout, not orientation, so those tests run once per
// engine (landscape). Each screen they reach keeps a layout check in portrait from a quicker test.
const FULL_ASSIGNMENT = /@full-assignment/

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
    ipads.map((ipad) => {
      const name = `${browser.name}-${ipad.name}`
      return {
        name,
        use: { ...browser.use, viewport: ipad.viewport, hasTouch: true },
        ...(runsPortal(name) ? {} : { testIgnore: PORTAL_SPECS }),
        ...(ipad.name === 'portrait' ? { grepInvert: FULL_ASSIGNMENT } : {}),
      }
    }),
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
